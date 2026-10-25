import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { env } from '../config/env';
import { ROLES } from '../config/constants';
import { BadRequest, Conflict, Forbidden, NotFound } from '../utils/errors';
import { codeGenerators } from '../utils/codes';
import { slotStart } from '../utils/datetime';
import { notify } from './notification.service';
import { AUDIT, writeAudit } from './audit.service';

type Actor = { userId: string; roles: string[] };

interface CreateReservationInput {
  timeSlotId: string;
  pickupType: 'drop_off' | 'pickup';
  addressId?: string | null;
  notes?: string | null;
  items: Array<{ serviceId: string; quantity: number }>;
}

/**
 * Creates a reservation after locking the slot row. The row lock serialises
 * concurrent capacity checks so the last remaining seat cannot be overbooked.
 */
export async function createReservation(
  customerId: string,
  input: CreateReservationInput,
  ip?: string,
) {
  const serviceIds = [...new Set(input.items.map((i) => i.serviceId))];
  if (serviceIds.length !== input.items.length) {
    throw BadRequest('Layanan duplikat pada reservasi');
  }

  if (input.addressId) {
    const address = await prisma.address.findUnique({ where: { id: input.addressId } });
    if (!address || address.userId !== customerId) throw NotFound('Alamat tidak ditemukan');
  }

  const services = await prisma.service.findMany({
    where: { id: { in: serviceIds }, isActive: true },
  });
  if (services.length !== serviceIds.length) {
    throw BadRequest('Salah satu layanan tidak tersedia atau tidak aktif');
  }

  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "time_slots" WHERE id = ${input.timeSlotId}::uuid FOR UPDATE`;
    const slot = await tx.timeSlot.findUnique({ where: { id: input.timeSlotId } });
    if (!slot) throw NotFound('Slot reservasi tidak ditemukan');
    if (!slot.isAvailable) throw Conflict('Slot reservasi tidak tersedia', 'SLOT_UNAVAILABLE');

    const dateIso = new Date(slot.slotDate).toISOString().slice(0, 10);
    const startTime = new Date(slot.startTime).toISOString().slice(11, 16);
    if (slotStart(dateIso, startTime) <= new Date()) {
      throw Conflict('Slot reservasi sudah lewat', 'SLOT_PASSED');
    }

    const activeCount = await tx.reservation.count({
      where: { timeSlotId: slot.id, status: { in: ['pending', 'confirmed'] } },
    });
    if (activeCount >= slot.capacity) {
      throw Conflict('Kapasitas slot sudah penuh. Silakan pilih slot lain.', 'SLOT_FULL');
    }

    const reservation = await tx.reservation.create({
      data: {
        reservationCode: codeGenerators.reservation(),
        customerId,
        timeSlotId: slot.id,
        addressId: input.addressId ?? null,
        pickupType: input.pickupType,
        notes: input.notes ?? null,
        status: 'pending',
        items: {
          create: input.items.map((item) => ({
            serviceId: item.serviceId,
            quantity: new Prisma.Decimal(item.quantity),
          })),
        },
      },
      include: {
        customer: true,
        timeSlot: true,
        address: true,
        items: { include: { service: true } },
      },
    });

    await writeAudit(
      {
        userId: customerId,
        action: AUDIT.RESERVATION_CREATED,
        entityType: 'reservation',
        entityId: reservation.id,
        metadata: { code: reservation.reservationCode, slotId: slot.id },
        ip,
      },
      tx,
    );
    await notify({
      userId: customerId,
      title: 'Reservasi diterima',
      message: `Reservasi ${reservation.reservationCode} berhasil dibuat dan menunggu konfirmasi admin.`,
      tx,
    });

    return reservation;
  });
}

export async function listMyReservations(customerId: string) {
  return prisma.reservation.findMany({
    where: { customerId },
    orderBy: { createdAt: 'desc' },
    include: {
      timeSlot: true,
      address: true,
      items: { include: { service: true } },
      order: true,
    },
  });
}

export async function getReservation(actor: Actor, id: string) {
  const reservation = await prisma.reservation.findUnique({
    where: { id },
    include: {
      customer: true,
      timeSlot: true,
      address: true,
      items: { include: { service: true } },
      order: true,
    },
  });
  if (!reservation) throw NotFound('Reservasi tidak ditemukan');
  if (actor.roles.includes(ROLES.CUSTOMER) && reservation.customerId !== actor.userId) {
    throw Forbidden('Anda tidak berhak melihat reservasi ini');
  }
  return reservation;
}

export async function cancelReservation(
  actor: Actor,
  id: string,
  ip?: string,
  reason?: string,
) {
  return prisma.$transaction(async (tx) => {
    const reservation = await tx.reservation.findUnique({
      where: { id },
      include: { timeSlot: true, customer: true, order: true },
    });
    if (!reservation) throw NotFound('Reservasi tidak ditemukan');

    const isAdmin = actor.roles.includes(ROLES.ADMIN);
    if (!isAdmin && reservation.customerId !== actor.userId) {
      throw Forbidden('Anda tidak berhak membatalkan reservasi ini');
    }
    if (!['pending', 'confirmed'].includes(reservation.status)) {
      throw Conflict('Reservasi dengan status ini tidak dapat dibatalkan', 'CANCEL_NOT_ALLOWED');
    }
    if (reservation.order) {
      throw Conflict('Reservasi sudah dikonversi menjadi pesanan dan tidak dapat dibatalkan', 'ORDER_EXISTS');
    }

    if (!isAdmin) {
      const dateIso = new Date(reservation.timeSlot.slotDate).toISOString().slice(0, 10);
      const startTime = new Date(reservation.timeSlot.startTime).toISOString().slice(11, 16);
      const startsAt = slotStart(dateIso, startTime);
      const cutoffMs = env.RESERVATION_CANCEL_CUTOFF_HOURS * 3600_000;
      if (startsAt.getTime() - Date.now() < cutoffMs) {
        throw Conflict(
          `Pembatalan paling lambat ${env.RESERVATION_CANCEL_CUTOFF_HOURS} jam sebelum jadwal`,
          'CANCEL_CUTOFF_PASSED',
        );
      }
    }

    const updated = await tx.reservation.update({
      where: { id },
      data: { status: 'cancelled' },
    });

    await writeAudit(
      {
        userId: actor.userId,
        action: AUDIT.RESERVATION_CANCELLED,
        entityType: 'reservation',
        entityId: id,
        metadata: { code: reservation.reservationCode, reason: reason ?? null, byAdmin: isAdmin },
        ip,
      },
      tx,
    );
    await notify({
      userId: reservation.customerId,
      title: 'Reservasi dibatalkan',
      message: `Reservasi ${reservation.reservationCode} telah dibatalkan${isAdmin ? ' oleh admin' : ''}.`,
      tx,
    });

    return updated;
  });
}

export async function confirmReservation(adminId: string, id: string, ip?: string) {
  return prisma.$transaction(async (tx) => {
    const reservation = await tx.reservation.findUnique({
      where: { id },
      include: { timeSlot: true, customer: true },
    });
    if (!reservation) throw NotFound('Reservasi tidak ditemukan');
    if (reservation.status !== 'pending') {
      throw Conflict('Hanya reservasi pending yang dapat dikonfirmasi', 'INVALID_RESERVATION_STATUS');
    }

    const dateIso = new Date(reservation.timeSlot.slotDate).toISOString().slice(0, 10);
    const startTime = new Date(reservation.timeSlot.startTime).toISOString().slice(11, 16);
    if (slotStart(dateIso, startTime) <= new Date()) {
      throw Conflict('Slot reservasi sudah lewat', 'SLOT_PASSED');
    }

    const updated = await tx.reservation.update({ where: { id }, data: { status: 'confirmed' } });
    await writeAudit(
      {
        userId: adminId,
        action: AUDIT.RESERVATION_CONFIRMED,
        entityType: 'reservation',
        entityId: id,
        metadata: { code: reservation.reservationCode },
        ip,
      },
      tx,
    );
    await notify({
      userId: reservation.customerId,
      title: 'Reservasi dikonfirmasi',
      message: `Reservasi ${reservation.reservationCode} sudah dikonfirmasi. Silakan datang sesuai jadwal.`,
      tx,
    });
    return updated;
  });
}

export async function listReservationsForAdmin(filters: {
  status?: string;
  date?: string;
  search?: string;
  page: number;
  limit: number;
  skip: number;
}) {
  const where: Prisma.ReservationWhereInput = {
    ...(filters.status ? { status: filters.status as never } : {}),
    ...(filters.search
      ? {
          OR: [
            { reservationCode: { contains: filters.search, mode: 'insensitive' } },
            { customer: { name: { contains: filters.search, mode: 'insensitive' } } },
            { customer: { email: { contains: filters.search, mode: 'insensitive' } } },
          ],
        }
      : {}),
    ...(filters.date
      ? {
          timeSlot: {
            slotDate: new Date(`${filters.date}T00:00:00.000Z`),
          },
        }
      : {}),
  };

  const [total, rows] = await Promise.all([
    prisma.reservation.count({ where }),
    prisma.reservation.findMany({
      where,
      orderBy: [{ timeSlot: { slotDate: 'asc' } }, { timeSlot: { startTime: 'asc' } }, { createdAt: 'desc' }],
      skip: filters.skip,
      take: filters.limit,
      include: {
        customer: true,
        timeSlot: true,
        address: true,
        items: { include: { service: true } },
        order: true,
      },
    }),
  ]);
  return { total, rows };
}

/** Marks stale pending reservations as expired. Called by the background job and lazily. */
export async function expireStaleReservations() {
  const now = new Date();
  const stale = await prisma.reservation.findMany({
    where: { status: { in: ['pending', 'confirmed'] }, order: { is: null } },
    include: { timeSlot: true },
    take: 500,
  });

  let count = 0;
  for (const reservation of stale) {
    const dateIso = new Date(reservation.timeSlot.slotDate).toISOString().slice(0, 10);
    const startTime = new Date(reservation.timeSlot.startTime).toISOString().slice(11, 16);
    if (slotStart(dateIso, startTime) < now) {
      await prisma.$transaction(async (tx) => {
        await tx.reservation.update({ where: { id: reservation.id }, data: { status: 'expired' } });
        await writeAudit(
          {
            userId: null,
            action: AUDIT.RESERVATION_EXPIRED,
            entityType: 'reservation',
            entityId: reservation.id,
            metadata: { code: reservation.reservationCode },
          },
          tx,
        );
        await notify({
          userId: reservation.customerId,
          title: 'Reservasi kedaluwarsa',
          message: `Reservasi ${reservation.reservationCode} kedaluwarsa karena jadwal telah lewat.`,
          tx,
        });
      });
      count += 1;
    }
  }
  return count;
}

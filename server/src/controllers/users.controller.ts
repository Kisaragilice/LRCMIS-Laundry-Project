import type { Request, Response } from 'express';
import { prisma } from '../config/prisma';
import { publicConfig } from '../utils/serializers';
import { parsePagination, paginationMeta, ok, created } from '../utils/http';
import * as addressService from '../services/address.service';
import * as customerService from '../services/customer.service';
import * as catalogService from '../services/service-catalog.service';
import { addressDto, serviceDto, slotDto, slotTimes } from '../utils/serializers';
import { BadRequest, NotFound } from '../utils/errors';
import { AUDIT, clientIp, writeAudit } from '../services/audit.service';
import { toDateAtUtcMidnight, toTimeAtEpoch } from '../utils/datetime';

export async function getConfig(_req: Request, res: Response) {
  return ok(res, publicConfig());
}

export async function getMe(req: Request, res: Response) {
  const user = await prisma.user.findUnique({
    where: { id: req.auth!.userId },
    include: { roles: { include: { role: true } } },
  });
  if (!user) throw NotFound('Pengguna tidak ditemukan');
  return ok(res, {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    isActive: user.isActive,
    isPrimaryAdmin: user.isPrimaryAdmin,
    deletedAt: user.deletedAt,
    roles: user.roles.map((r) => r.role.name),
    createdAt: user.createdAt,
  });
}

export async function updateMe(req: Request, res: Response) {
  const { updateProfile, sanitizeUser } = await import('../services/auth.service');
  const user = await updateProfile(req.auth!.userId, req.body, clientIp(req));
  return ok(res, { user: sanitizeUser(user) });
}

export async function listAddresses(req: Request, res: Response) {
  const addresses = await addressService.listAddresses(req.auth!.userId);
  return ok(res, addresses.map(addressDto));
}

export async function createAddress(req: Request, res: Response) {
  const address = await addressService.createAddress(req.auth!.userId, req.body);
  return created(res, addressDto(address));
}

export async function updateAddress(req: Request, res: Response) {
  const address = await addressService.updateAddress(req.auth!.userId, req.params.id, req.body);
  return ok(res, addressDto(address));
}

export async function deleteAddress(req: Request, res: Response) {
  const result = await addressService.deleteAddress(req.auth!.userId, req.params.id);
  return ok(res, result);
}

export async function publicServices(_req: Request, res: Response) {
  const services = await catalogService.listPublicServices();
  return ok(res, services.map(serviceDto));
}

export async function adminServices(req: Request, res: Response) {
  const q = req.query as unknown as { isActive?: 'true' | 'false'; search?: string };
  const services = await catalogService.listAllServices({
    isActive: q.isActive === undefined ? undefined : q.isActive === 'true',
    search: q.search,
  });
  return ok(res, services.map((service) => ({ ...serviceDto(service), usageCount: (service as never as { _count: { orderItems: number } })._count?.orderItems ?? 0 })));
}

export async function createService(req: Request, res: Response) {
  const service = await catalogService.createService(req.auth!.userId, req.body, clientIp(req));
  return created(res, serviceDto(service));
}

export async function updateService(req: Request, res: Response) {
  const service = await catalogService.updateService(req.auth!.userId, req.params.id, req.body, clientIp(req));
  return ok(res, serviceDto(service));
}

export async function deactivateService(req: Request, res: Response) {
  const service = await catalogService.deactivateService(req.auth!.userId, req.params.id, clientIp(req));
  return ok(res, serviceDto(service));
}

export async function deleteService(req: Request, res: Response) {
  const result = await catalogService.deleteService(req.auth!.userId, req.params.id, clientIp(req));
  return ok(res, result);
}

export async function customerSlots(req: Request, res: Response) {
  const { from, to, date } = req.query as unknown as { from?: string; to?: string; date?: string };
  const startIso = date ?? from ?? new Date().toISOString().slice(0, 10);
  const endIso = date ?? to ?? new Date(Date.now() + 14 * 86400_000).toISOString().slice(0, 10);
  const slots = await prisma.timeSlot.findMany({
    where: {
      isAvailable: true,
      slotDate: { gte: toDateAtUtcMidnight(startIso), lte: toDateAtUtcMidnight(endIso) },
    },
    orderBy: [{ slotDate: 'asc' }, { startTime: 'asc' }],
    include: {
      _count: { select: { reservations: { where: { status: { in: ['pending', 'confirmed'] } } } } },
    },
  });
  const now = Date.now();
  return ok(
    res,
    slots.map(slotDto).filter((slot) => new Date(slot.startsAt).getTime() > now && slot.remaining > 0),
  );
}

export async function adminSlots(req: Request, res: Response) {
  const { from, to } = req.query as unknown as { from?: string; to?: string };
  const slots = await prisma.timeSlot.findMany({
    where: {
      ...(from ? { slotDate: { gte: toDateAtUtcMidnight(from) } } : {}),
      ...(to ? { slotDate: { lte: toDateAtUtcMidnight(to) } } : {}),
    },
    orderBy: [{ slotDate: 'asc' }, { startTime: 'asc' }],
    include: {
      _count: { select: { reservations: { where: { status: { in: ['pending', 'confirmed'] } } } } },
    },
  });
  return ok(res, slots.map(slotDto));
}

export async function createSlot(req: Request, res: Response) {
  const { slotDate, startTime, endTime, capacity, isAvailable } = req.body;
  const existing = await prisma.timeSlot.findFirst({
    where: { slotDate: toDateAtUtcMidnight(slotDate), startTime: toTimeAtEpoch(startTime) },
  });
  if (existing) throw BadRequest('Slot pada tanggal dan jam tersebut sudah ada');
  const slot = await prisma.timeSlot.create({
    data: {
      slotDate: toDateAtUtcMidnight(slotDate),
      startTime: toTimeAtEpoch(startTime),
      endTime: toTimeAtEpoch(endTime),
      capacity,
      isAvailable: isAvailable ?? true,
    },
  });
  await writeAudit({
    userId: req.auth!.userId,
    action: AUDIT.SLOT_CREATED,
    entityType: 'time_slot',
    entityId: slot.id,
    metadata: { date: slotDate, startTime, capacity },
    ip: clientIp(req),
  });
  return created(res, slotDto(slot));
}

export async function updateSlot(req: Request, res: Response) {
  const existing = await prisma.timeSlot.findUnique({
    where: { id: req.params.id },
    include: { _count: { select: { reservations: { where: { status: { in: ['pending', 'confirmed'] } } } } } },
  });
  if (!existing) throw NotFound('Slot tidak ditemukan');
  if (req.body.capacity !== undefined && req.body.capacity < existing._count.reservations) {
    throw BadRequest(`Kapasitas tidak boleh lebih kecil dari reservasi aktif (${existing._count.reservations})`);
  }
  const slot = await prisma.timeSlot.update({ where: { id: req.params.id }, data: req.body });
  await writeAudit({
    userId: req.auth!.userId,
    action: AUDIT.SLOT_UPDATED,
    entityType: 'time_slot',
    entityId: slot.id,
    metadata: { fields: Object.keys(req.body) },
    ip: clientIp(req),
  });
  return ok(res, slotDto({ ...slot, _count: { reservations: existing._count.reservations } }));
}

export async function deleteSlot(req: Request, res: Response) {
  const existing = await prisma.timeSlot.findUnique({
    where: { id: req.params.id },
    include: { _count: { select: { reservations: true } } },
  });
  if (!existing) throw NotFound('Slot tidak ditemukan');
  if (existing._count.reservations > 0) {
    throw BadRequest('Slot memiliki reservasi dan tidak dapat dihapus. Nonaktifkan slot sebagai gantinya.');
  }
  await prisma.timeSlot.delete({ where: { id: req.params.id } });
  return ok(res, { message: 'Slot berhasil dihapus' });
}

export async function listCustomers(req: Request, res: Response) {
  const q = req.query as unknown as { search?: string; isActive?: 'true' | 'false'; page?: number; limit?: number };
  const { page, limit, skip } = parsePagination(q);
  const result = await customerService.listCustomers({
    search: q.search,
    isActive: q.isActive === undefined ? undefined : q.isActive === 'true',
    page,
    limit,
    skip,
  });
  return ok(res, result.data, paginationMeta(result.total, page, limit));
}

export async function getCustomer(req: Request, res: Response) {
  const user = await customerService.getCustomerDetail(req.params.id);
  return ok(res, {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    isActive: user.isActive,
    createdAt: user.createdAt,
    addresses: user.addresses.map(addressDto),
    orders: user.orders.map((order) => ({
      id: order.id,
      orderCode: order.orderCode,
      orderStatus: order.orderStatus,
      paymentStatus: order.paymentStatus,
      totalAmount: Number(order.totalAmount),
      createdAt: order.createdAt,
    })),
    reservations: user.reservations.map((reservation) => ({
      id: reservation.id,
      reservationCode: reservation.reservationCode,
      status: reservation.status,
      pickupType: reservation.pickupType,
      timeSlot: { id: reservation.timeSlotId, ...slotTimes(reservation.timeSlot) },
      itemCount: reservation.items.length,
      createdAt: reservation.createdAt,
    })),
    reviews: user.reviews.map((review) => ({
      id: review.id,
      rating: review.rating,
      comment: review.comment,
      createdAt: review.createdAt,
    })),
  });
}

export async function setCustomerStatus(req: Request, res: Response) {
  const updated = await customerService.setCustomerActive(
    req.auth!.userId,
    req.params.id,
    req.body.isActive,
    clientIp(req),
  );
  return ok(res, { id: updated.id, isActive: updated.isActive });
}

export async function listStaff(_req: Request, res: Response) {
  return ok(res, await customerService.listStaffAndCouriers());
}

import { Prisma, type OrderStatus } from '@prisma/client';
import { prisma } from '../config/prisma';
import { env } from '../config/env';
import { ROLES } from '../config/constants';
import { BadRequest, Conflict, Forbidden, NotFound } from '../utils/errors';
import { billableWeight, money } from '../utils/money';
import { codeGenerators } from '../utils/codes';
import { notify } from './notification.service';
import { AUDIT, writeAudit } from './audit.service';
import { evaluatePromotion } from './promotion.service';

type Actor = { userId: string; roles: string[] };

const orderInclude = {
  customer: true,
  assignedStaff: true,
  items: true,
  statusHistory: { include: { user: true }, orderBy: { createdAt: 'asc' as const } },
  payments: {
    include: { verifiedByUser: true },
    orderBy: { createdAt: 'desc' as const },
  },
  deliveryTasks: { include: { courier: true }, orderBy: { createdAt: 'asc' as const } },
  reservation: {
    include: {
      timeSlot: true,
      address: true,
      items: { include: { service: true } },
    },
  },
  review: true,
} satisfies Prisma.OrderInclude;

const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: 'Menunggu diterima',
  received: 'Cucian diterima',
  washing: 'Sedang dicuci',
  drying: 'Sedang dikeringkan',
  ironing: 'Sedang disetrika',
  packaging: 'Sedang dikemas',
  ready: 'Siap diambil/diantar',
  delivering: 'Sedang diantar',
  completed: 'Selesai',
  cancelled: 'Dibatalkan',
  on_hold: 'Ditunda',
};

// Confirmed transitions. `received` is only reachable through POST /receive.
const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ['cancelled'],
  received: ['washing', 'on_hold', 'cancelled'],
  washing: ['drying', 'on_hold'],
  drying: ['ironing', 'on_hold'],
  ironing: ['packaging', 'on_hold'],
  packaging: ['ready', 'on_hold'],
  ready: ['delivering', 'completed', 'on_hold'],
  delivering: ['completed', 'on_hold'],
  on_hold: ['received', 'washing', 'cancelled'],
  completed: [],
  cancelled: [],
};

const STAFF_TARGETS: OrderStatus[] = ['washing', 'drying', 'ironing', 'packaging', 'ready', 'on_hold'];

async function loadOrder(id: string, client = prisma) {
  const order = await client.order.findUnique({ where: { id }, include: orderInclude });
  if (!order) throw NotFound('Pesanan tidak ditemukan');
  return order;
}

export function assertCanViewOrder(
  actor: Actor,
  order: { customerId: string; assignedStaffId: string | null; deliveryTasks: Array<{ courierId: string | null }> },
) {
  if (actor.roles.some((role) => [ROLES.ADMIN, ROLES.OWNER].includes(role as never))) return;
  if (actor.roles.includes(ROLES.CUSTOMER) && order.customerId === actor.userId) return;
  if (actor.roles.includes(ROLES.STAFF) && order.assignedStaffId === actor.userId) return;
  if (
    actor.roles.includes(ROLES.COURIER) &&
    order.deliveryTasks.some((task) => task.courierId === actor.userId)
  ) {
    return;
  }
  throw Forbidden('Anda tidak berhak melihat pesanan ini');
}

export async function getOrder(actor: Actor, id: string) {
  const order = await loadOrder(id);
  assertCanViewOrder(actor, order);
  return order;
}

export async function listMyOrders(customerId: string) {
  return prisma.order.findMany({
    where: { customerId },
    orderBy: { createdAt: 'desc' },
    include: orderInclude,
    take: 100,
  });
}

export async function listOrdersForStaff(staffId: string) {
  return prisma.order.findMany({
    where: { assignedStaffId: staffId },
    orderBy: [{ orderStatus: 'asc' }, { createdAt: 'desc' }],
    include: orderInclude,
    take: 100,
  });
}

export async function listOrdersForAdmin(filters: {
  orderStatus?: string;
  paymentStatus?: string;
  search?: string;
  from?: string;
  to?: string;
  page: number;
  limit: number;
  skip: number;
}) {
  const where: Prisma.OrderWhereInput = {
    ...(filters.orderStatus ? { orderStatus: filters.orderStatus as OrderStatus } : {}),
    ...(filters.paymentStatus ? { paymentStatus: filters.paymentStatus as never } : {}),
    ...(filters.search
      ? {
          OR: [
            { orderCode: { contains: filters.search, mode: 'insensitive' } },
            { customer: { name: { contains: filters.search, mode: 'insensitive' } } },
            { customer: { email: { contains: filters.search, mode: 'insensitive' } } },
          ],
        }
      : {}),
    ...(filters.from || filters.to
      ? {
          createdAt: {
            ...(filters.from ? { gte: new Date(`${filters.from}T00:00:00+07:00`) } : {}),
            ...(filters.to ? { lte: new Date(`${filters.to}T23:59:59.999+07:00`) } : {}),
          },
        }
      : {}),
  };

  const [total, rows] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: filters.skip,
      take: filters.limit,
      include: orderInclude,
    }),
  ]);
  return { total, rows };
}

/** Converts a confirmed reservation into a draft order with price snapshots. */
export async function createOrderFromReservation(
  adminId: string,
  reservationId: string,
  notes: string | null | undefined,
  ip?: string,
) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "reservations" WHERE id = ${reservationId}::uuid FOR UPDATE`;
    const reservation = await tx.reservation.findUnique({
      where: { id: reservationId },
      include: { items: { include: { service: true } }, order: true },
    });
    if (!reservation) throw NotFound('Reservasi tidak ditemukan');
    if (reservation.status !== 'confirmed') {
      throw Conflict('Reservasi harus dikonfirmasi sebelum membuat pesanan', 'RESERVATION_NOT_CONFIRMED');
    }
    if (reservation.order) {
      throw Conflict('Reservasi ini sudah memiliki pesanan', 'ORDER_ALREADY_EXISTS');
    }
    if (reservation.items.length === 0) throw BadRequest('Reservasi tidak memiliki layanan');
    if (reservation.items.some((item) => !item.service.isActive)) {
      throw BadRequest('Salah satu layanan pada reservasi sudah tidak aktif');
    }

    let initialSubtotal = new Prisma.Decimal(0);
    const itemData = reservation.items.map((item) => {
      const unit = item.service.pricingUnit;
      const quantity = unit === 'kg' ? new Prisma.Decimal(0) : item.quantity;
      const lineTotal = unit === 'kg' ? new Prisma.Decimal(0) : money(item.service.price.mul(quantity));
      if (unit !== 'kg') initialSubtotal = initialSubtotal.add(lineTotal);
      return {
        serviceId: item.serviceId,
        serviceNameSnapshot: item.service.name,
        priceSnapshot: item.service.price,
        quantity,
        unit,
        lineTotal,
      };
    });

    const order = await tx.order.create({
      data: {
        orderCode: codeGenerators.order(),
        reservationId,
        customerId: reservation.customerId,
        orderStatus: 'pending',
        paymentStatus: 'unpaid',
        subtotal: money(initialSubtotal),
        notes: notes ?? null,
        items: { create: itemData },
        statusHistory: {
          create: { oldStatus: null, newStatus: 'pending', changedBy: adminId, notes: 'Pesanan dibuat dari reservasi' },
        },
      },
      include: orderInclude,
    });

    await writeAudit(
      {
        userId: adminId,
        action: AUDIT.ORDER_CREATED,
        entityType: 'order',
        entityId: order.id,
        metadata: { orderCode: order.orderCode, reservationId },
        ip,
      },
      tx,
    );
    await notify({
      userId: order.customerId,
      orderId: order.id,
      title: 'Pesanan dibuat',
      message: `Pesanan ${order.orderCode} dibuat dari reservasi ${reservation.reservationCode}. Cucian akan ditimbang saat diterima.`,
      tx,
    });

    return order;
  });
}

export async function receiveOrder(
  adminId: string,
  orderId: string,
  input: {
    actualWeight?: number;
    itemQuantities?: Array<{ serviceId: string; quantity: number }>;
    promotionCode?: string | null;
    notes?: string | null;
  },
  ip?: string,
) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "orders" WHERE id = ${orderId}::uuid FOR UPDATE`;
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
        reservation: { include: { timeSlot: true, address: true } },
      },
    });
    if (!order) throw NotFound('Pesanan tidak ditemukan');
    if (order.orderStatus !== 'pending') {
      throw Conflict('Cucian hanya dapat diterima pada pesanan berstatus pending', 'ORDER_ALREADY_RECEIVED');
    }
    if (!order.reservation) throw BadRequest('Pesanan tidak memiliki reservasi');
    if (!order.items.length) throw BadRequest('Pesanan tidak memiliki rincian layanan');

    const hasWeightService = order.items.some((item) => item.unit === 'kg');
    if (hasWeightService && !input.actualWeight) {
      throw BadRequest('Berat aktual wajib diisi untuk layanan berbasis kilogram', [
        { field: 'actualWeight', message: 'Masukkan berat cucian' },
      ]);
    }

    const chargedWeight = hasWeightService
      ? billableWeight(input.actualWeight!, env.MIN_WEIGHT_KG, env.WEIGHT_ROUNDING_KG)
      : null;

    const quantityMap = new Map(
      (input.itemQuantities ?? []).map((item) => [item.serviceId, new Prisma.Decimal(item.quantity)]),
    );
    for (const serviceId of quantityMap.keys()) {
      if (!order.items.some((item) => item.serviceId === serviceId)) {
        throw BadRequest('Terdapat layanan yang bukan bagian dari pesanan ini');
      }
    }

    let subtotal = new Prisma.Decimal(0);
    const updates = order.items.map((item) => {
      let quantity: Prisma.Decimal;
      if (item.unit === 'kg') {
        quantity = chargedWeight!.toDecimalPlaces(2);
      } else {
        quantity = quantityMap.get(item.serviceId) ?? item.quantity;
        if (quantity.lessThanOrEqualTo(0)) {
          throw BadRequest('Jumlah item harus lebih dari 0');
        }
      }
      const lineTotal = money(item.priceSnapshot.mul(quantity));
      subtotal = subtotal.add(lineTotal);
      return { id: item.id, quantity, lineTotal };
    });

    let discountAmount = new Prisma.Decimal(0);
    let promotionId: string | null = null;
    let promotionCode: string | null = null;
    if (input.promotionCode) {
      const existingRedemption = await tx.promotionRedemption.findUnique({ where: { orderId } });
      if (existingRedemption) throw Conflict('Pesanan ini sudah menggunakan voucher', 'VOUCHER_ALREADY_APPLIED');
      const evaluation = await evaluatePromotion(tx, {
        code: input.promotionCode,
        userId: order.customerId,
        subtotal,
      });
      discountAmount = evaluation.discountAmount;
      promotionId = evaluation.promotionId;
      promotionCode = evaluation.code;
    }

    const deliveryFee = order.reservation.pickupType === 'pickup'
      ? money(env.DEFAULT_DELIVERY_FEE)
      : new Prisma.Decimal(0);
    const totalAmount = money(subtotal.sub(Prisma.Decimal.min(discountAmount, subtotal)).add(deliveryFee));

    for (const update of updates) {
      await tx.orderItem.update({
        where: { id: update.id },
        data: { quantity: update.quantity, lineTotal: update.lineTotal },
      });
    }

    if (promotionId) {
      await tx.promotionRedemption.create({
        data: {
          promotionId,
          userId: order.customerId,
          orderId,
          discountAmount,
        },
      });
    }

    await tx.order.update({
      where: { id: orderId },
      data: {
        actualWeight: chargedWeight,
        subtotal: money(subtotal),
        discountAmount,
        deliveryFee,
        totalAmount,
        orderStatus: 'received',
        receivedAt: new Date(),
        notes: input.notes ?? order.notes,
      },
      include: orderInclude,
    });

    await tx.orderStatusHistory.create({
      data: {
        orderId,
        oldStatus: 'pending',
        newStatus: 'received',
        changedBy: adminId,
        notes: input.notes ?? 'Cucian diterima dan ditimbang',
      },
    });

    const address = order.reservation.address;
    if (order.reservation.pickupType === 'pickup') {
      const estimatedHours = 24;
      await tx.deliveryTask.create({
        data: {
          orderId,
          taskType: 'delivery',
          status: 'assigned',
          scheduledAt: new Date(Date.now() + estimatedHours * 3600_000),
          addressSnapshot: address?.addressText ?? null,
          contactPhone: address?.phone ?? null,
          notes: 'Pengantaran setelah pesanan selesai diproses',
        },
      });
    }

    await writeAudit(
      {
        userId: adminId,
        action: AUDIT.ORDER_RECEIVED,
        entityType: 'order',
        entityId: orderId,
        metadata: {
          orderCode: order.orderCode,
          actualWeight: chargedWeight ? Number(chargedWeight) : null,
          subtotal: Number(subtotal),
          discount: Number(discountAmount),
          total: Number(totalAmount),
          promotionCode,
        },
        ip,
      },
      tx,
    );
    await notify({
      userId: order.customerId,
      orderId,
      title: 'Cucian diterima',
      message: `Pesanan ${order.orderCode} telah ditimbang (${Number(chargedWeight ?? 0)} kg). Total tagihan Rp${Number(totalAmount).toLocaleString('id-ID')}.`,
      tx,
    });

    return (await tx.order.findUnique({ where: { id: orderId }, include: orderInclude }))!;
  });
}

export async function updateOrderStatus(
  actor: Actor,
  orderId: string,
  target: OrderStatus,
  notes: string | null | undefined,
  ip?: string,
) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "orders" WHERE id = ${orderId}::uuid FOR UPDATE`;
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: { deliveryTasks: true, customer: true, items: true },
    });
    if (!order) throw NotFound('Pesanan tidak ditemukan');

    const isAdmin = actor.roles.includes(ROLES.ADMIN);
    const isStaff = actor.roles.includes(ROLES.STAFF);
    if (!isAdmin && !isStaff) throw Forbidden('Hanya admin atau staff yang dapat mengubah status pesanan');
    if (isStaff && order.assignedStaffId !== actor.userId) {
      throw Forbidden('Pesanan ini tidak ditugaskan kepada Anda');
    }
    if (isStaff && !STAFF_TARGETS.includes(target)) {
      throw Forbidden('Staff tidak berwenang mengubah status ke ' + target);
    }

    if (!TRANSITIONS[order.orderStatus].includes(target)) {
      throw Conflict(
        `Transisi status dari ${order.orderStatus} ke ${target} tidak diizinkan`,
        'INVALID_STATUS_TRANSITION',
      );
    }

    if (target === 'ready') {
      if (!order.receivedAt || order.items.length === 0) {
        throw Conflict('Pesanan belum diterima/ditimbang', 'ORDER_NOT_READY');
      }
    }

    if (target === 'completed') {
      if (order.paymentStatus !== 'paid') {
        throw Conflict('Pesanan belum lunas sehingga tidak dapat diselesaikan', 'PAYMENT_REQUIRED');
      }
      if (order.reservationId) {
        const reservation = await tx.reservation.findUnique({ where: { id: order.reservationId } });
        if (reservation?.pickupType === 'pickup') {
          const deliveryDone = order.deliveryTasks.some(
            (task) => task.taskType === 'delivery' && task.status === 'completed',
          );
          if (!deliveryDone) {
            throw Conflict('Serah terima pengantaran belum dikonfirmasi', 'DELIVERY_NOT_COMPLETED');
          }
        }
      }
    }

    const now = new Date();
    await tx.order.update({
      where: { id: orderId },
      data: {
        orderStatus: target,
        ...(target === 'completed' ? { completedAt: now } : {}),
      },
    });

    await tx.orderStatusHistory.create({
      data: {
        orderId,
        oldStatus: order.orderStatus,
        newStatus: target,
        changedBy: actor.userId,
        notes: notes ?? null,
      },
    });

    await writeAudit(
      {
        userId: actor.userId,
        action: AUDIT.ORDER_STATUS_CHANGED,
        entityType: 'order',
        entityId: orderId,
        metadata: { oldStatus: order.orderStatus, newStatus: target, notes: notes ?? null },
        ip,
      },
      tx,
    );
    await notify({
      userId: order.customerId,
      orderId,
      title: `Status pesanan: ${STATUS_LABEL[target]}`,
      message: `Pesanan ${order.orderCode} kini berstatus "${STATUS_LABEL[target]}".${notes ? ` Catatan: ${notes}` : ''}`,
      tx,
    });

    return (await tx.order.findUnique({ where: { id: orderId }, include: orderInclude }))!;
  });
}

export async function assignStaff(
  actor: Actor,
  orderId: string,
  staffId: string | null,
  ip?: string,
) {
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { customer: true } });
  if (!order) throw NotFound('Pesanan tidak ditemukan');
  if (['completed', 'cancelled'].includes(order.orderStatus)) {
    throw Conflict('Pesanan yang sudah selesai/dibatalkan tidak dapat diubah penugasannya');
  }

  if (staffId) {
    const staff = await prisma.user.findFirst({
      where: { id: staffId, isActive: true, roles: { some: { role: { name: ROLES.STAFF } } } },
    });
    if (!staff) throw BadRequest('Staff tidak ditemukan atau tidak aktif');
  }

  const updated = await prisma.order.update({
    where: { id: orderId },
    data: { assignedStaffId: staffId },
    include: orderInclude,
  });
  await writeAudit({
    userId: actor.userId,
    action: AUDIT.ORDER_ASSIGNED,
    entityType: 'order',
    entityId: orderId,
    metadata: { staffId },
    ip,
  });
  if (staffId) {
    await notify({
      userId: staffId,
      orderId,
      title: 'Tugas baru',
      message: `Anda ditugaskan menangani pesanan ${order.orderCode}.`,
    });
  }
  return updated;
}

export async function addOrderNote(actor: Actor, orderId: string, note: string, ip?: string) {
  const order = await loadOrder(orderId);
  if (actor.roles.includes(ROLES.STAFF) && order.assignedStaffId !== actor.userId) {
    throw Forbidden('Pesanan ini tidak ditugaskan kepada Anda');
  }
  if (!actor.roles.some((role) => [ROLES.ADMIN, ROLES.STAFF].includes(role as never))) {
    throw Forbidden();
  }
  const created = await prisma.orderNote.create({
    data: { orderId, userId: actor.userId, note },
  });
  await writeAudit({
    userId: actor.userId,
    action: AUDIT.ORDER_NOTE_ADDED,
    entityType: 'order',
    entityId: orderId,
    metadata: { noteId: created.id },
    ip,
  });
  return created;
}

export async function listOrderNotes(orderId: string) {
  return prisma.orderNote.findMany({
    where: { orderId },
    include: { user: true },
    orderBy: { createdAt: 'desc' },
  });
}

export async function completeDeliveryOrder(actor: Actor, orderId: string) {
  return updateOrderStatus(actor, orderId, 'completed', 'Serah terima pengantaran dikonfirmasi kurir');
}

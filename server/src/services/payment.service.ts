import { PaymentRecordStatus, Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { BadRequest, Conflict, NotFound } from '../utils/errors';
import { money } from '../utils/money';
import { AUDIT, writeAudit } from './audit.service';
import { notify } from './notification.service';

async function recomputeOrderPaymentStatus(tx: Prisma.TransactionClient, orderId: string) {
  const order = await tx.order.findUnique({ where: { id: orderId } });
  if (!order) throw NotFound('Pesanan tidak ditemukan');

  const [paidAgg, refundedCount] = await Promise.all([
    tx.payment.aggregate({
      where: { orderId, status: 'paid' },
      _sum: { amount: true },
    }),
    tx.payment.count({ where: { orderId, status: 'refunded' } }),
  ]);

  const paid = paidAgg._sum.amount ?? new Prisma.Decimal(0);
  let status: 'unpaid' | 'partial' | 'paid' | 'refunded';
  if (paid.greaterThanOrEqualTo(order.totalAmount) && order.totalAmount.greaterThan(0)) {
    status = 'paid';
  } else if (paid.greaterThan(0)) {
    status = 'partial';
  } else if (refundedCount > 0) {
    status = 'refunded';
  } else {
    status = 'unpaid';
  }

  await tx.order.update({ where: { id: orderId }, data: { paymentStatus: status } });
  return { status, paid };
}

export async function recordPayment(
  adminId: string,
  orderId: string,
  input: {
    amount: number;
    method: 'cash' | 'bank_transfer';
    referenceCode?: string | null;
    notes?: string | null;
  },
  idempotencyKey: string,
  ip?: string,
) {
  if (!idempotencyKey || idempotencyKey.length < 8) {
    throw BadRequest('Header Idempotency-Key wajib diisi minimal 8 karakter');
  }
  if (input.method === 'bank_transfer' && !input.referenceCode) {
    throw BadRequest('Referensi transfer wajib diisi untuk pembayaran bank transfer', [
      { field: 'referenceCode', message: 'Isi nomor referensi transfer' },
    ]);
  }

  const existing = await prisma.payment.findUnique({
    where: { idempotencyKey },
    include: { order: true },
  });
  if (existing) {
    if (existing.orderId !== orderId || Number(existing.amount) !== Number(input.amount)) {
      throw Conflict('Idempotency-Key sudah dipakai untuk transaksi lain', 'IDEMPOTENCY_MISMATCH');
    }
    return { payment: existing, duplicate: true, order: existing.order };
  }

  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "orders" WHERE id = ${orderId}::uuid FOR UPDATE`;
    const order = await tx.order.findUnique({ where: { id: orderId } });
    if (!order) throw NotFound('Pesanan tidak ditemukan');
    if (order.orderStatus === 'cancelled') {
      throw Conflict('Pesanan dibatalkan tidak dapat menerima pembayaran', 'ORDER_CANCELLED');
    }
    if (order.totalAmount.lessThanOrEqualTo(0)) {
      throw Conflict('Total tagihan belum ditetapkan. Terima dan timbang cucian terlebih dahulu.', 'TOTAL_NOT_SET');
    }

    const existingPayments = await tx.payment.findMany({
      where: { orderId, status: { in: ['paid', 'pending'] } },
    });
    const committed = existingPayments.reduce((sum, p) => sum.add(p.amount), new Prisma.Decimal(0));
    const amount = money(input.amount);
    if (committed.add(amount).greaterThan(order.totalAmount)) {
      throw Conflict('Jumlah pembayaran melebihi sisa tagihan', 'OVERPAYMENT');
    }

    const isCash = input.method === 'cash';
    const payment = await tx.payment.create({
      data: {
        orderId,
        amount,
        method: input.method,
        status: isCash ? 'paid' : 'pending',
        referenceCode: input.referenceCode ?? null,
        idempotencyKey,
        recordedBy: adminId,
        verifiedBy: isCash ? adminId : null,
        verifiedAt: isCash ? new Date() : null,
        paidAt: isCash ? new Date() : null,
        notes: input.notes ?? null,
      },
    });

    const status = isCash ? await recomputeOrderPaymentStatus(tx, orderId) : null;

    await writeAudit(
      {
        userId: adminId,
        action: AUDIT.PAYMENT_CREATED,
        entityType: 'payment',
        entityId: payment.id,
        metadata: {
          orderId,
          amount: Number(amount),
          method: input.method,
          status: payment.status,
          referenceCode: payment.referenceCode,
        },
        ip,
      },
      tx,
    );
    await notify({
      userId: order.customerId,
      orderId,
      title: isCash ? 'Pembayaran tunai dicatat' : 'Pembayaran transfer menunggu verifikasi',
      message: isCash
        ? `Pembayaran Rp${Number(amount).toLocaleString('id-ID')} untuk pesanan ${order.orderCode} telah diterima.`
        : `Bukti transfer Rp${Number(amount).toLocaleString('id-ID')} untuk pesanan ${order.orderCode} telah dicatat dan menunggu verifikasi admin.`,
      tx,
    });

    return { payment, duplicate: false, order: status ? { ...order, paymentStatus: status.status } : order };
  });
}

export async function verifyPayment(adminId: string, paymentId: string, notes: string | null, ip?: string) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "payments" WHERE id = ${paymentId}::uuid FOR UPDATE`;
    const payment = await tx.payment.findUnique({ where: { id: paymentId }, include: { order: true } });
    if (!payment) throw NotFound('Pembayaran tidak ditemukan');
    if (payment.status !== 'pending') {
      throw Conflict('Hanya pembayaran pending yang dapat diverifikasi', 'PAYMENT_NOT_PENDING');
    }
    await tx.$queryRaw`SELECT id FROM "orders" WHERE id = ${payment.orderId}::uuid FOR UPDATE`;
    const order = await tx.order.findUnique({ where: { id: payment.orderId } });
    if (!order) throw NotFound('Pesanan tidak ditemukan');
    if (order.orderStatus === 'cancelled') {
      throw Conflict('Pesanan dibatalkan tidak dapat menerima pembayaran', 'ORDER_CANCELLED');
    }

    const paidAgg = await tx.payment.aggregate({
      where: { orderId: order.id, status: 'paid' },
      _sum: { amount: true },
    });
    const paid = paidAgg._sum.amount ?? new Prisma.Decimal(0);
    if (paid.add(payment.amount).greaterThan(order.totalAmount)) {
      throw Conflict('Verifikasi melebihi total tagihan', 'OVERPAYMENT');
    }

    const updated = await tx.payment.update({
      where: { id: paymentId },
      data: {
        status: 'paid',
        verifiedBy: adminId,
        verifiedAt: new Date(),
        paidAt: new Date(),
        notes: notes ?? payment.notes,
      },
    });
    const status = await recomputeOrderPaymentStatus(tx, order.id);

    await writeAudit(
      {
        userId: adminId,
        action: AUDIT.PAYMENT_VERIFIED,
        entityType: 'payment',
        entityId: paymentId,
        metadata: { orderId: order.id, amount: Number(payment.amount), paymentStatus: status.status },
        ip,
      },
      tx,
    );
    await notify({
      userId: order.customerId,
      orderId: order.id,
      title: 'Pembayaran terverifikasi',
      message: `Pembayaran Rp${Number(payment.amount).toLocaleString('id-ID')} untuk pesanan ${order.orderCode} telah diverifikasi.`,
      tx,
    });

    return { payment: updated, orderPaymentStatus: status.status, paidAmount: Number(status.paid) };
  });
}

export async function rejectPayment(adminId: string, paymentId: string, reason: string, ip?: string) {
  return prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findUnique({ where: { id: paymentId }, include: { order: true } });
    if (!payment) throw NotFound('Pembayaran tidak ditemukan');
    if (payment.status !== 'pending') {
      throw Conflict('Hanya pembayaran pending yang dapat ditolak', 'PAYMENT_NOT_PENDING');
    }
    const updated = await tx.payment.update({
      where: { id: paymentId },
      data: { status: 'failed', notes: reason, verifiedBy: adminId, verifiedAt: new Date() },
    });
    const status = await recomputeOrderPaymentStatus(tx, payment.orderId);

    await writeAudit(
      {
        userId: adminId,
        action: AUDIT.PAYMENT_REJECTED,
        entityType: 'payment',
        entityId: paymentId,
        metadata: { orderId: payment.orderId, reason },
        ip,
      },
      tx,
    );
    await notify({
      userId: payment.order.customerId,
      orderId: payment.orderId,
      title: 'Pembayaran ditolak',
      message: `Pembayaran untuk pesanan ${payment.order.orderCode} ditolak. Alasan: ${reason}`,
      tx,
    });

    return { payment: updated, orderPaymentStatus: status.status };
  });
}

export async function refundPayment(adminId: string, paymentId: string, reason: string, ip?: string) {
  return prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findUnique({ where: { id: paymentId }, include: { order: true } });
    if (!payment) throw NotFound('Pembayaran tidak ditemukan');
    if (payment.status !== 'paid') {
      throw Conflict('Hanya pembayaran lunas yang dapat direfund', 'PAYMENT_NOT_PAID');
    }
    const updated = await tx.payment.update({
      where: { id: paymentId },
      data: {
        status: 'refunded',
        refundedAt: new Date(),
        refundNote: reason,
        notes: payment.notes ? `${payment.notes}\nRefund: ${reason}` : `Refund: ${reason}`,
      },
    });
    const status = await recomputeOrderPaymentStatus(tx, payment.orderId);

    await writeAudit(
      {
        userId: adminId,
        action: AUDIT.PAYMENT_REFUNDED,
        entityType: 'payment',
        entityId: paymentId,
        metadata: { orderId: payment.orderId, reason, amount: Number(payment.amount) },
        ip,
      },
      tx,
    );
    await notify({
      userId: payment.order.customerId,
      orderId: payment.orderId,
      title: 'Refund dicatat',
      message: `Pembayaran Rp${Number(payment.amount).toLocaleString('id-ID')} untuk pesanan ${payment.order.orderCode} telah direfund. Alasan: ${reason}`,
      tx,
    });

    return { payment: updated, orderPaymentStatus: status.status };
  });
}

export async function listPaymentsForOrder(actor: { userId: string; roles: string[] }, orderId: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw NotFound('Pesanan tidak ditemukan');
  const privileged = actor.roles.some((r) => ['admin', 'owner'].includes(r));
  if (!privileged && order.customerId !== actor.userId) {
    throw NotFound('Pesanan tidak ditemukan');
  }
  return prisma.payment.findMany({
    where: { orderId },
    include: { verifiedByUser: true },
    orderBy: { createdAt: 'desc' },
  });
}

export async function listPaymentsForCustomer(
  userId: string,
  filters: { status?: PaymentRecordStatus; page: number; limit: number; skip: number },
) {
  const where: Prisma.PaymentWhereInput = {
    order: { customerId: userId },
    ...(filters.status ? { status: filters.status } : {}),
  };
  const [total, rows] = await Promise.all([
    prisma.payment.count({ where }),
    prisma.payment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: filters.skip,
      take: filters.limit,
      include: {
        verifiedByUser: true,
        order: { include: { customer: true } },
      },
    }),
  ]);
  return { total, rows };
}

export async function listPaymentsForAdmin(filters: {
  status?: PaymentRecordStatus;
  method?: 'cash' | 'bank_transfer' | 'payment_gateway';
  search?: string;
  page: number;
  limit: number;
  skip: number;
}) {
  const where: Prisma.PaymentWhereInput = {
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.method ? { method: filters.method } : {}),
    ...(filters.search
      ? {
          OR: [
            { referenceCode: { contains: filters.search, mode: 'insensitive' } },
            { order: { orderCode: { contains: filters.search, mode: 'insensitive' } } },
            { order: { customer: { name: { contains: filters.search, mode: 'insensitive' } } } },
          ],
        }
      : {}),
  };
  const [total, rows] = await Promise.all([
    prisma.payment.count({ where }),
    prisma.payment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: filters.skip,
      take: filters.limit,
      include: {
        verifiedByUser: true,
        order: { include: { customer: true } },
      },
    }),
  ]);
  return { total, rows };
}

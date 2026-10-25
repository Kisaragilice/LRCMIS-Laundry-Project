import { prisma } from '../config/prisma';
import { BadRequest, Conflict, NotFound } from '../utils/errors';
import { AUDIT, writeAudit } from './audit.service';
import { notify } from './notification.service';
import { codeGenerators } from '../utils/codes';

export async function createReview(
  customerId: string,
  orderId: string,
  input: { rating: number; comment?: string | null },
  ip?: string,
) {
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { review: true } });
  if (!order) throw NotFound('Pesanan tidak ditemukan');
  if (order.customerId !== customerId) throw NotFound('Pesanan tidak ditemukan');
  if (order.orderStatus !== 'completed') {
    throw Conflict('Ulasan hanya dapat diberikan untuk pesanan yang selesai', 'ORDER_NOT_COMPLETED');
  }
  if (order.review) throw Conflict('Pesanan ini sudah memiliki ulasan', 'REVIEW_EXISTS');

  const review = await prisma.review.create({
    data: { orderId, userId: customerId, rating: input.rating, comment: input.comment ?? null },
  });
  await writeAudit({
    userId: customerId,
    action: AUDIT.REVIEW_CREATED,
    entityType: 'review',
    entityId: review.id,
    metadata: { orderId, rating: input.rating },
    ip,
  });
  return review;
}

export async function listFeaturedReviews(limit = 6) {
  const reviews = await prisma.review.findMany({
    where: { rating: { gte: 4 }, comment: { not: null } },
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: {
      user: { select: { name: true } },
      order: { select: { orderCode: true, items: { select: { serviceNameSnapshot: true } } } },
    },
  });
  return reviews.map((review) => ({
    id: review.id,
    rating: review.rating,
    comment: review.comment,
    customerName: review.user.name.split(' ')[0],
    service: review.order.items[0]?.serviceNameSnapshot ?? 'Laundry',
    createdAt: review.createdAt,
  }));
}

export async function listReviewsForAdmin(filters: { rating?: number; page: number; limit: number; skip: number }) {
  const where = filters.rating ? { rating: filters.rating } : {};
  const [total, rows] = await Promise.all([
    prisma.review.count({ where }),
    prisma.review.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: filters.skip,
      take: filters.limit,
      include: {
        user: { select: { id: true, name: true, email: true } },
        order: { select: { id: true, orderCode: true, items: { select: { serviceNameSnapshot: true } } } },
      },
    }),
  ]);
  const aggregate = await prisma.review.aggregate({ _avg: { rating: true }, _count: { _all: true } });
  return {
    total,
    rows,
    averageRating: aggregate._avg.rating ? Number(aggregate._avg.rating.toFixed(2)) : null,
    totalReviews: aggregate._count._all,
  };
}

export async function createComplaint(
  customerId: string,
  input: { orderId?: string | null; subject: string; description: string; priority?: 'low' | 'normal' | 'high' },
  ip?: string,
) {
  if (input.orderId) {
    const order = await prisma.order.findUnique({ where: { id: input.orderId } });
    if (!order || order.customerId !== customerId) throw NotFound('Pesanan tidak ditemukan');
  }
  const complaint = await prisma.complaint.create({
    data: {
      code: codeGenerators.complaint(),
      customerId,
      orderId: input.orderId ?? null,
      subject: input.subject,
      description: input.description,
      priority: input.priority ?? 'normal',
    },
  });
  await writeAudit({
    userId: customerId,
    action: AUDIT.COMPLAINT_CREATED,
    entityType: 'complaint',
    entityId: complaint.id,
    metadata: { code: complaint.code, orderId: complaint.orderId },
    ip,
  });
  return complaint;
}

export async function listMyComplaints(customerId: string) {
  return prisma.complaint.findMany({
    where: { customerId },
    orderBy: { createdAt: 'desc' },
    include: {
      order: { select: { id: true, orderCode: true } },
      followUps: { include: { user: { select: { name: true } } }, orderBy: { createdAt: 'asc' } },
    },
  });
}

export async function listComplaintsForAdmin(filters: { status?: string; page: number; limit: number; skip: number }) {
  const where = filters.status ? { status: filters.status as never } : {};
  const [total, rows] = await Promise.all([
    prisma.complaint.count({ where }),
    prisma.complaint.findMany({
      where,
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      skip: filters.skip,
      take: filters.limit,
      include: {
        customer: { select: { id: true, name: true, email: true, phone: true } },
        order: { select: { id: true, orderCode: true } },
        followUps: { include: { user: { select: { name: true } } }, orderBy: { createdAt: 'asc' } },
      },
    }),
  ]);
  return { total, rows };
}

export async function updateComplaint(
  adminId: string,
  complaintId: string,
  input: { status?: 'open' | 'in_progress' | 'resolved' | 'closed'; resolution?: string | null; priority?: 'low' | 'normal' | 'high' },
  ip?: string,
) {
  const complaint = await prisma.complaint.findUnique({ where: { id: complaintId } });
  if (!complaint) throw NotFound('Keluhan tidak ditemukan');
  if (input.status === 'resolved' && !input.resolution && !complaint.resolution) {
    throw BadRequest('Resolusi wajib diisi saat menandai keluhan selesai');
  }
  const updated = await prisma.complaint.update({
    where: { id: complaintId },
    data: input,
    include: {
      customer: { select: { id: true, name: true, email: true, phone: true } },
      order: { select: { id: true, orderCode: true } },
      followUps: { include: { user: { select: { name: true } } } },
    },
  });
  await writeAudit({
    userId: adminId,
    action: AUDIT.COMPLAINT_UPDATED,
    entityType: 'complaint',
    entityId: complaintId,
    metadata: { fields: Object.keys(input), status: input.status ?? complaint.status },
    ip,
  });
  if (input.status && input.status !== complaint.status) {
    await notify({
      userId: complaint.customerId,
      title: 'Pembaruan keluhan',
      message: `Keluhan ${complaint.code} kini berstatus ${input.status}${input.resolution ? `. Resolusi: ${input.resolution}` : ''}.`,
    });
  }
  return updated;
}

export async function addComplaintFollowUp(adminId: string, complaintId: string, note: string, ip?: string) {
  const complaint = await prisma.complaint.findUnique({ where: { id: complaintId } });
  if (!complaint) throw NotFound('Keluhan tidak ditemukan');
  const followUp = await prisma.$transaction(async (tx) => {
    const created = await tx.complaintFollowUp.create({
      data: { complaintId, userId: adminId, note },
    });
    if (complaint.status === 'open') {
      await tx.complaint.update({ where: { id: complaintId }, data: { status: 'in_progress' } });
    }
    await writeAudit(
      {
        userId: adminId,
        action: 'complaint.follow_up',
        entityType: 'complaint',
        entityId: complaintId,
        metadata: { followUpId: created.id },
        ip,
      },
      tx,
    );
    return created;
  });
  await notify({
    userId: complaint.customerId,
    title: 'Tindak lanjut keluhan',
    message: `Tim kami menindaklanjuti keluhan ${complaint.code}: ${note}`,
  });
  return followUp;
}

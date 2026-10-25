import type { Request, Response } from 'express';
import { prisma } from '../config/prisma';
import { ok, paginationMeta, parsePagination } from '../utils/http';
import { notificationDto } from '../utils/serializers';
import { NotFound } from '../utils/errors';

export async function listMine(req: Request, res: Response) {
  const q = req.query as unknown as { unreadOnly?: 'true' | 'false'; page?: number; limit?: number };
  const { page, limit, skip } = parsePagination(q);
  const where = {
    userId: req.auth!.userId,
    ...(q.unreadOnly === 'true' ? { status: { not: 'read' as const } } : {}),
  };
  const [total, rows, unread] = await Promise.all([
    prisma.notification.count({ where }),
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.notification.count({ where: { userId: req.auth!.userId, status: { not: 'read' } } }),
  ]);
  return ok(res, { rows: rows.map(notificationDto), unread }, paginationMeta(total, page, limit));
}

export async function unreadCount(req: Request, res: Response) {
  const count = await prisma.notification.count({
    where: { userId: req.auth!.userId, status: { not: 'read' } },
  });
  return ok(res, { unread: count });
}

export async function markRead(req: Request, res: Response) {
  const notification = await prisma.notification.findUnique({ where: { id: req.params.id } });
  if (!notification || notification.userId !== req.auth!.userId) throw NotFound('Notifikasi tidak ditemukan');
  const updated = await prisma.notification.update({
    where: { id: req.params.id },
    data: { status: 'read', readAt: new Date() },
  });
  return ok(res, notificationDto(updated));
}

export async function markAllRead(req: Request, res: Response) {
  const result = await prisma.notification.updateMany({
    where: { userId: req.auth!.userId, status: { not: 'read' } },
    data: { status: 'read', readAt: new Date() },
  });
  return ok(res, { updated: result.count });
}

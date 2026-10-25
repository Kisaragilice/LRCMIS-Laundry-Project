import type { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { BadRequest, NotFound } from '../utils/errors';
import { AUDIT, writeAudit } from './audit.service';

export async function listPublicServices() {
  return prisma.service.findMany({
    where: { isActive: true },
    orderBy: [{ pricingUnit: 'asc' }, { price: 'asc' }],
  });
}

export async function listAllServices(filters: { isActive?: boolean; search?: string }) {
  const where: Prisma.ServiceWhereInput = {
    ...(filters.isActive !== undefined ? { isActive: filters.isActive } : {}),
    ...(filters.search
      ? { name: { contains: filters.search, mode: 'insensitive' } }
      : {}),
  };
  return prisma.service.findMany({
    where,
    orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    include: { _count: { select: { orderItems: true } } },
  });
}

export async function createService(
  adminId: string,
  data: {
    name: string;
    description?: string | null;
    price: number;
    pricingUnit: 'kg' | 'piece' | 'pair';
    estimatedHours?: number | null;
    isActive?: boolean;
  },
  ip?: string,
) {
  const service = await prisma.service.create({ data });
  await writeAudit({
    userId: adminId,
    action: AUDIT.SERVICE_CREATED,
    entityType: 'service',
    entityId: service.id,
    metadata: { name: service.name, price: Number(service.price) },
    ip,
  });
  return service;
}

export async function updateService(
  adminId: string,
  serviceId: string,
  data: Prisma.ServiceUpdateInput,
  ip?: string,
) {
  const existing = await prisma.service.findUnique({ where: { id: serviceId } });
  if (!existing) throw NotFound('Layanan tidak ditemukan');
  const service = await prisma.service.update({ where: { id: serviceId }, data });

  const priceChanged = data.price !== undefined && Number(existing.price) !== Number(service.price);
  await writeAudit({
    userId: adminId,
    action: priceChanged ? 'service.price_changed' : AUDIT.SERVICE_UPDATED,
    entityType: 'service',
    entityId: service.id,
    metadata: priceChanged
      ? { oldPrice: Number(existing.price), newPrice: Number(service.price), name: service.name }
      : { fields: Object.keys(data) },
    ip,
  });
  return service;
}

export async function deactivateService(adminId: string, serviceId: string, ip?: string) {
  const service = await prisma.service.update({ where: { id: serviceId }, data: { isActive: false } });
  await writeAudit({
    userId: adminId,
    action: AUDIT.SERVICE_DEACTIVATED,
    entityType: 'service',
    entityId: serviceId,
    ip,
  });
  return service;
}

export async function deleteService(adminId: string, serviceId: string, ip?: string) {
  const used = await prisma.service.findUnique({
    where: { id: serviceId },
    include: { _count: { select: { orderItems: true, reservationItems: true } } },
  });
  if (!used) throw NotFound('Layanan tidak ditemukan');
  if (used._count.orderItems > 0 || used._count.reservationItems > 0) {
    throw BadRequest('Layanan sudah dipakai pada transaksi. Nonaktifkan layanan sebagai gantinya.');
  }
  await prisma.service.delete({ where: { id: serviceId } });
  await writeAudit({ userId: adminId, action: 'service.deleted', entityType: 'service', entityId: serviceId, ip });
  return { message: 'Layanan berhasil dihapus' };
}

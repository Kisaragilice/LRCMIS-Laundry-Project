import type { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { ROLES } from '../config/constants';
import { NotFound, Forbidden } from '../utils/errors';
import { writeAudit, AUDIT } from './audit.service';

export async function listCustomers(filters: {
  search?: string;
  isActive?: boolean;
  page: number;
  limit: number;
  skip: number;
}) {
  const where: Prisma.UserWhereInput = {
    roles: { some: { role: { name: ROLES.CUSTOMER } } },
    ...(filters.isActive !== undefined ? { isActive: filters.isActive } : {}),
    ...(filters.search
      ? {
          OR: [
            { name: { contains: filters.search, mode: 'insensitive' } },
            { email: { contains: filters.search, mode: 'insensitive' } },
            { phone: { contains: filters.search } },
          ],
        }
      : {}),
  };

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: filters.skip,
      take: filters.limit,
      include: {
        _count: { select: { orders: true, reservations: true, addresses: true } },
        orders: {
          select: { totalAmount: true, paymentStatus: true },
        },
      },
    }),
  ]);

  return {
    total,
    data: users.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      isActive: user.isActive,
      createdAt: user.createdAt,
      counts: user._count,
      lifetimeValue: user.orders
        .filter((o) => o.paymentStatus === 'paid')
        .reduce((sum, o) => sum + Number(o.totalAmount), 0),
    })),
  };
}

export async function getCustomerDetail(id: string) {
  const user = await prisma.user.findFirst({
    where: { id, roles: { some: { role: { name: ROLES.CUSTOMER } } } },
    include: {
      addresses: { orderBy: { isDefault: 'desc' } },
      orders: {
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: { items: true },
      },
      reservations: {
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: { timeSlot: true, items: { include: { service: true } } },
      },
      reviews: { orderBy: { createdAt: 'desc' }, take: 10 },
    },
  });
  if (!user) throw NotFound('Pelanggan tidak ditemukan');
  return user;
}

export async function setCustomerActive(
  adminId: string,
  customerId: string,
  isActive: boolean,
  ip?: string,
) {
  const user = await prisma.user.findFirst({
    where: { id: customerId, roles: { some: { role: { name: ROLES.CUSTOMER } } } },
  });
  if (!user) throw NotFound('Pelanggan tidak ditemukan');
  if (user.isPrimaryAdmin && !isActive) {
    throw Forbidden('Akun administrator utama tidak dapat dinonaktifkan.');
  }
  const updated = await prisma.user.update({ where: { id: customerId }, data: { isActive } });
  await writeAudit({
    userId: adminId,
    action: AUDIT.CUSTOMER_STATUS_CHANGED,
    entityType: 'user',
    entityId: customerId,
    metadata: { isActive },
    ip,
  });
  return updated;
}

export async function listStaffAndCouriers() {
  const users = await prisma.user.findMany({
    where: {
      isActive: true,
      roles: { some: { role: { name: { in: [ROLES.STAFF, ROLES.COURIER] } } } },
    },
    include: { roles: { include: { role: true } } },
    orderBy: { name: 'asc' },
  });
  return users.map((user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    roles: user.roles.map((r) => r.role.name),
  }));
}

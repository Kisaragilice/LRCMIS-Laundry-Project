import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { ROLES, type RoleName } from '../config/constants';
import { BadRequest, Conflict, Forbidden, NotFound } from '../utils/errors';
import { AUDIT, writeAudit } from './audit.service';
import { notify } from './notification.service';

export interface AccountFilters {
  search?: string;
  role?: string;
  status?: 'active' | 'inactive' | 'deleted';
  page: number;
  limit: number;
  skip: number;
}

const accountInclude = {
  roles: { include: { role: true } },
  _count: { select: { orders: true, reservations: true, auditLogs: true } },
} satisfies Prisma.UserInclude;

type AccountWithRoles = Prisma.UserGetPayload<{ include: typeof accountInclude }>;

function toAccount(user: AccountWithRoles) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    isActive: user.isActive,
    isPrimaryAdmin: user.isPrimaryAdmin,
    deletedAt: user.deletedAt,
    createdAt: user.createdAt,
    roles: user.roles.map((entry) => entry.role.name),
    counts: user._count,
  };
}

export async function listAccounts(filters: AccountFilters) {
  const where: Prisma.UserWhereInput = {
    ...(filters.role ? { roles: { some: { role: { name: filters.role } } } } : {}),
    ...(filters.status === 'active'
      ? { isActive: true, deletedAt: null }
      : filters.status === 'inactive'
        ? { isActive: false, deletedAt: null }
        : filters.status === 'deleted'
          ? { deletedAt: { not: null } }
          : {}),
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
      orderBy: [{ isPrimaryAdmin: 'desc' }, { createdAt: 'desc' }],
      skip: filters.skip,
      take: filters.limit,
      include: accountInclude,
    }),
  ]);

  return { total, data: users.map(toAccount) };
}

export interface CreateInternalAccountInput {
  name: string;
  email: string;
  password: string;
  phone?: string;
  role: Extract<RoleName, 'staff' | 'courier' | 'owner'>;
}

const INTERNAL_ACCOUNT_ROLES = new Set<string>([ROLES.STAFF, ROLES.COURIER, ROLES.OWNER]);

const roleLabels: Record<string, string> = {
  [ROLES.STAFF]: 'Staff',
  [ROLES.COURIER]: 'Kurir',
  [ROLES.OWNER]: 'Owner',
};

/** Creates an internal operational account (staff, courier, or owner). */
export async function createInternalAccount(
  actorId: string,
  input: CreateInternalAccountInput,
  ip?: string,
) {
  if (!INTERNAL_ACCOUNT_ROLES.has(input.role)) {
    throw BadRequest('Peran akun tidak diizinkan melalui menu ini.');
  }

  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw Conflict('Email sudah terdaftar', 'EMAIL_TAKEN');

  const passwordHash = await bcrypt.hash(input.password, 12);

  try {
    return await prisma.$transaction(async (tx) => {
      const role = await tx.role.findUnique({ where: { name: input.role } });
      if (!role) throw BadRequest('Peran akun belum tersedia. Jalankan seed peran terlebih dahulu.');

      const created = await tx.user.create({
        data: {
          name: input.name,
          email: input.email,
          passwordHash,
          phone: input.phone || null,
          roles: { create: { roleId: role.id } },
        },
        include: accountInclude,
      });

      await writeAudit(
        {
          userId: actorId,
          action: AUDIT.ACCOUNT_CREATED,
          entityType: 'user',
          entityId: created.id,
          metadata: { email: created.email, role: input.role },
          ip,
        },
        tx,
      );

      await notify({
        userId: created.id,
        title: 'Akun internal dibuat',
        message: `Akun ${roleLabels[input.role]} Anda telah dibuat oleh administrator. Silakan masuk menggunakan kredensial yang diberikan.`,
        tx,
      });

      return toAccount(created);
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw Conflict('Email sudah terdaftar', 'EMAIL_TAKEN');
    }
    throw error;
  }
}

async function findTarget(tx: Prisma.TransactionClient, id: string) {
  const user = await tx.user.findUnique({
    where: { id },
    include: { roles: { include: { role: true } } },
  });
  if (!user) throw NotFound('Akun tidak ditemukan');
  return user;
}

export async function setAccountActive(
  actorId: string,
  targetId: string,
  isActive: boolean,
  ip?: string,
) {
  return prisma.$transaction(async (tx) => {
    const target = await findTarget(tx, targetId);

    if (target.isPrimaryAdmin && !isActive) {
      throw Forbidden('Akun administrator utama tidak dapat dinonaktifkan.');
    }
    if (target.deletedAt) {
      throw BadRequest('Akun yang sudah dihapus tidak dapat diubah statusnya.');
    }
    if (!isActive && target.id === actorId) {
      throw BadRequest('Anda tidak dapat menonaktifkan akun sendiri.');
    }
    if (target.isActive === isActive) {
      return { id: target.id, isActive: target.isActive, deletedAt: target.deletedAt };
    }

    const updated = await tx.user.update({
      where: { id: target.id },
      data: { isActive },
    });
    await writeAudit(
      {
        userId: actorId,
        action: AUDIT.ACCOUNT_STATUS_CHANGED,
        entityType: 'user',
        entityId: target.id,
        metadata: { isActive, email: target.email },
        ip,
      },
      tx,
    );
    return { id: updated.id, isActive: updated.isActive, deletedAt: updated.deletedAt };
  });
}

/**
 * Soft-deletes an ordinary account. Business records stay intact; the user can
 * no longer authenticate because both login and the auth middleware reject
 * inactive/deleted accounts.
 */
export async function deleteAccount(actorId: string, targetId: string, ip?: string) {
  return prisma.$transaction(async (tx) => {
    const target = await findTarget(tx, targetId);

    if (target.isPrimaryAdmin) {
      throw Forbidden('Akun administrator utama tidak dapat dihapus.');
    }
    if (target.id === actorId) {
      throw BadRequest('Anda tidak dapat menghapus akun sendiri.');
    }
    if (target.deletedAt) {
      throw BadRequest('Akun ini sudah dihapus.');
    }
    if (target.roles.some((entry) => entry.role.name === ROLES.ADMIN)) {
      throw BadRequest(
        'Akun administrator tidak dapat dihapus melalui menu ini. Nonaktifkan akun atau gunakan alur terpisah.',
      );
    }

    const deletedAt = new Date();
    const result = await tx.user.updateMany({
      where: { id: target.id, deletedAt: null, isPrimaryAdmin: false },
      data: { isActive: false, deletedAt, deletedBy: actorId },
    });
    if (result.count === 0) {
      throw BadRequest('Akun ini sudah dihapus.');
    }

    await writeAudit(
      {
        userId: actorId,
        action: AUDIT.ACCOUNT_DELETED,
        entityType: 'user',
        entityId: target.id,
        metadata: { email: target.email, mode: 'soft_delete' },
        ip,
      },
      tx,
    );

    return {
      id: target.id,
      email: target.email,
      isActive: false,
      deletedAt,
      message: 'Akun berhasil dihapus. Riwayat pesanan dan pembayaran tetap tersimpan.',
    };
  });
}

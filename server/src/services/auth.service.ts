import { createHash, randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import type { Prisma, User } from '@prisma/client';
import { prisma } from '../config/prisma';
import { env, isTest } from '../config/env';
import { ROLES } from '../config/constants';
import { BadRequest, Conflict, NotFound, Unauthorized } from '../utils/errors';
import { signToken } from '../utils/auth';
import { notify } from './notification.service';
import { isEmailConfigured, sendPasswordResetEmail } from './email.service';
import { AUDIT, writeAudit } from './audit.service';

type UserWithRoles = User & {
  roles: Array<{ role: { name: string; description: string | null } }>;
};

export function sanitizeUser(user: UserWithRoles) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    isActive: user.isActive,
    isPrimaryAdmin: user.isPrimaryAdmin,
    deletedAt: user.deletedAt,
    roles: user.roles.map((r) => r.role.name),
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export async function getUserWithRoles(id: string): Promise<UserWithRoles> {
  const user = await prisma.user.findUnique({
    where: { id },
    include: { roles: { include: { role: true } } },
  });
  if (!user) throw NotFound('Pengguna tidak ditemukan');
  return user;
}

export async function register(input: {
  name: string;
  email: string;
  password: string;
  phone?: string;
  ip?: string;
}) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw Conflict('Email sudah terdaftar', 'EMAIL_TAKEN');

  const passwordHash = await bcrypt.hash(input.password, 12);

  const user = await prisma.$transaction(async (tx) => {
    const role = await tx.role.upsert({
      where: { name: ROLES.CUSTOMER },
      update: {},
      create: { name: ROLES.CUSTOMER, description: 'Pelanggan laundry' },
    });

    const created = await tx.user.create({
      data: {
        name: input.name,
        email: input.email,
        passwordHash,
        phone: input.phone,
        roles: { create: { roleId: role.id } },
      },
      include: { roles: { include: { role: true } } },
    });

    await writeAudit(
      {
        userId: created.id,
        action: AUDIT.USER_REGISTERED,
        entityType: 'user',
        entityId: created.id,
        metadata: { email: created.email },
        ip: input.ip,
      },
      tx,
    );

    await notify({
      userId: created.id,
      title: 'Selamat datang di LRCMIS',
      message: `Halo ${created.name}! Akun Anda berhasil dibuat. Silakan buat reservasi pertama Anda.`,
      tx,
    });

    return created;
  });

  return { user, token: tokenFor(user) };
}

export async function login(input: { email: string; password: string; ip?: string }) {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
    include: { roles: { include: { role: true } } },
  });

  if (!user) {
    // Keep timing similar to a real comparison without leaking account existence.
    await bcrypt.compare(input.password, '$2b$12$C6UzMDM.H6dfI/f/IKcEeO7Xyq1FWmyq0K1Y3lJ9Q5p8vR2sN4u6K');
    throw Unauthorized('Email atau password salah');
  }
  if (!user.isActive || user.deletedAt) throw Unauthorized('Akun Anda tidak aktif. Hubungi admin.');

  const valid = await bcrypt.compare(input.password, user.passwordHash);
  if (!valid) throw Unauthorized('Email atau password salah');

  await writeAudit({
    userId: user.id,
    action: AUDIT.USER_LOGIN,
    entityType: 'user',
    entityId: user.id,
    ip: input.ip,
  });

  return { user, token: tokenFor(user) };
}

function tokenFor(user: UserWithRoles): string {
  return signToken({
    sub: user.id,
    email: user.email,
    roles: user.roles.map((r) => r.role.name),
  });
}

export async function requestPasswordReset(email: string, ip?: string) {
  const generic = { message: 'Jika email terdaftar, tautan reset password telah dikirim.' };
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.isActive || user.deletedAt) return { ...generic, token: null as string | null };
  const rawToken = randomBytes(32).toString('hex');
  const tokenHash = createHash('sha256').update(rawToken).digest('hex');
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

  await prisma.$transaction(async (tx) => {
    await tx.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } });
    await tx.passwordResetToken.create({
      data: { userId: user.id, tokenHash, expiresAt },
    });
    await writeAudit(
      {
        userId: user.id,
        action: AUDIT.PASSWORD_RESET_REQUESTED,
        entityType: 'user',
        entityId: user.id,
        ip,
      },
      tx,
    );
    await notify({
      userId: user.id,
      title: 'Permintaan reset password',
      message: 'Permintaan reset password dibuat. Jika bukan Anda, abaikan notifikasi ini.',
      tx,
      channels: ['in_app'],
    });
  });

  // Integration tests must never contact the real email provider.
  if (!isTest() && isEmailConfigured()) {
    try {
      await sendPasswordResetEmail({
        to: user.email,
        name: user.name,
        token: rawToken,
        expiresAt,
      });
    } catch (error) {
      console.error(
        '[email] Gagal mengirim email reset password:',
        error instanceof Error ? error.message : 'unknown error',
      );
      await writeAudit({
        userId: user.id,
        action: AUDIT.PASSWORD_RESET_EMAIL_FAILED,
        entityType: 'user',
        entityId: user.id,
        metadata: { provider: 'email' },
        ip,
      }).catch(() => undefined);
    }
  }

  return {
    ...generic,
    token: env.EXPOSE_RESET_TOKEN ? rawToken : null,
    expiresAt: env.EXPOSE_RESET_TOKEN ? expiresAt : undefined,
  };
}

export async function resetPassword(token: string, password: string, ip?: string) {
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });
  if (!record || record.usedAt || record.expiresAt < new Date()) {
    throw BadRequest('Token reset tidak valid atau sudah kedaluwarsa', [
      { field: 'token', message: 'Gunakan tautan reset terbaru' },
    ]);
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: record.userId },
      data: { passwordHash },
    });
    await tx.passwordResetToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    });
    await tx.passwordResetToken.deleteMany({
      where: { userId: record.userId, id: { not: record.id }, usedAt: null },
    });
    await writeAudit(
      {
        userId: record.userId,
        action: AUDIT.PASSWORD_RESET_COMPLETED,
        entityType: 'user',
        entityId: record.userId,
        ip,
      },
      tx,
    );
  });

  return { message: 'Password berhasil diperbarui. Silakan masuk kembali.' };
}

export async function changePassword(userId: string, currentPassword: string, newPassword: string, ip?: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw NotFound('Pengguna tidak ditemukan');
  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) throw BadRequest('Password saat ini tidak sesuai');
  const passwordHash = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
  await writeAudit({
    userId,
    action: AUDIT.PROFILE_UPDATED,
    entityType: 'user',
    entityId: userId,
    metadata: { field: 'password' },
    ip,
  });
  return { message: 'Password berhasil diubah' };
}

export async function updateProfile(
  userId: string,
  data: Prisma.UserUpdateInput,
  ip?: string,
) {
  const user = await prisma.user.update({
    where: { id: userId },
    data,
    include: { roles: { include: { role: true } } },
  });
  await writeAudit({
    userId,
    action: AUDIT.PROFILE_UPDATED,
    entityType: 'user',
    entityId: userId,
    metadata: { fields: Object.keys(data) },
    ip,
  });
  return user;
}

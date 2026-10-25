import 'dotenv/config';
import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function generatePassword(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const bytes = randomBytes(24);
  let value = '';
  for (const byte of bytes) value += alphabet[byte % alphabet.length];
  return `Lr${value}7`;
}

function validatePassword(password: string) {
  if (password.length < 12 || password.length > 72) {
    throw new Error('Password administrator utama harus 12-72 karakter.');
  }
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    throw new Error('Password administrator utama harus mengandung huruf dan angka.');
  }
}

async function main() {
  const reset = process.argv.includes('--reset-password');
  const email = (argument('--email') ?? process.env.PRIMARY_ADMIN_EMAIL ?? 'admin@lrcmis.id')
    .trim()
    .toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Email administrator utama tidak valid.');

  const existingPrimary = await prisma.user.findFirst({ where: { isPrimaryAdmin: true } });
  if (existingPrimary && existingPrimary.email !== email) {
    throw new Error(
      `Administrator utama sudah dikonfigurasi sebagai ${existingPrimary.email}. ` +
        'Transfer kepemilikan administrator utama bukan bagian dari alur ini.',
    );
  }

  const existing = await prisma.user.findUnique({
    where: { email },
    include: { roles: { include: { role: true } } },
  });

  const alreadyPrimary = existing?.isPrimaryAdmin === true;
  const shouldSetPassword = !alreadyPrimary || reset;

  if (existing && !existing.roles.some((entry) => entry.role.name === 'admin')) {
    throw new Error('Akun dengan email tersebut ada tetapi bukan administrator. Gunakan email lain.');
  }

  let password: string | null = null;
  if (shouldSetPassword) {
    password = process.env.PRIMARY_ADMIN_PASSWORD?.trim() || generatePassword();
    validatePassword(password);
  }

  const passwordHash = password ? await bcrypt.hash(password, 12) : undefined;

  const adminRole = await prisma.role.upsert({
    where: { name: 'admin' },
    update: {},
    create: { name: 'admin', description: 'Pengelola operasional' },
  });

  await prisma.$transaction(async (tx) => {
    if (existing) {
      await tx.user.update({
        where: { id: existing.id },
        data: {
          isPrimaryAdmin: true,
          isActive: true,
          deletedAt: null,
          ...(passwordHash ? { passwordHash } : {}),
        },
      });
    } else {
      await tx.user.create({
        data: {
          name: process.env.PRIMARY_ADMIN_NAME?.trim() || 'Administrator Utama',
          email,
          passwordHash: passwordHash!,
          isPrimaryAdmin: true,
          isActive: true,
          roles: { create: { roleId: adminRole.id } },
        },
      });
    }

    await tx.auditLog.create({
      data: {
        userId: existing?.id ?? null,
        action: 'primary_admin.setup',
        entityType: 'user',
        entityId: existing?.id ?? null,
        metadata: { email, resetPassword: Boolean(password) },
      },
    });
  });

  const verified = await prisma.user.findFirst({ where: { email, isPrimaryAdmin: true, isActive: true } });
  if (!verified) throw new Error('Verifikasi administrator utama gagal.');

  console.log('Primary administrator verified in the database.');
  console.log(`Email: ${verified.email}`);
  if (password) {
    console.log(`Initial password (shown once): ${password}`);
    console.log('Change this password after the first login.');
  } else {
    console.log('Password was not changed. Use --reset-password to rotate it.');
  }
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

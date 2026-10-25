import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * One-time, explicitly scoped cleanup of the demo accounts created by the old
 * seed. It never deletes business records and never touches the primary admin
 * or accounts that do not match this allowlist. Repeated runs are safe.
 */
const DEMO_EMAILS = [
  'owner@lrcmis.id',
  'staff@lrcmis.id',
  'courier@lrcmis.id',
  'budi@example.com',
  'siti@example.com',
];

async function main() {
  const primary = await prisma.user.findFirst({ where: { isPrimaryAdmin: true } });
  if (!primary) {
    throw new Error('No primary administrator is configured. Run setup-primary-admin first.');
  }

  const users = await prisma.user.findMany({
    where: { email: { in: DEMO_EMAILS } },
    select: { id: true, email: true, isPrimaryAdmin: true, deletedAt: true },
  });

  const cleaned: string[] = [];
  const skipped: string[] = [];

  await prisma.$transaction(async (tx) => {
    for (const user of users) {
      if (user.isPrimaryAdmin) {
        skipped.push(`${user.email} (primary administrator)`);
        continue;
      }
      if (user.deletedAt) {
        skipped.push(`${user.email} (already deleted)`);
        continue;
      }
      await tx.user.update({
        where: { id: user.id },
        data: { isActive: false, deletedAt: new Date(), deletedBy: primary.id },
      });
      await tx.auditLog.create({
        data: {
          userId: primary.id,
          action: 'account.deleted',
          entityType: 'user',
          entityId: user.id,
          metadata: { email: user.email, mode: 'demo_cleanup_soft_delete' },
        },
      });
      cleaned.push(user.email);
    }
  });

  const remaining = await prisma.user.findMany({
    where: { isActive: true, deletedAt: null },
    select: { email: true, isPrimaryAdmin: true, roles: { include: { role: true } } },
    orderBy: { createdAt: 'asc' },
  });

  console.log(`Soft-deleted demo accounts: ${cleaned.length ? cleaned.join(', ') : 'none'}`);
  if (skipped.length) console.log(`Skipped: ${skipped.join(', ')}`);
  console.log('Active accounts remaining:');
  for (const user of remaining) {
    console.log(`  ${user.email} [${user.roles.map((entry) => entry.role.name).join(', ')}]${user.isPrimaryAdmin ? ' (primary admin)' : ''}`);
  }
  console.log('Business records were not deleted.');
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

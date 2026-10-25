import 'dotenv/config';
import { PrismaClient, Prisma } from '@prisma/client';
import { DateTime } from 'luxon';

const prisma = new PrismaClient();
const TZ = 'Asia/Jakarta';

const dayIso = (offsetDays = 0) => DateTime.now().setZone(TZ).plus({ days: offsetDays }).toISODate()!;
const midnightUtc = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const timeEpoch = (hhmm: string) => new Date(`1970-01-01T${hhmm}:00.000Z`);

const roleData = [
  { name: 'customer', description: 'Pelanggan laundry' },
  { name: 'admin', description: 'Pengelola operasional' },
  { name: 'staff', description: 'Petugas pengerjaan laundry' },
  { name: 'courier', description: 'Petugas pickup dan delivery' },
  { name: 'owner', description: 'Pemilik usaha' },
];

const serviceData = [
  { name: 'Cuci Kering', description: 'Cuci dan keringkan tanpa setrika.', price: 7000, pricingUnit: 'kg' as const, estimatedHours: 24 },
  { name: 'Cuci Setrika', description: 'Paket lengkap cuci, kering, dan setrika.', price: 8000, pricingUnit: 'kg' as const, estimatedHours: 48 },
  { name: 'Setrika Saja', description: 'Setrika pakaian yang sudah bersih.', price: 6000, pricingUnit: 'kg' as const, estimatedHours: 24 },
  { name: 'Cuci Sepatu', description: 'Perawatan sepatu per pasang.', price: 25000, pricingUnit: 'pair' as const, estimatedHours: 36 },
  { name: 'Cuci Selimut', description: 'Selimut ukuran sedang per lembar.', price: 15000, pricingUnit: 'piece' as const, estimatedHours: 48 },
  { name: 'Bed Cover', description: 'Bed cover ukuran queen/king.', price: 20000, pricingUnit: 'piece' as const, estimatedHours: 72 },
];

/**
 * Routine, non-destructive seed. It never deletes users, orders, payments or
 * audit history and never creates demo accounts. Run `npm run db:setup-admin`
 * once to establish the protected primary administrator.
 */
async function main() {
  console.log('Seeding reference data (idempotent)...');

  for (const role of roleData) {
    await prisma.role.upsert({
      where: { name: role.name },
      update: { description: role.description },
      create: role,
    });
  }

  for (const service of serviceData) {
    const existing = await prisma.service.findFirst({ where: { name: service.name } });
    if (existing) {
      await prisma.service.update({
        where: { id: existing.id },
        data: { description: service.description, price: new Prisma.Decimal(service.price), pricingUnit: service.pricingUnit, estimatedHours: service.estimatedHours },
      });
    } else {
      await prisma.service.create({
        data: { ...service, price: new Prisma.Decimal(service.price) },
      });
    }
  }

  for (let day = 0; day < 10; day += 1) {
    const date = dayIso(day);
    for (const [start, end] of [['08:00', '10:00'], ['10:00', '12:00'], ['13:00', '15:00'], ['16:00', '18:00']]) {
      await prisma.timeSlot.upsert({
        where: { slotDate_startTime: { slotDate: midnightUtc(date), startTime: timeEpoch(start) } },
        update: {},
        create: {
          slotDate: midnightUtc(date),
          startTime: timeEpoch(start),
          endTime: timeEpoch(end),
          capacity: start === '10:00' ? 4 : 3,
          isAvailable: true,
        },
      });
    }
  }

  const now = Date.now();
  const promotionData = [
    {
      code: 'HEMAT10',
      discountType: 'percentage' as const,
      discountValue: 10,
      minPurchase: 30000,
      maxDiscount: 15000,
      perUserLimit: 1,
      startAt: new Date(now - 10 * 86400_000),
      endAt: new Date(now + 60 * 86400_000),
      usageLimit: 100,
      isActive: true,
    },
    {
      code: 'NEWBIE5000',
      discountType: 'fixed' as const,
      discountValue: 5000,
      minPurchase: 20000,
      perUserLimit: 1,
      startAt: new Date(now - 20 * 86400_000),
      endAt: new Date(now + 30 * 86400_000),
      usageLimit: 50,
      isActive: true,
    },
  ];
  for (const promotion of promotionData) {
    await prisma.promotion.upsert({
      where: { code: promotion.code },
      update: {},
      create: promotion,
    });
  }

  const primary = await prisma.user.findFirst({
    where: { isPrimaryAdmin: true },
    select: { email: true },
  });

  console.log('Seed complete. No demo users or business records were created.');
  if (!primary) {
    console.log('No primary administrator is configured yet.');
    console.log('Run: npm run db:setup-admin');
  } else {
    console.log(`Primary administrator: ${primary.email}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

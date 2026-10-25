import { PrismaClient } from '@prisma/client';
import { isProduction } from './env';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: isProduction() ? ['error'] : ['warn', 'error'],
  });

if (!isProduction()) globalForPrisma.prisma = prisma;

export type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

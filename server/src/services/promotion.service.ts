import { Prisma } from '@prisma/client';
import { prisma, type Tx } from '../config/prisma';
import { BadRequest, Conflict, NotFound } from '../utils/errors';
import { AUDIT, writeAudit } from './audit.service';
import { money } from '../utils/money';

function invalid(message: string, _code = 'INVALID_VOUCHER'): never {
  throw BadRequest(message, [{ field: 'code', message }]);
}

export interface PromotionEvaluation {
  promotionId: string;
  code: string;
  discountAmount: Prisma.Decimal;
  discountType: 'percentage' | 'fixed';
  discountValue: Prisma.Decimal;
  description: string;
}

/**
 * Validates a voucher against all eligibility rules. Must run inside the same
 * transaction that records the redemption to make usage limits race-safe.
 */
export async function evaluatePromotion(
  tx: Tx,
  input: { code: string; userId: string; subtotal: Prisma.Decimal | number; now?: Date },
): Promise<PromotionEvaluation> {
  const now = input.now ?? new Date();
  const code = input.code.trim().toUpperCase();
  const promotion = await tx.promotion.findUnique({ where: { code } });
  if (!promotion || !promotion.isActive) invalid('Kode voucher tidak valid atau tidak aktif');
  if (promotion.startAt > now) invalid('Voucher belum dapat digunakan');
  if (promotion.endAt < now) invalid('Voucher sudah kedaluwarsa', 'VOUCHER_EXPIRED');

  const subtotal = new Prisma.Decimal(input.subtotal);
  if (subtotal.lessThan(promotion.minPurchase)) {
    invalid(`Minimum transaksi untuk voucher ini adalah Rp${Number(promotion.minPurchase).toLocaleString('id-ID')}`);
  }

  const [totalUsed, userUsed] = await Promise.all([
    tx.promotionRedemption.count({ where: { promotionId: promotion.id } }),
    tx.promotionRedemption.count({ where: { promotionId: promotion.id, userId: input.userId } }),
  ]);
  if (promotion.usageLimit !== null && totalUsed >= promotion.usageLimit) {
    invalid('Kuota voucher sudah habis', 'VOUCHER_EXHAUSTED');
  }
  if (userUsed >= promotion.perUserLimit) {
    invalid('Anda sudah menggunakan voucher ini', 'VOUCHER_ALREADY_USED');
  }

  let discount: Prisma.Decimal;
  if (promotion.discountType === 'percentage') {
    discount = subtotal.mul(promotion.discountValue).div(100);
    if (promotion.maxDiscount) discount = Prisma.Decimal.min(discount, promotion.maxDiscount);
  } else {
    discount = Prisma.Decimal.min(promotion.discountValue, subtotal);
  }
  discount = money(discount);
  if (discount.lessThanOrEqualTo(0)) invalid('Voucher tidak menghasilkan diskon');

  return {
    promotionId: promotion.id,
    code: promotion.code,
    discountAmount: discount,
    discountType: promotion.discountType,
    discountValue: promotion.discountValue,
    description:
      promotion.discountType === 'percentage'
        ? `Diskon ${Number(promotion.discountValue)}%`
        : `Diskon Rp${Number(promotion.discountValue).toLocaleString('id-ID')}`,
  };
}

export async function previewPromotion(userId: string, code: string, subtotal: number) {
  return prisma.$transaction((tx) => evaluatePromotion(tx, { code, userId, subtotal }));
}

export async function listPromotionsForCustomer(userId: string, subtotal?: number) {
  const now = new Date();
  const promotions = await prisma.promotion.findMany({
    where: { isActive: true, startAt: { lte: now }, endAt: { gte: now } },
    orderBy: { endAt: 'asc' },
    include: { _count: { select: { redemptions: true } } },
  });

  const usage = await prisma.promotionRedemption.groupBy({
    by: ['promotionId'],
    where: { userId, promotionId: { in: promotions.map((p) => p.id) } },
    _count: { _all: true },
  });
  const usageMap = new Map(usage.map((u) => [u.promotionId, u._count._all]));

  return promotions.map((promotion) => {
    const totalUsed = promotion._count.redemptions;
    const userUsed = usageMap.get(promotion.id) ?? 0;
    const minOk = subtotal === undefined ? true : subtotal >= Number(promotion.minPurchase);
    const quotaOk = promotion.usageLimit === null || totalUsed < promotion.usageLimit;
    return {
      id: promotion.id,
      code: promotion.code,
      discountType: promotion.discountType,
      discountValue: Number(promotion.discountValue),
      minPurchase: Number(promotion.minPurchase),
      maxDiscount: promotion.maxDiscount === null ? null : Number(promotion.maxDiscount),
      startAt: promotion.startAt.toISOString(),
      endAt: promotion.endAt.toISOString(),
      remainingQuota: promotion.usageLimit === null ? null : Math.max(0, promotion.usageLimit - totalUsed),
      eligible:
        minOk && quotaOk && userUsed < promotion.perUserLimit && (subtotal === undefined || true),
      reason: !quotaOk
        ? 'Kuota habis'
        : userUsed >= promotion.perUserLimit
          ? 'Sudah pernah digunakan'
          : !minOk
            ? `Minimum transaksi Rp${Number(promotion.minPurchase).toLocaleString('id-ID')}`
            : null,
    };
  });
}

export async function listAllPromotions() {
  return prisma.promotion.findMany({
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { redemptions: true } } },
  });
}

export async function createPromotion(
  adminId: string,
  data: {
    code: string;
    discountType: 'percentage' | 'fixed';
    discountValue: number;
    minPurchase: number;
    maxDiscount?: number | null;
    perUserLimit: number;
    startAt: string;
    endAt: string;
    usageLimit?: number | null;
    isActive?: boolean;
  },
  ip?: string,
) {
  const existing = await prisma.promotion.findUnique({ where: { code: data.code } });
  if (existing) throw Conflict('Kode voucher sudah digunakan', 'DUPLICATE_VOUCHER');
  const promotion = await prisma.promotion.create({
    data: {
      code: data.code,
      discountType: data.discountType,
      discountValue: data.discountValue,
      minPurchase: data.minPurchase,
      maxDiscount: data.maxDiscount ?? null,
      perUserLimit: data.perUserLimit,
      startAt: new Date(data.startAt),
      endAt: new Date(data.endAt),
      usageLimit: data.usageLimit ?? null,
      isActive: data.isActive ?? true,
    },
  });
  await writeAudit({
    userId: adminId,
    action: AUDIT.PROMOTION_CREATED,
    entityType: 'promotion',
    entityId: promotion.id,
    metadata: { code: promotion.code },
    ip,
  });
  return promotion;
}

export async function updatePromotion(
  adminId: string,
  id: string,
  data: Record<string, unknown>,
  ip?: string,
) {
  const existing = await prisma.promotion.findUnique({ where: { id } });
  if (!existing) throw NotFound('Promosi tidak ditemukan');
  const payload = { ...data } as Prisma.PromotionUpdateInput;
  if (data.startAt) payload.startAt = new Date(data.startAt as string);
  if (data.endAt) payload.endAt = new Date(data.endAt as string);
  const updated = await prisma.promotion.update({ where: { id }, data: payload });
  await writeAudit({
    userId: adminId,
    action: AUDIT.PROMOTION_UPDATED,
    entityType: 'promotion',
    entityId: id,
    metadata: { fields: Object.keys(data) },
    ip,
  });
  return updated;
}

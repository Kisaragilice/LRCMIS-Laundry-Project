import { Prisma } from '@prisma/client';

/** Rounds a decimal money value to 2 dp using Prisma.Decimal (no floats). */
export function money(value: Prisma.Decimal | number | string): Prisma.Decimal {
  return new Prisma.Decimal(value).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

export function decimal(value: Prisma.Decimal | number | string): Prisma.Decimal {
  return new Prisma.Decimal(value);
}

/**
 * Billable weight policy (documented in README):
 * - minimum weight is MIN_WEIGHT_KG
 * - charged weight is rounded UP to WEIGHT_ROUNDING_KG
 */
export function billableWeight(
  actualWeight: Prisma.Decimal | number | string,
  minWeight: number,
  rounding: number,
): Prisma.Decimal {
  const actual = new Prisma.Decimal(actualWeight);
  const effective = Prisma.Decimal.max(actual, new Prisma.Decimal(minWeight));
  const step = new Prisma.Decimal(rounding);
  const rounded = effective
    .dividedBy(step)
    .toDecimalPlaces(0, Prisma.Decimal.ROUND_CEIL)
    .mul(step);
  return rounded.toDecimalPlaces(2);
}

import { DateTime } from 'luxon';
import { env } from '../config/env';

export const zone = () => env.BUSINESS_TIMEZONE;

export function nowUtc(): DateTime {
  return DateTime.now().setZone(zone());
}

/** Parses YYYY-MM-DD as start-of-day in the business timezone. */
export function parseDateStart(value: string): DateTime {
  return DateTime.fromISO(value, { zone: zone() }).startOf('day');
}

/** Parses YYYY-MM-DD as end-of-day (inclusive) in the business timezone. */
export function parseDateEnd(value: string): DateTime {
  return DateTime.fromISO(value, { zone: zone() }).endOf('day');
}

export function defaultRange(from?: string, to?: string) {
  const now = nowUtc();
  const start = from ? parseDateStart(from) : now.startOf('month');
  const end = to ? parseDateEnd(to) : now.endOf('month');
  return { start, end, from: start.toISODate()!, to: end.toISODate()! };
}

/** Converts a calendar date + wall-clock time in Asia/Jakarta to a UTC Date. */
export function slotStart(dateIso: string, time: string): Date {
  const iso = `${dateIso}T${time}:00`;
  const dt = DateTime.fromISO(iso, { zone: zone() });
  if (!dt.isValid) throw new Error('Waktu slot tidak valid');
  return dt.toUTC().toJSDate();
}

/** Prisma `@db.Date` returns UTC midnight; extract YYYY-MM-DD. */
export function dateOnlyToIso(value: Date): string {
  return DateTime.fromJSDate(value, { zone: 'utc' }).toISODate()!;
}

/** Prisma `@db.Time` returns 1970-01-01; extract HH:mm. */
export function timeOnlyToHHmm(value: Date): string {
  return DateTime.fromJSDate(value, { zone: 'utc' }).toFormat('HH:mm');
}

export function toDateAtUtcMidnight(dateIso: string): Date {
  return new Date(`${dateIso}T00:00:00.000Z`);
}

export function toTimeAtEpoch(time: string): Date {
  return new Date(`1970-01-01T${time}:00.000Z`);
}

export function formatBusinessDateTime(value: Date | string): string {
  const dt = typeof value === 'string' ? DateTime.fromISO(value) : DateTime.fromJSDate(value);
  return dt.setZone(zone()).setLocale('id-ID').toFormat('dd MMM yyyy, HH:mm');
}

export function monthKey(value: Date | string): string {
  const dt = typeof value === 'string' ? DateTime.fromISO(value) : DateTime.fromJSDate(value);
  return dt.setZone(zone()).toFormat('yyyy-MM');
}

export function dayKey(value: Date | string): string {
  const dt = typeof value === 'string' ? DateTime.fromISO(value) : DateTime.fromJSDate(value);
  return dt.setZone(zone()).toFormat('yyyy-MM-dd');
}

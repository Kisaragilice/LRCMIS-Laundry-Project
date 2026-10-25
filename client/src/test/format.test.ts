import { describe, expect, it } from 'vitest';
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatNumber,
  monthStartIso,
  orderStatusLabel,
  todayIso,
  weekday,
} from '../lib/format';

describe('Indonesian formatting helpers', () => {
  it('formats IDR without decimals', () => {
    expect(formatCurrency(35000)).toMatch(/Rp\s?35\.000/);
    expect(formatCurrency('1250000')).toMatch(/Rp\s?1\.250\.000/);
    expect(formatCurrency(null)).toMatch(/Rp\s?0/);
  });

  it('formats numbers with Indonesian separators', () => {
    expect(formatNumber(1234.567, 2)).toBe('1.234,57');
  });

  it('formats dates in Asia/Jakarta', () => {
    expect(formatDate('2026-10-23T17:00:00.000Z')).toBe('24 Okt 2026');
    expect(formatDateTime('2026-10-23T01:30:00.000Z')).toContain('08.30');
    expect(weekday('2026-10-23')).toBe('Jumat');
  });

  it('returns a dash for missing dates', () => {
    expect(formatDate(null)).toBe('-');
    expect(formatDateTime(undefined)).toBe('-');
  });

  it('uses the Jakarta calendar day for today', () => {
    expect(todayIso()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(monthStartIso()).toBe(`${todayIso().slice(0, 7)}-01`);
  });

  it('maps order statuses to Indonesian labels', () => {
    expect(orderStatusLabel.washing).toBe('Dicuci');
    expect(orderStatusLabel.completed).toBe('Selesai');
  });
});

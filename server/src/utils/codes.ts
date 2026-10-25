import { randomInt } from 'node:crypto';
import { DateTime } from 'luxon';
import { zone } from './datetime';

function compactToday(): string {
  return DateTime.now().setZone(zone()).toFormat('yyyyMMdd');
}

function suffix(length = 4): string {
  return String(randomInt(0, 10 ** length)).padStart(length, '0');
}

export const codeGenerators = {
  reservation: () => `RSV-${compactToday()}-${suffix(4)}`,
  order: () => `LRC-${compactToday()}-${suffix(4)}`,
  complaint: () => `CMP-${compactToday()}-${suffix(4)}`,
};

export function invoiceNumber(orderCode: string): string {
  return orderCode.replace(/^LRC-/, 'INV-');
}

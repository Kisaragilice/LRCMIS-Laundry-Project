import rateLimit from 'express-rate-limit';
import { isProduction, isTest } from '../config/env';

const skip = () => isTest();

// Rate-limit counters use express-rate-limit's in-memory store, so every
// backend restart starts with a clean slate. Development gets more headroom
// for repeated manual testing; production keeps the stricter values.
const isProd = isProduction();
const authLimit = isProd ? 15 : 50;
const resetWindowMs = isProd ? 60 * 60 * 1000 : 15 * 60 * 1000;
const resetLimit = isProd ? 5 : 30;

export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  // The app polls chat and notification endpoints while the dashboard is open.
  // Keep a safety limit, but high enough that normal polling does not lock users out.
  limit: 1200,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip,
  message: { success: false, error: { code: 'RATE_LIMITED', message: 'Terlalu banyak permintaan. Coba lagi nanti.' } },
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: authLimit,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  skip,
  message: { success: false, error: { code: 'RATE_LIMITED', message: 'Terlalu banyak percobaan. Coba lagi dalam 15 menit.' } },
});

export const passwordResetLimiter = rateLimit({
  windowMs: resetWindowMs,
  limit: resetLimit,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip,
  message: { success: false, error: { code: 'RATE_LIMITED', message: 'Terlalu banyak permintaan reset. Coba lagi nanti.' } },
});

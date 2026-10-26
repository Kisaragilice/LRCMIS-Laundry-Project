import { z } from 'zod';

const booleanString = z
  .enum(['true', 'false'])
  .optional()
  .transform((value) => value === 'true');

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  CLIENT_ORIGIN: z.string().default('http://localhost:5173'),
  // Public origin used in emails (reset links). Keep this separate from
  // CLIENT_ORIGIN so LAN/localhost origins do not leak into customer emails.
  PUBLIC_APP_URL: z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
    z.string().trim().url('PUBLIC_APP_URL must be a valid URL').optional(),
  ),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('8h'),
  COOKIE_SECURE: booleanString,
  BUSINESS_TIMEZONE: z.string().default('Asia/Jakarta'),
  MIN_WEIGHT_KG: z.coerce.number().positive().default(3),
  WEIGHT_ROUNDING_KG: z.coerce.number().positive().default(0.5),
  DEFAULT_DELIVERY_FEE: z.coerce.number().nonnegative().default(5000),
  RESERVATION_CANCEL_CUTOFF_HOURS: z.coerce.number().nonnegative().default(2),
  EXPOSE_RESET_TOKEN: booleanString,
  EMAIL_PROVIDER_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
  WHATSAPP_API_URL: z.string().optional(),
  WHATSAPP_API_TOKEN: z.string().optional(),
  PAYMENT_GATEWAY_KEY: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

let cachedEnv: Env | null = null;

export function loadEnv(): Env {
  if (cachedEnv) return cachedEnv;

  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid environment configuration -> ${details}`);
  }

  const env = parsed.data;
  if (env.NODE_ENV === 'production') {
    if (env.JWT_SECRET.includes('change-me') || env.JWT_SECRET.includes('replace-with')) {
      throw new Error('JWT_SECRET must not use the example value in production');
    }

    // COOKIE_SECURE is the deployment policy flag. The actual Secure attribute
    // is still chosen per request in setAuthCookies(): HTTPS gets Secure
    // cookies and plain HTTP LAN requests get normal cookies.
    const origins = env.CLIENT_ORIGIN.split(',').map((origin) => origin.trim()).filter(Boolean);
    const usesPlainHttp = origins.some((origin) => origin.startsWith('http://'));
    if (!env.COOKIE_SECURE && !usesPlainHttp) {
      throw new Error('COOKIE_SECURE must be true when CLIENT_ORIGIN only uses HTTPS');
    }

    if (env.EXPOSE_RESET_TOKEN) {
      throw new Error('EXPOSE_RESET_TOKEN must be false in production');
    }
    if (!env.EMAIL_PROVIDER_API_KEY || !env.EMAIL_FROM) {
      throw new Error('EMAIL_PROVIDER_API_KEY and EMAIL_FROM must be configured in production');
    }
  }

  cachedEnv = env;
  return env;
}

export const env = new Proxy({} as Env, {
  get(_target, prop: string) {
    return loadEnv()[prop as keyof Env];
  },
});

export const isProduction = () => loadEnv().NODE_ENV === 'production';
export const isTest = () => loadEnv().NODE_ENV === 'test';

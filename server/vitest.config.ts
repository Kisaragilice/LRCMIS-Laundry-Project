import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/**/*.test.ts'],
    fileParallelism: false,
    hookTimeout: 60_000,
    testTimeout: 30_000,
    env: {
      NODE_ENV: 'test',
      // Override for the Docker PostgreSQL instance, for example:
      // TEST_DATABASE_URL=postgresql://lrcmis:<password>@127.0.0.1:5433/lrcmis_test?schema=public
      DATABASE_URL:
        process.env.TEST_DATABASE_URL ??
        'postgresql://postgres:postgres@localhost:5432/lrcmis_test?schema=public',
      JWT_SECRET: 'test-only-secret-with-at-least-32-characters-long',
      JWT_EXPIRES_IN: '1h',
      CLIENT_ORIGIN: 'http://localhost:5173',
      COOKIE_SECURE: 'false',
      BUSINESS_TIMEZONE: 'Asia/Jakarta',
      MIN_WEIGHT_KG: '3',
      WEIGHT_ROUNDING_KG: '0.5',
      DEFAULT_DELIVERY_FEE: '5000',
      RESERVATION_CANCEL_CUTOFF_HOURS: '2',
      EXPOSE_RESET_TOKEN: 'false',
    },
  },
});

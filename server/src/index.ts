import 'dotenv/config';
import { loadEnv } from './config/env';
import { createApp } from './app';
import { prisma } from './config/prisma';
import { expireStaleReservations } from './services/reservation.service';

const env = loadEnv();
const app = createApp();

const server = app.listen(env.PORT, () => {
  console.log(`LRCMIS API listening on http://localhost:${env.PORT}`);
  console.log(`API docs: http://localhost:${env.PORT}/api/docs`);
});

const expiryTimer = setInterval(() => {
  expireStaleReservations().catch((error) => console.error('[jobs] reservation expiry failed', error));
}, 15 * 60 * 1000);
expiryTimer.unref();

async function shutdown(signal: string) {
  console.log(`${signal} received, shutting down`);
  clearInterval(expiryTimer);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

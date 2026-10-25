import { env, isTest } from '../config/env';
import { prisma, type Tx } from '../config/prisma';
import { writeAudit, AUDIT } from './audit.service';
import { sendEmail } from './email.service';

export interface NotifyInput {
  userId: string;
  title: string;
  message: string;
  orderId?: string | null;
  tx?: Tx;
  channels?: Array<'in_app' | 'email' | 'whatsapp'>;
}

/**
 * Core notifications are persisted in-app. Email/WhatsApp adapters are optional:
 * when credentials are absent nothing is sent and core flows keep working.
 */
export async function notify(input: NotifyInput) {
  const client = input.tx ?? prisma;
  const now = new Date();
  const channels = input.channels ?? ['in_app'];

  if (channels.includes('in_app')) {
    await client.notification.create({
      data: {
        userId: input.userId,
        orderId: input.orderId ?? null,
        title: input.title,
        message: input.message,
        channel: 'in_app',
        status: 'sent',
        sentAt: now,
      },
    });
  }

  const external = channels.filter((c) => c !== 'in_app');
  // External providers are disabled in tests so a test run can never send
  // real email or WhatsApp messages to fixture accounts.
  if (external.length === 0 || isTest()) return;

  const user = await client.user.findUnique({ where: { id: input.userId } });
  if (!user) return;

  for (const channel of external) {
    if (channel === 'email' && (!env.EMAIL_PROVIDER_API_KEY || !env.EMAIL_FROM)) continue;
    if (channel === 'whatsapp' && (!env.WHATSAPP_API_URL || !env.WHATSAPP_API_TOKEN || !user.phone)) continue;

    const record = await client.notification.create({
      data: {
        userId: input.userId,
        orderId: input.orderId ?? null,
        title: input.title,
        message: input.message,
        channel,
        status: 'queued',
      },
    });

    // Do not await an external provider inside a database transaction.
    if (!input.tx) {
      void dispatchExternal(channel, user.email, user.phone, input.message, record.id).catch(() => undefined);
    }
  }
}

async function dispatchExternal(
  channel: 'email' | 'whatsapp',
  email: string,
  phone: string | null,
  message: string,
  notificationId: string,
) {
  try {
    if (channel === 'email') {
      await sendEmail({
        to: email,
        subject: 'Notifikasi LRCMIS',
        text: message,
      });
    } else if (channel === 'whatsapp' && phone) {
      const response = await fetch(env.WHATSAPP_API_URL!, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.WHATSAPP_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ to: phone, message }),
      });
      if (!response.ok) throw new Error(`WhatsApp provider responded ${response.status}`);
    }
    await prisma.notification.update({
      where: { id: notificationId },
      data: { status: 'sent', sentAt: new Date() },
    });
  } catch (error) {
    await prisma.notification
      .update({ where: { id: notificationId }, data: { status: 'failed' } })
      .catch(() => undefined);
    await writeAudit({
      userId: null,
      action: AUDIT.ORDER_NOTE_ADDED,
      entityType: 'notification',
      entityId: notificationId,
      metadata: { provider: channel, error: error instanceof Error ? error.message : 'unknown' },
    }).catch(() => undefined);
  }
}

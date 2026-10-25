import { env } from '../config/env';

const RESEND_ENDPOINT = 'https://api.resend.com/emails';
const EXPIRY_FORMATTER = new Intl.DateTimeFormat('id-ID', {
  dateStyle: 'long',
  timeStyle: 'short',
  timeZone: env.BUSINESS_TIMEZONE,
});

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

interface PasswordResetEmailInput {
  to: string;
  name: string;
  token: string;
  expiresAt: Date;
}

export class EmailDeliveryError extends Error {
  statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.name = 'EmailDeliveryError';
    this.statusCode = statusCode;
  }
}

export function isEmailConfigured(): boolean {
  return Boolean(env.EMAIL_PROVIDER_API_KEY && env.EMAIL_FROM);
}

export function buildPasswordResetLink(token: string): string {
  const origin = env.CLIENT_ORIGIN.split(',')[0].trim().replace(/\/+$/, '');
  const url = new URL('/reset-password', origin);
  url.searchParams.set('token', token);
  return url.toString();
}

export async function sendEmail(message: EmailMessage): Promise<void> {
  if (!env.EMAIL_PROVIDER_API_KEY || !env.EMAIL_FROM) {
    throw new EmailDeliveryError(0, 'Email provider is not configured');
  }

  const response = await fetch(RESEND_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.EMAIL_PROVIDER_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: env.EMAIL_FROM,
      to: [message.to],
      subject: message.subject,
      text: message.text,
      ...(message.html ? { html: message.html } : {}),
    }),
  });

  if (!response.ok) {
    let providerMessage = '';
    try {
      const payload = (await response.json()) as {
        message?: string;
        error?: { message?: string };
      };
      providerMessage = payload.message ?? payload.error?.message ?? '';
    } catch {
      providerMessage = '';
    }
    throw new EmailDeliveryError(
      response.status,
      `Email provider responded ${response.status}${providerMessage ? `: ${providerMessage}` : ''}`,
    );
  }
}

export async function sendPasswordResetEmail(input: PasswordResetEmailInput): Promise<void> {
  const resetUrl = buildPasswordResetLink(input.token);
  const expires = EXPIRY_FORMATTER.format(input.expiresAt);
  const safeName = escapeHtml(input.name.trim() || 'Pelanggan');

  const text = [
    `Halo ${input.name.trim() || 'Pelanggan'},`,
    '',
    'Kami menerima permintaan untuk mereset password akun LRC MIS Anda.',
    `Buka tautan berikut untuk membuat password baru: ${resetUrl}`,
    '',
    `Tautan ini berlaku sampai ${expires}.`,
    'Jika Anda tidak meminta reset password, abaikan email ini. Password Anda tidak akan berubah.',
    '',
    'LRC MIS',
  ].join('\n');

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#172033">
      <h1 style="font-size:22px;margin:0 0 16px">Reset password LRC MIS</h1>
      <p style="line-height:1.6;margin:0 0 12px">Halo ${safeName},</p>
      <p style="line-height:1.6;margin:0 0 20px">
        Kami menerima permintaan untuk mereset password akun LRC MIS Anda. Klik tombol di bawah ini untuk membuat
        password baru.
      </p>
      <p style="margin:0 0 24px">
        <a href="${escapeHtml(resetUrl)}"
          style="display:inline-block;background:#0f766e;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:700">
          Reset Password
        </a>
      </p>
      <p style="line-height:1.6;margin:0 0 12px">Tautan ini berlaku sampai <strong>${escapeHtml(expires)}</strong>.</p>
      <p style="line-height:1.6;margin:0 0 20px">
        Jika Anda tidak meminta reset password, abaikan email ini. Password Anda tidak akan berubah.
      </p>
      <p style="line-height:1.6;margin:0;color:#64748b;font-size:13px">
        Jika tombol tidak berfungsi, salin tautan berikut ke browser:<br />
        <a href="${escapeHtml(resetUrl)}" style="color:#0f766e;word-break:break-all">${escapeHtml(resetUrl)}</a>
      </p>
    </div>
  `.trim();

  await sendEmail({
    to: input.to,
    subject: 'Reset password akun LRC MIS',
    text,
    html,
  });
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

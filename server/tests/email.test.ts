import { afterEach, describe, expect, it, vi } from 'vitest';

describe('password reset email service', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('sends a Resend email containing the public reset link', async () => {
    vi.stubEnv('EMAIL_PROVIDER_API_KEY', 're_test_key');
    vi.stubEnv('EMAIL_FROM', 'LRC MIS <server@kisaragilice.my.id>');
    // LAN origins may be used for CORS, but email links must use the public URL.
    vi.stubEnv('CLIENT_ORIGIN', 'http://192.168.100.67:9999');
    vi.stubEnv('PUBLIC_APP_URL', 'https://laundry.kisaragilice.my.id/');

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 'email-test-id' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const { sendPasswordResetEmail } = await import('../src/services/email.service');
    await sendPasswordResetEmail({
      to: 'pelanggan@example.com',
      name: 'Budi & Sari',
      token: 'reset-token-123',
      expiresAt: new Date('2026-10-25T10:00:00+07:00'),
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.resend.com/emails');
    expect(options.headers).toMatchObject({
      Authorization: 'Bearer re_test_key',
      'Content-Type': 'application/json',
    });

    const payload = JSON.parse(String(options.body)) as {
      from: string;
      to: string[];
      subject: string;
      text: string;
      html: string;
    };
    expect(payload.from).toBe('LRC MIS <server@kisaragilice.my.id>');
    expect(payload.to).toEqual(['pelanggan@example.com']);
    expect(payload.subject).toBe('Reset password akun LRC MIS');
    expect(payload.text).toContain('https://laundry.kisaragilice.my.id/reset-password?token=reset-token-123');
    expect(payload.html).toContain('https://laundry.kisaragilice.my.id/reset-password?token=reset-token-123');
    expect(payload.html).toContain('Budi &amp; Sari');
  });

  it('falls back to CLIENT_ORIGIN when PUBLIC_APP_URL is not set', async () => {
    vi.stubEnv('EMAIL_PROVIDER_API_KEY', 're_test_key');
    vi.stubEnv('EMAIL_FROM', 'LRC MIS <server@kisaragilice.my.id>');
    vi.stubEnv('CLIENT_ORIGIN', 'https://fallback.example.com');
    vi.stubEnv('PUBLIC_APP_URL', '');

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 'email-test-id' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const { sendPasswordResetEmail } = await import('../src/services/email.service');
    await sendPasswordResetEmail({
      to: 'pelanggan@example.com',
      name: 'Budi',
      token: 'reset-token-fallback',
      expiresAt: new Date('2026-10-25T10:00:00+07:00'),
    });

    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    const payload = JSON.parse(String(options.body)) as { text: string };
    expect(payload.text).toContain('https://fallback.example.com/reset-password?token=reset-token-fallback');
  });

  it('reports a provider failure without exposing the token', async () => {
    vi.stubEnv('EMAIL_PROVIDER_API_KEY', 're_test_key');
    vi.stubEnv('EMAIL_FROM', 'LRC MIS <server@kisaragilice.my.id>');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: 'Invalid API key' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );

    const { sendPasswordResetEmail } = await import('../src/services/email.service');
    await expect(
      sendPasswordResetEmail({
        to: 'pelanggan@example.com',
        name: 'Budi',
        token: 'secret-reset-token',
        expiresAt: new Date('2026-10-25T10:00:00+07:00'),
      }),
    ).rejects.toThrow('Email provider responded 401: Invalid API key');
  });
});

describe('production email configuration', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('refuses to start without Resend credentials', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('COOKIE_SECURE', 'true');
    vi.stubEnv('JWT_SECRET', 'production-secret-that-is-not-an-example-value');
    vi.stubEnv('EXPOSE_RESET_TOKEN', 'false');
    vi.stubEnv('EMAIL_PROVIDER_API_KEY', '');
    vi.stubEnv('EMAIL_FROM', '');

    const { loadEnv } = await import('../src/config/env');
    expect(() => loadEnv()).toThrow('EMAIL_PROVIDER_API_KEY and EMAIL_FROM must be configured in production');
  });
});

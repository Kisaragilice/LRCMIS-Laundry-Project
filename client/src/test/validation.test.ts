import { describe, expect, it } from 'vitest';
import { fieldErrors, loginSchema, registerSchema, resetPasswordSchema } from '../lib/validation';

describe('client-side Zod validation', () => {
  it('accepts a valid login payload', () => {
    const result = loginSchema.safeParse({ email: 'pelanggan@example.com', password: 'ContohUji123' });
    expect(result.success).toBe(true);
  });

  it('reports invalid login email', () => {
    const result = loginSchema.safeParse({ email: 'not-an-email', password: 'x' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(fieldErrors(result.error).email).toBe('Email tidak valid');
    }
  });

  it('rejects weak or mismatched registration passwords', () => {
    const result = registerSchema.safeParse({
      name: 'Budi',
      email: 'pelanggan@example.com',
      phone: '081234567890',
      password: 'short',
      confirmPassword: 'different',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = fieldErrors(result.error);
      expect(errors.password).toContain('minimal 8');
      expect(errors.confirmPassword).toBe('Konfirmasi password tidak sama');
    }
  });

  it('validates Indonesian phone numbers', () => {
    const valid = registerSchema.safeParse({
      name: 'Budi',
      email: 'pelanggan@example.com',
      phone: '081234567890',
      password: 'ContohUji123',
      confirmPassword: 'ContohUji123',
    });
    expect(valid.success).toBe(true);

    const invalid = registerSchema.safeParse({
      name: 'Budi',
      email: 'pelanggan@example.com',
      phone: '12345',
      password: 'ContohUji123',
      confirmPassword: 'ContohUji123',
    });
    expect(invalid.success).toBe(false);
  });

  it('requires a token and matching passwords on reset', () => {
    const result = resetPasswordSchema.safeParse({
      token: 'short',
      password: 'ContohUji123',
      confirmPassword: 'Password124',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = fieldErrors(result.error);
      expect(errors.token).toBeTruthy();
      expect(errors.confirmPassword).toBeTruthy();
    }
  });
});

import { randomBytes } from 'node:crypto';
import type { Response } from 'express';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../config/env';
import { AUTH_COOKIE, CSRF_COOKIE } from '../config/constants';

export interface JwtPayload {
  sub: string;
  email: string;
  roles: string[];
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn'],
    issuer: 'lrcmis',
    audience: 'lrcmis-web',
  });
}

export function verifyToken(token: string): JwtPayload {
  const decoded = jwt.verify(token, env.JWT_SECRET, {
    issuer: 'lrcmis',
    audience: 'lrcmis-web',
  });
  if (typeof decoded === 'string') throw new Error('Token tidak valid');
  return decoded as JwtPayload;
}

export function parseDurationMs(value: string): number {
  const match = /^(\d+)([smhd])$/.exec(value.trim());
  if (!match) return 8 * 60 * 60 * 1000;
  const amount = Number(match[1]);
  const unit = match[2];
  const factor = unit === 's' ? 1000 : unit === 'm' ? 60_000 : unit === 'h' ? 3_600_000 : 86_400_000;
  return amount * factor;
}

export function createCsrfToken(): string {
  return randomBytes(24).toString('hex');
}

/**
 * A deployment can be reachable both through HTTPS (public domain/tunnel) and
 * plain HTTP (LAN). Cookies marked Secure are silently discarded by browsers
 * on the HTTP origin, which makes login appear to succeed and every following
 * request return 401. Choose the flag from the actual request instead.
 */
export function shouldUseSecureCookies(res: Response): boolean {
  const origin = res.req.headers.origin;
  if (typeof origin === 'string') {
    if (origin.startsWith('https://')) return true;
    if (origin.startsWith('http://')) return false;
  }
  return res.req.secure;
}

export function setAuthCookies(res: Response, token: string): string {
  const maxAge = parseDurationMs(env.JWT_EXPIRES_IN);
  const secure = shouldUseSecureCookies(res);
  res.cookie(AUTH_COOKIE, token, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge,
  });
  const csrf = createCsrfToken();
  res.cookie(CSRF_COOKIE, csrf, {
    httpOnly: false,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge,
  });
  return csrf;
}

export function clearAuthCookies(res: Response): void {
  const secure = shouldUseSecureCookies(res);
  res.clearCookie(AUTH_COOKIE, { path: '/', httpOnly: true, sameSite: 'lax', secure });
  res.clearCookie(CSRF_COOKIE, { path: '/', sameSite: 'lax', secure });
}

export function extractToken(authorization?: string, cookieToken?: string): string | null {
  if (cookieToken) return cookieToken;
  if (authorization?.startsWith('Bearer ')) return authorization.slice(7).trim();
  return null;
}

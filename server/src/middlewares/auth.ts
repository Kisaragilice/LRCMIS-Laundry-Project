import type { NextFunction, Request, Response } from 'express';
import { prisma } from '../config/prisma';
import { CSRF_COOKIE, CSRF_HEADER, ROLES, type RoleName } from '../config/constants';
import { Forbidden, Unauthorized } from '../utils/errors';
import { extractToken, verifyToken } from '../utils/auth';

export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  try {
    const token = extractToken(
      req.headers.authorization,
      (req.cookies as Record<string, string> | undefined)?.['lrcmis_token'],
    );
    if (!token) throw Unauthorized();

    let payload;
    try {
      payload = verifyToken(token);
    } catch {
      throw Unauthorized('Sesi Anda telah berakhir. Silakan masuk kembali.');
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      include: { roles: { include: { role: true } } },
    });
    if (!user || !user.isActive || user.deletedAt) throw Unauthorized('Akun tidak ditemukan atau tidak aktif');

    req.auth = {
      userId: user.id,
      email: user.email,
      roles: user.roles.map((r) => r.role.name as RoleName),
    };
    next();
  } catch (error) {
    next(error);
  }
}

export function requireRoles(...allowed: RoleName[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth) return next(Unauthorized());
    const hasRole = req.auth.roles.some((role) => allowed.includes(role));
    if (!hasRole) return next(Forbidden());
    next();
  };
}

export function requireCustomerOrAdmin(adminOnly = false) {
  return requireRoles(adminOnly ? ROLES.ADMIN : ROLES.CUSTOMER, ...(adminOnly ? [] : [ROLES.ADMIN]));
}

/** Double-submit CSRF check for unsafe methods. */
export function csrfProtection(req: Request, _res: Response, next: NextFunction) {
  const unsafe = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method);
  if (!unsafe) return next();

  const cookieToken = (req.cookies as Record<string, string> | undefined)?.[CSRF_COOKIE];
  const headerToken = req.headers[CSRF_HEADER];
  const value = Array.isArray(headerToken) ? headerToken[0] : headerToken;

  // Public bootstrap endpoints are protected by rate limiting and do not yet
  // have an authenticated session. Once a CSRF cookie exists we always enforce it.
  const bootstrap = ['/auth/login', '/auth/register', '/auth/forgot-password', '/auth/reset-password'];
  if (!cookieToken && bootstrap.some((path) => req.originalUrl.endsWith(path))) {
    return next();
  }

  if (!cookieToken || !value || value !== cookieToken) {
    return next(Forbidden('Token CSRF tidak valid. Muat ulang halaman.'));
  }
  next();
}

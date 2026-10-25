import type { Request, Response } from 'express';
import * as authService from '../services/auth.service';
import { created, ok } from '../utils/http';
import { clientIp } from '../services/audit.service';
import { clearAuthCookies, createCsrfToken, parseDurationMs, setAuthCookies } from '../utils/auth';
import { CSRF_COOKIE } from '../config/constants';
import { env } from '../config/env';

export async function register(req: Request, res: Response) {
  const result = await authService.register({ ...req.body, ip: clientIp(req) });
  const csrf = setAuthCookies(res, result.token);
  return created(res, {
    user: authService.sanitizeUser(result.user),
    csrfToken: csrf,
  });
}

export async function login(req: Request, res: Response) {
  const result = await authService.login({ ...req.body, ip: clientIp(req) });
  const csrf = setAuthCookies(res, result.token);
  return ok(res, {
    user: authService.sanitizeUser(result.user),
    csrfToken: csrf,
  });
}

export async function logout(_req: Request, res: Response) {
  clearAuthCookies(res);
  return ok(res, { message: 'Anda telah keluar' });
}

export async function csrf(_req: Request, res: Response) {
  const token = createCsrfToken();
  res.cookie(CSRF_COOKIE, token, {
    httpOnly: false,
    secure: env.COOKIE_SECURE,
    sameSite: 'lax',
    path: '/',
    maxAge: parseDurationMs(env.JWT_EXPIRES_IN),
  });
  return ok(res, { csrfToken: token });
}

export async function forgotPassword(req: Request, res: Response) {
  const result = await authService.requestPasswordReset(req.body.email, clientIp(req));
  return ok(res, result);
}

export async function resetPassword(req: Request, res: Response) {
  const result = await authService.resetPassword(req.body.token, req.body.password, clientIp(req));
  return ok(res, result);
}

export async function me(req: Request, res: Response) {
  const user = await authService.getUserWithRoles(req.auth!.userId);
  return ok(res, { user: authService.sanitizeUser(user) });
}

export async function updateMe(req: Request, res: Response) {
  const user = await authService.updateProfile(req.auth!.userId, req.body, clientIp(req));
  return ok(res, { user: authService.sanitizeUser(user) });
}

export async function changePassword(req: Request, res: Response) {
  const result = await authService.changePassword(
    req.auth!.userId,
    req.body.currentPassword,
    req.body.newPassword,
    clientIp(req),
  );
  return ok(res, result);
}

import type { NextFunction, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { AppError } from '../utils/errors';
import { isProduction } from '../config/env';

export function notFound(req: Request, _res: Response, next: NextFunction) {
  next(new AppError(404, 'NOT_FOUND', `Endpoint ${req.method} ${req.originalUrl} tidak ditemukan`));
}

export function errorHandler(
  error: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
) {
  let status = 500;
  let code = 'INTERNAL_ERROR';
  let message = 'Terjadi kesalahan pada server';
  let details: unknown;

  if (error instanceof AppError) {
    status = error.status;
    code = error.code;
    message = error.message;
    details = error.details;
  } else if (error instanceof ZodError) {
    status = 400;
    code = 'VALIDATION_ERROR';
    message = 'Input tidak valid';
    details = error.issues.map((issue) => ({ field: issue.path.join('.'), message: issue.message }));
  } else if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      status = 409;
      code = 'DUPLICATE';
      message = 'Data dengan nilai unik tersebut sudah ada';
    } else if (error.code === 'P2025') {
      status = 404;
      code = 'NOT_FOUND';
      message = 'Data tidak ditemukan';
    } else if (error.code === 'P2003') {
      status = 409;
      code = 'RELATION_CONFLICT';
      message = 'Data masih digunakan oleh catatan lain';
    } else {
      status = 400;
      code = 'DATABASE_ERROR';
      message = 'Permintaan tidak dapat diproses oleh database';
    }
  }

  if (status >= 500) {
    console.error(`[ERROR] ${req.method} ${req.originalUrl}`, error);
  }

  res.status(status).json({
    success: false,
    error: {
      code,
      message,
      ...(details ? { details } : {}),
      ...(!isProduction() && status >= 500 && error instanceof Error
        ? { debug: error.message }
        : {}),
    },
  });
}

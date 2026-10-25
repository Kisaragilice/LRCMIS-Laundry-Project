export class AppError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const BadRequest = (message = 'Input tidak valid', details?: unknown) =>
  new AppError(400, 'VALIDATION_ERROR', message, details);

export const Unauthorized = (message = 'Anda belum terautentikasi') =>
  new AppError(401, 'UNAUTHENTICATED', message);

export const Forbidden = (message = 'Anda tidak memiliki izin untuk tindakan ini') =>
  new AppError(403, 'FORBIDDEN', message);

export const NotFound = (message = 'Data tidak ditemukan') =>
  new AppError(404, 'NOT_FOUND', message);

export const Conflict = (message = 'Terjadi konflik data', code = 'CONFLICT') =>
  new AppError(409, code, message);

import type { NextFunction, Request, RequestHandler, Response } from 'express';

export type AsyncHandler = (
  req: Request,
  res: Response,
  next: NextFunction,
) => Promise<unknown>;

/** Express 4 helper: routes async errors to the central error handler. */
export const asyncHandler =
  (handler: AsyncHandler): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };

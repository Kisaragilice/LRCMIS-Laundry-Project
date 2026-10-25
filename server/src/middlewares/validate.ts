import type { NextFunction, Request, Response } from 'express';
import { ZodError, type AnyZodObject, type ZodTypeAny } from 'zod';
import { BadRequest } from '../utils/errors';

type RequestPart = 'body' | 'query' | 'params';

interface ValidationSchemas {
  body?: ZodTypeAny;
  query?: AnyZodObject;
  params?: AnyZodObject;
}

/** Replaces req[part] with the parsed value so controllers only see valid data. */
export function validate(schemas: ValidationSchemas) {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      (['body', 'query', 'params'] as RequestPart[]).forEach((part) => {
        const schema = schemas[part];
        if (!schema) return;
        const result = schema.safeParse(req[part]);
        if (!result.success) throw result.error;
        req[part] = result.data as never;
      });
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const details = error.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        }));
        return next(BadRequest(details[0]?.message ?? 'Input tidak valid', details));
      }
      next(error);
    }
  };
}

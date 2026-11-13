import { Router } from 'express';
import * as geocodeController from '../controllers/geocode.controller';
import { authenticate } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import { geocodeLimiter } from '../middlewares/rateLimit';
import { asyncHandler } from '../utils/asyncHandler';
import { geocodeReverseQuery, geocodeSearchQuery } from '../validators/geocode.schema';

export const geocodeRouter = Router();

geocodeRouter.use(authenticate);
geocodeRouter.use(geocodeLimiter);

geocodeRouter.get('/search', validate({ query: geocodeSearchQuery }), asyncHandler(geocodeController.search));
geocodeRouter.get('/reverse', validate({ query: geocodeReverseQuery }), asyncHandler(geocodeController.reverse));

import { Router } from 'express';
import * as authController from '../controllers/auth.controller';
import * as usersController from '../controllers/users.controller';
import { validate } from '../middlewares/validate';
import { authenticate } from '../middlewares/auth';
import { authLimiter, passwordResetLimiter } from '../middlewares/rateLimit';
import { asyncHandler } from '../utils/asyncHandler';
import { forgotPasswordSchema, loginSchema, registerSchema, resetPasswordSchema } from '../validators/auth.schema';

export const authRouter = Router();

authRouter.post('/register', authLimiter, validate({ body: registerSchema }), asyncHandler(authController.register));
authRouter.post('/login', authLimiter, validate({ body: loginSchema }), asyncHandler(authController.login));
authRouter.post('/logout', asyncHandler(authController.logout));
authRouter.get('/csrf', asyncHandler(authController.csrf));
authRouter.post('/forgot-password', passwordResetLimiter, validate({ body: forgotPasswordSchema }), asyncHandler(authController.forgotPassword));
authRouter.post('/reset-password', passwordResetLimiter, validate({ body: resetPasswordSchema }), asyncHandler(authController.resetPassword));
authRouter.get('/me', authenticate, asyncHandler(usersController.getMe));

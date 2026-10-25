import { Router } from 'express';
import * as usersController from '../controllers/users.controller';
import * as authController from '../controllers/auth.controller';
import { authenticate } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import { asyncHandler } from '../utils/asyncHandler';
import { idParam } from '../validators/auth.schema';
import { addressSchema, addressUpdateSchema, changePasswordSchema, updateProfileSchema } from '../validators/auth.schema';

export const usersRouter = Router();

usersRouter.use(authenticate);

usersRouter.get('/me', asyncHandler(usersController.getMe));
usersRouter.patch('/me', validate({ body: updateProfileSchema }), asyncHandler(usersController.updateMe));
usersRouter.patch('/me/password', validate({ body: changePasswordSchema }), asyncHandler(authController.changePassword));

usersRouter.get('/me/addresses', asyncHandler(usersController.listAddresses));
usersRouter.post('/me/addresses', validate({ body: addressSchema }), asyncHandler(usersController.createAddress));
usersRouter.patch(
  '/me/addresses/:id',
  validate({ params: idParam, body: addressUpdateSchema }),
  asyncHandler(usersController.updateAddress),
);
usersRouter.delete('/me/addresses/:id', validate({ params: idParam }), asyncHandler(usersController.deleteAddress));

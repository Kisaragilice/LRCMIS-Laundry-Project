import { Router } from 'express';
import * as usersController from '../controllers/users.controller';
import * as reservationController from '../controllers/reservation.controller';
import * as promotionController from '../controllers/promotion.controller';
import * as feedbackController from '../controllers/feedback.controller';
import * as notificationController from '../controllers/notification.controller';
import * as orderController from '../controllers/order.controller';
import * as paymentController from '../controllers/payment.controller';
import { authenticate, requireRoles } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import { asyncHandler } from '../utils/asyncHandler';
import { ROLES } from '../config/constants';
import { idParam } from '../validators/auth.schema';
import { createReservationSchema, cancelReservationSchema } from '../validators/operations.schema';
import { validateVoucherSchema } from '../validators/commerce.schema';
import { complaintSchema, notificationQuery } from '../validators/engagement.schema';

export const catalogRouter = Router();
catalogRouter.get('/services', asyncHandler(usersController.publicServices));
catalogRouter.get('/config', asyncHandler(usersController.getConfig));

export const customerRouter = Router();
customerRouter.use(authenticate);

customerRouter.get('/time-slots', asyncHandler(usersController.customerSlots));
customerRouter.post(
  '/reservations',
  requireRoles(ROLES.CUSTOMER),
  validate({ body: createReservationSchema }),
  asyncHandler(reservationController.create),
);
customerRouter.get('/reservations/me', requireRoles(ROLES.CUSTOMER), asyncHandler(reservationController.listMine));
customerRouter.get(
  '/reservations/:id',
  requireRoles(ROLES.CUSTOMER, ROLES.ADMIN),
  validate({ params: idParam }),
  asyncHandler(reservationController.getOne),
);
customerRouter.patch(
  '/reservations/:id/cancel',
  requireRoles(ROLES.CUSTOMER, ROLES.ADMIN),
  validate({ params: idParam, body: cancelReservationSchema }),
  asyncHandler(reservationController.cancel),
);

customerRouter.get('/orders/me', requireRoles(ROLES.CUSTOMER), asyncHandler(orderController.listMine));
customerRouter.get('/payments/me', requireRoles(ROLES.CUSTOMER), asyncHandler(paymentController.myPayments));
customerRouter.get('/orders/:id', validate({ params: idParam }), asyncHandler(orderController.getOne));
customerRouter.get(
  '/orders/:id/payments',
  validate({ params: idParam }),
  asyncHandler(paymentController.listForOrder),
);
customerRouter.post(
  '/orders/:id/reviews',
  requireRoles(ROLES.CUSTOMER),
  validate({ params: idParam }),
  asyncHandler(feedbackController.createReview),
);
customerRouter.post(
  '/orders/:id/complaints',
  requireRoles(ROLES.CUSTOMER),
  validate({ params: idParam }),
  asyncHandler(feedbackController.createComplaintForOrder),
);

customerRouter.get('/notifications/me', validate({ query: notificationQuery }), asyncHandler(notificationController.listMine));
customerRouter.get('/notifications/me/unread-count', asyncHandler(notificationController.unreadCount));
customerRouter.patch('/notifications/:id/read', validate({ params: idParam }), asyncHandler(notificationController.markRead));
customerRouter.patch('/notifications/read-all', asyncHandler(notificationController.markAllRead));

customerRouter.get('/promotions', requireRoles(ROLES.CUSTOMER), asyncHandler(promotionController.customerList));
customerRouter.post(
  '/promotions/validate',
  requireRoles(ROLES.CUSTOMER),
  validate({ body: validateVoucherSchema }),
  asyncHandler(promotionController.validateVoucher),
);

customerRouter.post(
  '/complaints',
  requireRoles(ROLES.CUSTOMER),
  validate({ body: complaintSchema }),
  asyncHandler(feedbackController.createComplaint),
);
customerRouter.get('/complaints/me', requireRoles(ROLES.CUSTOMER), asyncHandler(feedbackController.myComplaints));

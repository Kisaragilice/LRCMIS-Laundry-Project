import { Router } from 'express';
import * as usersController from '../controllers/users.controller';
import * as accountController from '../controllers/account.controller';
import * as reservationController from '../controllers/reservation.controller';
import * as orderController from '../controllers/order.controller';
import * as paymentController from '../controllers/payment.controller';
import * as promotionController from '../controllers/promotion.controller';
import * as deliveryController from '../controllers/delivery.controller';
import * as feedbackController from '../controllers/feedback.controller';
import * as reportController from '../controllers/report.controller';
import * as maintenanceController from '../controllers/maintenance.controller';
import { authenticate, requireRoles } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import { asyncHandler } from '../utils/asyncHandler';
import { ROLES } from '../config/constants';
import { idParam } from '../validators/auth.schema';
import {
  adminCustomerQuery,
  adminOrderQuery,
  adminReservationQuery,
  assignStaffSchema,
  cancelReservationSchema,
  createOrderSchema,
  orderNoteSchema,
  orderStatusSchema,
  receiveOrderSchema,
  updateCustomerStatusSchema,
} from '../validators/operations.schema';
import { adminServiceQuery, serviceSchema, serviceUpdateSchema, slotQuery, slotSchema, slotUpdateSchema } from '../validators/catalog.schema';
import { adminPaymentQuery, createPaymentSchema, promotionSchema, promotionUpdateSchema, rejectPaymentSchema, refundPaymentSchema, verifyPaymentSchema } from '../validators/commerce.schema';
import { assignCourierSchema, complaintFollowUpSchema, complaintQuery, complaintUpdateSchema, courierTaskStatusSchema, createTaskSchema, reviewQuery } from '../validators/engagement.schema';
import { auditLogQuery, dashboardQuery, reportExportQuery, reportQuery } from '../validators/reports.schema';
import { accountQuery, accountStatusSchema, createAccountSchema } from '../validators/accounts.schema';
import { resetHistorySchema } from '../validators/maintenance.schema';

export const adminRouter = Router();
adminRouter.use(authenticate);

const admin = requireRoles(ROLES.ADMIN);
const analytics = requireRoles(ROLES.ADMIN, ROLES.OWNER);

// Dashboard & reports (owner read access)
adminRouter.get('/dashboard', analytics, validate({ query: dashboardQuery }), asyncHandler(reportController.dashboard));
adminRouter.get('/reports/revenue', analytics, validate({ query: reportQuery }), asyncHandler(reportController.revenue));
adminRouter.get('/reports/orders', analytics, validate({ query: reportQuery }), asyncHandler(reportController.orders));
adminRouter.get('/reports/services', analytics, validate({ query: reportQuery }), asyncHandler(reportController.services));
adminRouter.get('/reports/customers', analytics, validate({ query: reportQuery }), asyncHandler(reportController.customers));
adminRouter.get('/reports/operations', analytics, validate({ query: reportQuery }), asyncHandler(reportController.operations));
adminRouter.get('/reports/export', analytics, validate({ query: reportExportQuery }), asyncHandler(reportController.exportReport));
adminRouter.get('/audit-logs', admin, validate({ query: auditLogQuery }), asyncHandler(reportController.auditLogs));

// Services
adminRouter.get('/services', admin, validate({ query: adminServiceQuery }), asyncHandler(usersController.adminServices));
adminRouter.post('/services', admin, validate({ body: serviceSchema }), asyncHandler(usersController.createService));
adminRouter.patch('/services/:id', admin, validate({ params: idParam, body: serviceUpdateSchema }), asyncHandler(usersController.updateService));
adminRouter.patch('/services/:id/deactivate', admin, validate({ params: idParam }), asyncHandler(usersController.deactivateService));
adminRouter.delete('/services/:id', admin, validate({ params: idParam }), asyncHandler(usersController.deleteService));

// Time slots
adminRouter.get('/time-slots', admin, validate({ query: slotQuery }), asyncHandler(usersController.adminSlots));
adminRouter.post('/time-slots', admin, validate({ body: slotSchema }), asyncHandler(usersController.createSlot));
adminRouter.patch('/time-slots/:id', admin, validate({ params: idParam, body: slotUpdateSchema }), asyncHandler(usersController.updateSlot));
adminRouter.delete('/time-slots/:id', admin, validate({ params: idParam }), asyncHandler(usersController.deleteSlot));

// Account management (admin only; owner permissions are unchanged)
adminRouter.get('/accounts', admin, validate({ query: accountQuery }), asyncHandler(accountController.list));
adminRouter.post(
  '/accounts',
  admin,
  validate({ body: createAccountSchema }),
  asyncHandler(accountController.create),
);
adminRouter.patch(
  '/accounts/:id/status',
  admin,
  validate({ params: idParam, body: accountStatusSchema }),
  asyncHandler(accountController.setStatus),
);
adminRouter.delete('/accounts/:id', admin, validate({ params: idParam }), asyncHandler(accountController.remove));

// Maintenance (admin only)
adminRouter.get('/maintenance/history-summary', admin, asyncHandler(maintenanceController.historySummary));
adminRouter.post(
  '/maintenance/reset-history',
  admin,
  validate({ body: resetHistorySchema }),
  asyncHandler(maintenanceController.resetHistory),
);

// Customers & staff
adminRouter.get('/customers', admin, validate({ query: adminCustomerQuery }), asyncHandler(usersController.listCustomers));
adminRouter.get('/customers/:id', admin, validate({ params: idParam }), asyncHandler(usersController.getCustomer));
adminRouter.patch('/customers/:id/status', admin, validate({ params: idParam, body: updateCustomerStatusSchema }), asyncHandler(usersController.setCustomerStatus));
adminRouter.get('/staff', admin, asyncHandler(usersController.listStaff));

// Reservations
adminRouter.get('/reservations', admin, validate({ query: adminReservationQuery }), asyncHandler(reservationController.adminList));
adminRouter.patch('/reservations/:id/confirm', admin, validate({ params: idParam }), asyncHandler(reservationController.adminConfirm));
adminRouter.patch('/reservations/:id/cancel', admin, validate({ params: idParam, body: cancelReservationSchema }), asyncHandler(reservationController.adminCancel));
adminRouter.post('/reservations/:id/orders', admin, validate({ params: idParam, body: createOrderSchema }), asyncHandler(orderController.createFromReservation));

// Orders
adminRouter.get('/orders', admin, validate({ query: adminOrderQuery }), asyncHandler(orderController.adminList));
adminRouter.post('/orders/:id/receive', admin, validate({ params: idParam, body: receiveOrderSchema }), asyncHandler(orderController.receive));
adminRouter.patch('/orders/:id/status', admin, validate({ params: idParam, body: orderStatusSchema }), asyncHandler(orderController.changeStatus));
adminRouter.patch('/orders/:id/assign', admin, validate({ params: idParam, body: assignStaffSchema }), asyncHandler(orderController.assignStaff));
adminRouter.get('/orders/:id/notes', admin, validate({ params: idParam }), asyncHandler(orderController.listNotes));
adminRouter.post('/orders/:id/notes', admin, validate({ params: idParam, body: orderNoteSchema }), asyncHandler(orderController.addNote));
adminRouter.post('/orders/:id/tasks', admin, validate({ params: idParam, body: createTaskSchema }), asyncHandler(deliveryController.createTask));

// Delivery tasks
adminRouter.get('/delivery-tasks', admin, asyncHandler(deliveryController.adminList));
adminRouter.patch('/delivery-tasks/:id/assign', admin, validate({ params: idParam, body: assignCourierSchema }), asyncHandler(deliveryController.assign));

// Payments
adminRouter.post(
  '/orders/:id/payments',
  admin,
  validate({ params: idParam, body: createPaymentSchema }),
  asyncHandler(paymentController.createForOrder),
);
adminRouter.get('/payments', admin, validate({ query: adminPaymentQuery }), asyncHandler(paymentController.adminList));
adminRouter.patch('/payments/:id/verify', admin, validate({ params: idParam, body: verifyPaymentSchema }), asyncHandler(paymentController.verify));
adminRouter.patch('/payments/:id/reject', admin, validate({ params: idParam, body: rejectPaymentSchema }), asyncHandler(paymentController.reject));
adminRouter.patch('/payments/:id/refund', admin, validate({ params: idParam, body: refundPaymentSchema }), asyncHandler(paymentController.refund));

// Promotions
adminRouter.get('/promotions', admin, asyncHandler(promotionController.adminList));
adminRouter.post('/promotions', admin, validate({ body: promotionSchema }), asyncHandler(promotionController.createPromotion));
adminRouter.patch('/promotions/:id', admin, validate({ params: idParam, body: promotionUpdateSchema }), asyncHandler(promotionController.updatePromotion));

// Feedback
adminRouter.get('/reviews', admin, validate({ query: reviewQuery }), asyncHandler(feedbackController.adminReviews));
adminRouter.get('/complaints', admin, validate({ query: complaintQuery }), asyncHandler(feedbackController.adminComplaints));
adminRouter.patch('/complaints/:id', admin, validate({ params: idParam, body: complaintUpdateSchema }), asyncHandler(feedbackController.updateComplaint));
adminRouter.post('/complaints/:id/follow-ups', admin, validate({ params: idParam, body: complaintFollowUpSchema }), asyncHandler(feedbackController.followUp));

export const staffRouter = Router();
staffRouter.use(authenticate, requireRoles(ROLES.STAFF));
staffRouter.get('/orders', asyncHandler(orderController.staffList));
staffRouter.get('/orders/:id', validate({ params: idParam }), asyncHandler(orderController.getOne));
staffRouter.patch('/orders/:id/status', validate({ params: idParam, body: orderStatusSchema }), asyncHandler(orderController.changeStatus));
staffRouter.post('/orders/:id/notes', validate({ params: idParam, body: orderNoteSchema }), asyncHandler(orderController.addNote));

export const courierRouter = Router();
courierRouter.use(authenticate, requireRoles(ROLES.COURIER));
courierRouter.get('/tasks', asyncHandler(deliveryController.myTasks));
courierRouter.get('/tasks/:id', validate({ params: idParam }), asyncHandler(deliveryController.getTask));
courierRouter.patch('/tasks/:id/status', validate({ params: idParam, body: courierTaskStatusSchema }), asyncHandler(deliveryController.updateStatus));

export const publicRouter = Router();
publicRouter.get('/reviews/featured', asyncHandler(feedbackController.featuredReviews));

import { Router } from 'express';
import * as chatController from '../controllers/chat.controller';
import { authenticate, requireRoles } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import { asyncHandler } from '../utils/asyncHandler';
import { ROLES } from '../config/constants';
import {
  conversationIdParam,
  orderIdParam,
  sendMessageSchema,
  startConversationSchema,
} from '../validators/chat.schema';

export const chatRouter = Router();

chatRouter.use(authenticate);

chatRouter.get('/conversations', asyncHandler(chatController.listConversations));
chatRouter.get(
  '/conversations/:id/messages',
  validate({ params: conversationIdParam }),
  asyncHandler(chatController.getMessages),
);
chatRouter.post(
  '/conversations/:id/messages',
  validate({ params: conversationIdParam, body: sendMessageSchema }),
  asyncHandler(chatController.sendMessage),
);

chatRouter.post(
  '/conversations',
  requireRoles(ROLES.ADMIN),
  validate({ body: startConversationSchema }),
  asyncHandler(chatController.startConversation),
);
chatRouter.get('/contacts', requireRoles(ROLES.ADMIN), asyncHandler(chatController.listAdminContacts));

chatRouter.post(
  '/admin-thread',
  requireRoles(ROLES.CUSTOMER, ROLES.STAFF, ROLES.COURIER),
  asyncHandler(chatController.startAdminThread),
);

chatRouter.get(
  '/delivery-contacts',
  requireRoles(ROLES.CUSTOMER, ROLES.COURIER),
  asyncHandler(chatController.listDeliveryContacts),
);
chatRouter.post(
  '/orders/:orderId/thread',
  requireRoles(ROLES.CUSTOMER, ROLES.COURIER),
  validate({ params: orderIdParam }),
  asyncHandler(chatController.startOrderThread),
);

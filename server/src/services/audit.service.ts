import type { Request } from 'express';
import { prisma, type Tx } from '../config/prisma';
import { env } from '../config/env';

interface AuditInput {
  userId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
  ip?: string;
}

/** Audit records are written only by trusted backend services. */
export async function writeAudit(input: AuditInput, tx?: Tx) {
  const client = tx ?? prisma;
  await client.auditLog.create({
    data: {
      userId: input.userId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      metadata: (input.metadata ?? undefined) as never,
      ipAddress: input.ip ?? null,
    },
  });
}

export function clientIp(req: Request): string | undefined {
  return req.ip;
}

export const AUDIT = {
  USER_REGISTERED: 'user.registered',
  USER_LOGIN: 'user.login',
  USER_LOGOUT: 'user.logout',
  PASSWORD_RESET_REQUESTED: 'user.password_reset_requested',
  PASSWORD_RESET_EMAIL_FAILED: 'user.password_reset_email_failed',
  PASSWORD_RESET_COMPLETED: 'user.password_reset_completed',
  PROFILE_UPDATED: 'user.profile_updated',
  SERVICE_CREATED: 'service.created',
  SERVICE_UPDATED: 'service.updated',
  SERVICE_DEACTIVATED: 'service.deactivated',
  SLOT_CREATED: 'time_slot.created',
  SLOT_UPDATED: 'time_slot.updated',
  RESERVATION_CREATED: 'reservation.created',
  RESERVATION_CONFIRMED: 'reservation.confirmed',
  RESERVATION_CANCELLED: 'reservation.cancelled',
  RESERVATION_EXPIRED: 'reservation.expired',
  ORDER_CREATED: 'order.created',
  ORDER_RECEIVED: 'order.received',
  ORDER_STATUS_CHANGED: 'order.status_changed',
  ORDER_ASSIGNED: 'order.assigned',
  ORDER_NOTE_ADDED: 'order.note_added',
  PAYMENT_CREATED: 'payment.created',
  PAYMENT_VERIFIED: 'payment.verified',
  PAYMENT_REJECTED: 'payment.rejected',
  PAYMENT_REFUNDED: 'payment.refunded',
  PROMOTION_CREATED: 'promotion.created',
  PROMOTION_UPDATED: 'promotion.updated',
  DELIVERY_TASK_CREATED: 'delivery_task.created',
  DELIVERY_TASK_ASSIGNED: 'delivery_task.assigned',
  DELIVERY_TASK_STATUS: 'delivery_task.status_changed',
  COMPLAINT_CREATED: 'complaint.created',
  COMPLAINT_UPDATED: 'complaint.updated',
  CUSTOMER_STATUS_CHANGED: 'customer.status_changed',
  ACCOUNT_STATUS_CHANGED: 'account.status_changed',
  ACCOUNT_CREATED: 'account.created',
  ACCOUNT_DELETED: 'account.deleted',
  REVIEW_CREATED: 'review.created',
  REPORT_EXPORTED: 'report.exported',
} as const;

export function assertNoSecrets(metadata: Record<string, unknown>): void {
  if (env.NODE_ENV === 'production') {
    const serialized = JSON.stringify(metadata).toLowerCase();
    if (serialized.includes('password') || serialized.includes('token')) {
      throw new Error('Audit metadata must not contain secrets');
    }
  }
}

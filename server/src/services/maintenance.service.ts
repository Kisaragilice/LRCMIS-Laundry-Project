import { prisma } from '../config/prisma';

const historyCounts = {
  reservations: () => prisma.reservation.count(),
  orders: () => prisma.order.count(),
  payments: () => prisma.payment.count(),
  deliveryTasks: () => prisma.deliveryTask.count(),
  reviews: () => prisma.review.count(),
  complaints: () => prisma.complaint.count(),
  notifications: () => prisma.notification.count(),
  chatConversations: () => prisma.chatConversation.count(),
  auditLogs: () => prisma.auditLog.count(),
};

export interface HistorySummary {
  reservations: number;
  orders: number;
  payments: number;
  deliveryTasks: number;
  reviews: number;
  complaints: number;
  notifications: number;
  chatConversations: number;
  auditLogs: number;
}

export async function getHistorySummary(): Promise<HistorySummary> {
  const [reservations, orders, payments, deliveryTasks, reviews, complaints, notifications, chatConversations, auditLogs] =
    await Promise.all(Object.values(historyCounts).map((count) => count()));

  return {
    reservations,
    orders,
    payments,
    deliveryTasks,
    reviews,
    complaints,
    notifications,
    chatConversations,
    auditLogs,
  };
}

/**
 * Clears business/transaction history while preserving identities and master data:
 * users, roles, addresses, services, time slots, and promotions.
 *
 * Audit logs are intentionally not recreated after this operation because they are
 * part of the history being cleared. A successful reset can therefore not record its
 * own audit entry inside the same database.
 */
export async function resetHistory(): Promise<HistorySummary> {
  return prisma.$transaction(
    async (tx) => {
      const summary = {
        reservations: await tx.reservation.count(),
        orders: await tx.order.count(),
        payments: await tx.payment.count(),
        deliveryTasks: await tx.deliveryTask.count(),
        reviews: await tx.review.count(),
        complaints: await tx.complaint.count(),
        notifications: await tx.notification.count(),
        chatConversations: await tx.chatConversation.count(),
        auditLogs: await tx.auditLog.count(),
      };

      // Delete dependent records explicitly in foreign-key order.
      await tx.complaintFollowUp.deleteMany();
      await tx.complaint.deleteMany();
      await tx.review.deleteMany();
      await tx.chatConversation.deleteMany();
      await tx.notification.deleteMany();
      await tx.payment.deleteMany();
      await tx.deliveryTask.deleteMany();
      await tx.orderNote.deleteMany();
      await tx.orderStatusHistory.deleteMany();
      await tx.promotionRedemption.deleteMany();
      await tx.orderItem.deleteMany();
      await tx.order.deleteMany();
      await tx.reservationItem.deleteMany();
      await tx.reservation.deleteMany();
      await tx.auditLog.deleteMany();

      return summary;
    },
    { maxWait: 10_000, timeout: 60_000 },
  );
}

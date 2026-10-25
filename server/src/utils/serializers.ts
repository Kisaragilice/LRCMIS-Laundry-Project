import type { Address, DeliveryTask, Notification, Order, OrderItem, OrderStatusHistory, Payment, Promotion, Reservation, Service, TimeSlot, User } from '@prisma/client';
import { DateTime } from 'luxon';
import { invoiceNumber } from './codes';
import { dateOnlyToIso, slotStart, timeOnlyToHHmm, zone } from './datetime';
import { env } from '../config/env';

const num = (value: unknown): number => Number(value ?? 0);
const iso = (value: Date | null | undefined) => (value ? value.toISOString() : null);

export function serviceDto(service: Service) {
  return {
    id: service.id,
    name: service.name,
    description: service.description,
    price: num(service.price),
    pricingUnit: service.pricingUnit,
    estimatedHours: service.estimatedHours,
    isActive: service.isActive,
    createdAt: iso(service.createdAt),
    updatedAt: iso(service.updatedAt),
  };
}

export function slotTimes(slot: Pick<TimeSlot, 'slotDate' | 'startTime' | 'endTime'>) {
  const slotDate = dateOnlyToIso(slot.slotDate);
  const startTime = timeOnlyToHHmm(slot.startTime);
  const endTime = timeOnlyToHHmm(slot.endTime);
  return {
    slotDate,
    startTime,
    endTime,
    startsAt: slotStart(slotDate, startTime).toISOString(),
    endsAt: slotStart(slotDate, endTime).toISOString(),
  };
}

export function slotDto(slot: TimeSlot & { _count?: { reservations: number } }) {
  const reserved = slot._count?.reservations ?? 0;
  const remaining = Math.max(0, slot.capacity - reserved);
  return {
    id: slot.id,
    ...slotTimes(slot),
    capacity: slot.capacity,
    reserved,
    remaining,
    isAvailable: slot.isAvailable && remaining > 0,
    rawAvailable: slot.isAvailable,
  };
}

export function addressDto(address: Address) {
  return {
    id: address.id,
    userId: address.userId,
    label: address.label,
    recipientName: address.recipientName,
    phone: address.phone,
    addressText: address.addressText,
    latitude: address.latitude ? num(address.latitude) : null,
    longitude: address.longitude ? num(address.longitude) : null,
    isDefault: address.isDefault,
    createdAt: iso(address.createdAt),
  };
}

export function customerBrief(user: Pick<User, 'id' | 'name' | 'email' | 'phone'>) {
  return { id: user.id, name: user.name, email: user.email, phone: user.phone };
}

type ReservationFull = Reservation & {
  customer?: User;
  timeSlot: TimeSlot;
  address?: Address | null;
  items?: Array<{ id: string; serviceId: string; quantity: unknown; service?: Service }>;
  order?: Order | null;
};

export function reservationDto(reservation: ReservationFull) {
  return {
    id: reservation.id,
    reservationCode: reservation.reservationCode,
    status: reservation.status,
    pickupType: reservation.pickupType,
    notes: reservation.notes,
    customerId: reservation.customerId,
    customer: reservation.customer ? customerBrief(reservation.customer) : undefined,
    address: reservation.address ? addressDto(reservation.address) : null,
    timeSlot: { id: reservation.timeSlotId, ...slotTimes(reservation.timeSlot) },
    items: (reservation.items ?? []).map((item) => ({
      id: item.id,
      serviceId: item.serviceId,
      name: item.service?.name,
      price: item.service ? num(item.service.price) : undefined,
      pricingUnit: item.service?.pricingUnit,
      quantity: num(item.quantity),
    })),
    order: reservation.order
      ? { id: reservation.order.id, orderCode: reservation.order.orderCode, orderStatus: reservation.order.orderStatus }
      : null,
    createdAt: iso(reservation.createdAt),
    updatedAt: iso(reservation.updatedAt),
  };
}

export function orderItemDto(item: OrderItem) {
  return {
    id: item.id,
    serviceId: item.serviceId,
    serviceName: item.serviceNameSnapshot,
    price: num(item.priceSnapshot),
    quantity: num(item.quantity),
    unit: item.unit,
    lineTotal: num(item.lineTotal),
  };
}

export function statusHistoryDto(entry: OrderStatusHistory & { user?: User | null }) {
  return {
    id: entry.id,
    oldStatus: entry.oldStatus,
    newStatus: entry.newStatus,
    notes: entry.notes,
    createdAt: iso(entry.createdAt),
    changedBy: entry.user ? { id: entry.user.id, name: entry.user.name } : null,
  };
}

export function paymentDto(payment: Payment & { verifiedByUser?: User | null }) {
  return {
    id: payment.id,
    orderId: payment.orderId,
    amount: num(payment.amount),
    method: payment.method,
    status: payment.status,
    referenceCode: payment.referenceCode,
    notes: payment.notes,
    refundNote: payment.refundNote,
    paidAt: iso(payment.paidAt),
    verifiedAt: iso(payment.verifiedAt),
    refundedAt: iso(payment.refundedAt),
    createdAt: iso(payment.createdAt),
    verifiedBy: payment.verifiedByUser?.name ?? null,
  };
}

type OrderFull = Order & {
  customer?: User;
  assignedStaff?: User | null;
  items?: OrderItem[];
  statusHistory?: Array<OrderStatusHistory & { user?: User | null }>;
  payments?: Array<Payment & { verifiedByUser?: User | null }>;
  deliveryTasks?: Array<DeliveryTask & { courier?: User | null }>;
  reservation?: (Reservation & { timeSlot: TimeSlot; address?: Address | null; items?: Array<{ service?: Service; serviceId: string; quantity: unknown }> }) | null;
  review?: { rating: number; comment: string | null } | null;
};

export function orderDto(order: OrderFull, options: { includeCustomer?: boolean } = {}) {
  const paid = (order.payments ?? [])
    .filter((p) => p.status === 'paid')
    .reduce((sum, p) => sum + num(p.amount), 0);
  const reservation = order.reservation;
  return {
    id: order.id,
    orderCode: order.orderCode,
    invoiceNumber: invoiceNumber(order.orderCode),
    orderStatus: order.orderStatus,
    paymentStatus: order.paymentStatus,
    actualWeight: order.actualWeight === null ? null : num(order.actualWeight),
    subtotal: num(order.subtotal),
    discountAmount: num(order.discountAmount),
    deliveryFee: num(order.deliveryFee),
    totalAmount: num(order.totalAmount),
    paidAmount: paid,
    remainingAmount: Math.max(0, num(order.totalAmount) - paid),
    notes: order.notes,
    receivedAt: iso(order.receivedAt),
    completedAt: iso(order.completedAt),
    createdAt: iso(order.createdAt),
    updatedAt: iso(order.updatedAt),
    customerId: order.customerId,
    customer: options.includeCustomer && order.customer ? customerBrief(order.customer) : undefined,
    assignedStaff: order.assignedStaff ? customerBrief(order.assignedStaff) : null,
    reservation: reservation
      ? {
          id: reservation.id,
          reservationCode: reservation.reservationCode,
          pickupType: reservation.pickupType,
          address: reservation.address ? addressDto(reservation.address) : null,
          timeSlot: { id: reservation.timeSlotId, ...slotTimes(reservation.timeSlot) },
        }
      : null,
    items: (order.items ?? []).map(orderItemDto),
    timeline: (order.statusHistory ?? []).map(statusHistoryDto),
    payments: (order.payments ?? []).map(paymentDto),
    deliveryTasks: (order.deliveryTasks ?? []).map((task) => ({
      id: task.id,
      taskType: task.taskType,
      status: task.status,
      scheduledAt: iso(task.scheduledAt),
      completedAt: iso(task.completedAt),
      courier: task.courier ? customerBrief(task.courier) : null,
      handoverRecipient: task.handoverRecipient,
    })),
    review: order.review ?? null,
  };
}

export function promotionDto(promotion: Promotion & { _count?: { redemptions: number } }, includeUsage = false) {
  return {
    id: promotion.id,
    code: promotion.code,
    discountType: promotion.discountType,
    discountValue: num(promotion.discountValue),
    minPurchase: num(promotion.minPurchase),
    maxDiscount: promotion.maxDiscount === null ? null : num(promotion.maxDiscount),
    perUserLimit: promotion.perUserLimit,
    startAt: iso(promotion.startAt),
    endAt: iso(promotion.endAt),
    usageLimit: promotion.usageLimit,
    isActive: promotion.isActive,
    ...(includeUsage ? { usageCount: promotion._count?.redemptions ?? 0 } : {}),
  };
}

export function taskDto(task: DeliveryTask & {
  courier?: User | null;
  order?: (Order & { customer?: User; reservation?: (Reservation & { address?: Address | null; timeSlot: TimeSlot }) | null }) | null;
}) {
  return {
    id: task.id,
    orderId: task.orderId,
    taskType: task.taskType,
    status: task.status,
    scheduledAt: iso(task.scheduledAt),
    completedAt: iso(task.completedAt),
    notes: task.notes,
    courier: task.courier ? customerBrief(task.courier) : null,
    handoverRecipient: task.handoverRecipient,
    handoverConfirmedAt: iso(task.handoverConfirmedAt),
    addressSnapshot: task.addressSnapshot,
    contactPhone: task.contactPhone,
    order: task.order
      ? {
          id: task.order.id,
          orderCode: task.order.orderCode,
          orderStatus: task.order.orderStatus,
          paymentStatus: task.order.paymentStatus,
          totalAmount: num(task.order.totalAmount),
          customer: task.order.customer ? customerBrief(task.order.customer) : undefined,
          reservation: task.order.reservation
            ? {
                pickupType: task.order.reservation.pickupType,
                timeSlot: { id: task.order.reservation.timeSlotId, ...slotTimes(task.order.reservation.timeSlot) },
              }
            : null,
          address: task.order.reservation?.address ? addressDto(task.order.reservation.address) : null,
        }
      : undefined,
  };
}

export function notificationDto(notification: Notification) {
  return {
    id: notification.id,
    title: notification.title,
    message: notification.message,
    channel: notification.channel,
    status: notification.status,
    orderId: notification.orderId,
    readAt: iso(notification.readAt),
    createdAt: iso(notification.createdAt),
  };
}

export function localDateLabel(value: Date | string | null | undefined): string {
  if (!value) return '-';
  const dt = typeof value === 'string' ? DateTime.fromISO(value) : DateTime.fromJSDate(value);
  return dt.setZone(zone()).setLocale('id-ID').toFormat('dd MMM yyyy');
}

export function publicConfig() {
  return {
    businessTimezone: env.BUSINESS_TIMEZONE,
    minWeightKg: env.MIN_WEIGHT_KG,
    weightRoundingKg: env.WEIGHT_ROUNDING_KG,
    defaultDeliveryFee: env.DEFAULT_DELIVERY_FEE,
    reservationCancelCutoffHours: env.RESERVATION_CANCEL_CUTOFF_HOURS,
  };
}

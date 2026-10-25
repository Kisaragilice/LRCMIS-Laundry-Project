import { prisma } from '../config/prisma';
import { getCustomerReport, getOperationalReport, getOrderReport, getPopularServices, getRevenueReport } from './report.service';
import { customerBrief, paymentDto, reservationDto, slotDto } from '../utils/serializers';

export async function getDashboard(input: { from?: string; to?: string }) {
  const [revenue, orders, services, customers, operations, recentOrders, pendingReservations, pendingPayments, averageRating, upcomingSlots] =
    await Promise.all([
      getRevenueReport(input),
      getOrderReport(input),
      getPopularServices(input),
      getCustomerReport(input),
      getOperationalReport(input),
      prisma.order.findMany({
        take: 8,
        orderBy: { createdAt: 'desc' },
        include: { customer: true, items: true },
      }),
      prisma.reservation.findMany({
        where: { status: 'pending' },
        take: 6,
        orderBy: { createdAt: 'asc' },
        include: { customer: true, timeSlot: true, items: { include: { service: true } } },
      }),
      prisma.payment.findMany({
        where: { status: 'pending' },
        take: 6,
        orderBy: { createdAt: 'asc' },
        include: { order: { include: { customer: true } } },
      }),
      prisma.review.aggregate({ _avg: { rating: true }, _count: { _all: true } }),
      prisma.timeSlot.findMany({
        where: { slotDate: { gte: new Date() }, isAvailable: true },
        orderBy: [{ slotDate: 'asc' }, { startTime: 'asc' }],
        take: 6,
        include: { _count: { select: { reservations: { where: { status: { in: ['pending', 'confirmed'] } } } } } },
      }),
    ]);

  return {
    revenue,
    orders,
    popularServices: services.data.slice(0, 5),
    customers,
    operations,
    recentOrders: recentOrders.map((order) => ({
      id: order.id,
      orderCode: order.orderCode,
      orderStatus: order.orderStatus,
      paymentStatus: order.paymentStatus,
      totalAmount: Number(order.totalAmount),
      createdAt: order.createdAt.toISOString(),
      customer: order.customer ? customerBrief(order.customer) : undefined,
      itemCount: order.items.length,
    })),
    pendingReservations: pendingReservations.map((reservation) => reservationDto(reservation)),
    pendingPayments: pendingPayments.map((payment) => ({
      ...paymentDto(payment),
      order: payment.order
        ? {
            id: payment.order.id,
            orderCode: payment.order.orderCode,
            orderStatus: payment.order.orderStatus,
            totalAmount: Number(payment.order.totalAmount),
            customer: payment.order.customer ? customerBrief(payment.order.customer) : undefined,
          }
        : undefined,
    })),
    reviews: {
      averageRating: averageRating._avg.rating ? Number(averageRating._avg.rating.toFixed(2)) : null,
      total: averageRating._count._all,
    },
    upcomingSlots: upcomingSlots.map((slot) => slotDto(slot)),
  };
}

import { DateTime } from 'luxon';
import { prisma } from '../config/prisma';
import { BadRequest } from '../utils/errors';
import { defaultRange, zone } from '../utils/datetime';
import { money } from '../utils/money';

interface RangeInput {
  from?: string;
  to?: string;
  groupBy?: 'day' | 'month';
}

function resolveRange(input: RangeInput) {
  const range = defaultRange(input.from, input.to);
  if (range.end < range.start) throw BadRequest('Tanggal akhir harus setelah tanggal mulai');
  return range;
}

function bucketKey(date: Date, groupBy: 'day' | 'month'): string {
  return DateTime.fromJSDate(date).setZone(zone()).toFormat(groupBy === 'month' ? 'yyyy-MM' : 'yyyy-MM-dd');
}

function emptyBuckets(start: DateTime, end: DateTime, groupBy: 'day' | 'month'): string[] {
  const keys: string[] = [];
  let cursor = start.startOf(groupBy === 'month' ? 'month' : 'day');
  const last = end.startOf(groupBy === 'month' ? 'month' : 'day');
  while (cursor <= last && keys.length < 400) {
    keys.push(cursor.toFormat(groupBy === 'month' ? 'yyyy-MM' : 'yyyy-MM-dd'));
    cursor = cursor.plus(groupBy === 'month' ? { months: 1 } : { days: 1 });
  }
  return keys;
}

export async function getRevenueReport(input: RangeInput) {
  const range = resolveRange(input);
  const groupBy = input.groupBy ?? 'day';

  const [paidPayments, refundedPayments, orders] = await Promise.all([
    prisma.payment.findMany({
      where: { status: 'paid', paidAt: { gte: range.start.toJSDate(), lte: range.end.toJSDate() } },
      include: { order: { select: { orderCode: true, customerId: true } } },
      orderBy: { paidAt: 'asc' },
    }),
    prisma.payment.findMany({
      where: { status: 'refunded', refundedAt: { gte: range.start.toJSDate(), lte: range.end.toJSDate() } },
      include: { order: { select: { orderCode: true } } },
    }),
    prisma.order.findMany({
      where: { createdAt: { gte: range.start.toJSDate(), lte: range.end.toJSDate() } },
      select: { id: true, totalAmount: true, orderStatus: true, paymentStatus: true },
    }),
  ]);

  const grossRevenue = paidPayments.reduce((sum, p) => sum.add(p.amount), money(0));
  const refunds = refundedPayments.reduce((sum, p) => sum.add(p.amount), money(0));
  const completedOrders = orders.filter((o) => o.orderStatus === 'completed');
  const totalOrderValue = completedOrders.reduce((sum, o) => sum.add(o.totalAmount), money(0));

  const buckets = emptyBuckets(range.start, range.end, groupBy);
  const series = buckets.map((period) => ({ period, revenue: 0, refunds: 0, transactions: 0 }));
  const byPeriod = new Map(series.map((row) => [row.period, row]));

  for (const payment of paidPayments) {
    if (!payment.paidAt) continue;
    const row = byPeriod.get(bucketKey(payment.paidAt, groupBy));
    if (row) {
      row.revenue = Number((row.revenue + Number(payment.amount)).toFixed(2));
      row.transactions += 1;
    }
  }
  for (const payment of refundedPayments) {
    if (!payment.refundedAt) continue;
    const row = byPeriod.get(bucketKey(payment.refundedAt, groupBy));
    if (row) row.refunds = Number((row.refunds + Number(payment.amount)).toFixed(2));
  }

  const methodMap = new Map<string, { method: string; amount: number; count: number }>();
  for (const payment of paidPayments) {
    const existing = methodMap.get(payment.method) ?? { method: payment.method, amount: 0, count: 0 };
    existing.amount = Number((existing.amount + Number(payment.amount)).toFixed(2));
    existing.count += 1;
    methodMap.set(payment.method, existing);
  }

  return {
    period: { from: range.from, to: range.to, groupBy },
    summary: {
      grossRevenue: Number(grossRevenue),
      refunds: Number(refunds),
      netRevenue: Number(grossRevenue.sub(refunds)),
      paidTransactions: paidPayments.length,
      refundTransactions: refundedPayments.length,
      totalOrders: orders.length,
      completedOrders: completedOrders.length,
      completedOrderValue: Number(totalOrderValue),
      averageOrderValue:
        completedOrders.length > 0 ? Number(totalOrderValue.div(completedOrders.length).toDecimalPlaces(2)) : 0,
    },
    series,
    paymentMethods: [...methodMap.values()],
    recentPayments: paidPayments.slice(-10).reverse().map((payment) => ({
      id: payment.id,
      orderCode: payment.order?.orderCode,
      amount: Number(payment.amount),
      method: payment.method,
      paidAt: payment.paidAt,
      referenceCode: payment.referenceCode,
    })),
    empty: paidPayments.length === 0 && refundedPayments.length === 0 && orders.length === 0,
  };
}

export async function getOrderReport(input: RangeInput) {
  const range = resolveRange(input);
  const groupBy = input.groupBy ?? 'day';
  const orders = await prisma.order.findMany({
    where: { createdAt: { gte: range.start.toJSDate(), lte: range.end.toJSDate() } },
    select: {
      id: true,
      orderStatus: true,
      paymentStatus: true,
      totalAmount: true,
      createdAt: true,
      completedAt: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  const statuses = ['pending', 'received', 'washing', 'drying', 'ironing', 'packaging', 'ready', 'delivering', 'completed', 'cancelled', 'on_hold'];
  const byStatus = statuses.map((status) => ({ status, count: orders.filter((o) => o.orderStatus === status).length }));
  const paymentStatuses = ['unpaid', 'partial', 'paid', 'refunded'];
  const byPaymentStatus = paymentStatuses.map((status) => ({
    status,
    count: orders.filter((o) => o.paymentStatus === status).length,
  }));

  const buckets = emptyBuckets(range.start, range.end, groupBy);
  const series = buckets.map((period) => ({ period, orders: 0, completed: 0, cancelled: 0, value: 0 }));
  const byPeriod = new Map(series.map((row) => [row.period, row]));
  for (const order of orders) {
    const row = byPeriod.get(bucketKey(order.createdAt, groupBy));
    if (!row) continue;
    row.orders += 1;
    if (order.orderStatus === 'completed') row.completed += 1;
    if (order.orderStatus === 'cancelled') row.cancelled += 1;
    if (order.orderStatus !== 'cancelled') row.value = Number((row.value + Number(order.totalAmount)).toFixed(2));
  }

  const totalValue = orders
    .filter((o) => o.orderStatus !== 'cancelled')
    .reduce((sum, o) => sum + Number(o.totalAmount), 0);

  return {
    period: { from: range.from, to: range.to, groupBy },
    summary: {
      totalOrders: orders.length,
      completedOrders: orders.filter((o) => o.orderStatus === 'completed').length,
      cancelledOrders: orders.filter((o) => o.orderStatus === 'cancelled').length,
      activeOrders: orders.filter((o) => !['completed', 'cancelled'].includes(o.orderStatus)).length,
      totalOrderValue: Number(totalValue.toFixed(2)),
      completionRate:
        orders.length > 0
          ? Number(((orders.filter((o) => o.orderStatus === 'completed').length / orders.length) * 100).toFixed(1))
          : 0,
    },
    byStatus,
    byPaymentStatus,
    series,
    empty: orders.length === 0,
  };
}

export async function getPopularServices(input: RangeInput) {
  const range = resolveRange(input);
  const grouped = await prisma.orderItem.groupBy({
    by: ['serviceId'],
    where: {
      order: {
        createdAt: { gte: range.start.toJSDate(), lte: range.end.toJSDate() },
        orderStatus: { not: 'cancelled' },
      },
    },
    _sum: { lineTotal: true, quantity: true },
    _count: { _all: true },
    orderBy: { _sum: { lineTotal: 'desc' } },
    take: 10,
  });

  const services = await prisma.service.findMany({
    where: { id: { in: grouped.map((g) => g.serviceId) } },
  });
  const serviceMap = new Map(services.map((s) => [s.id, s]));

  return {
    period: { from: range.from, to: range.to },
    data: grouped.map((row) => {
      const service = serviceMap.get(row.serviceId);
      return {
        serviceId: row.serviceId,
        name: service?.name ?? 'Layanan',
        pricingUnit: service?.pricingUnit ?? 'piece',
        orderCount: row._count._all,
        quantity: Number(row._sum.quantity ?? 0),
        value: Number(row._sum.lineTotal ?? 0),
      };
    }),
    empty: grouped.length === 0,
  };
}

export async function getCustomerReport(input: RangeInput) {
  const range = resolveRange(input);
  const [orders, newCustomers, totalCustomers] = await Promise.all([
    prisma.order.findMany({
      where: { createdAt: { gte: range.start.toJSDate(), lte: range.end.toJSDate() } },
      select: { customerId: true, totalAmount: true },
    }),
    prisma.user.count({
      where: {
        createdAt: { gte: range.start.toJSDate(), lte: range.end.toJSDate() },
        roles: { some: { role: { name: 'customer' } } },
      },
    }),
    prisma.user.count({ where: { roles: { some: { role: { name: 'customer' } } }, isActive: true } }),
  ]);

  const counts = new Map<string, { orders: number; value: number }>();
  for (const order of orders) {
    const entry = counts.get(order.customerId) ?? { orders: 0, value: 0 };
    entry.orders += 1;
    entry.value += Number(order.totalAmount);
    counts.set(order.customerId, entry);
  }

  const topCustomerIds = [...counts.entries()]
    .sort((a, b) => b[1].value - a[1].value)
    .slice(0, 10)
    .map(([id]) => id);
  const users = await prisma.user.findMany({
    where: { id: { in: topCustomerIds } },
    select: { id: true, name: true, email: true },
  });
  const userMap = new Map(users.map((u) => [u.id, u]));

  return {
    period: { from: range.from, to: range.to },
    summary: {
      activeCustomers: counts.size,
      newCustomers,
      repeatCustomers: [...counts.values()].filter((c) => c.orders > 1).length,
      totalActiveCustomers: totalCustomers,
      averageOrdersPerCustomer: counts.size > 0 ? Number((orders.length / counts.size).toFixed(2)) : 0,
    },
    topCustomers: topCustomerIds.map((id) => ({
      id,
      name: userMap.get(id)?.name ?? 'Pelanggan',
      email: userMap.get(id)?.email ?? '',
      orderCount: counts.get(id)!.orders,
      totalValue: Number(counts.get(id)!.value.toFixed(2)),
    })),
    empty: orders.length === 0,
  };
}

export async function getOperationalReport(input: RangeInput) {
  const range = resolveRange(input);
  const [completedOrders, activeByStatus, pendingReservations, unassignedTasks, taskStats] = await Promise.all([
    prisma.order.findMany({
      where: {
        createdAt: { gte: range.start.toJSDate(), lte: range.end.toJSDate() },
        orderStatus: 'completed',
        completedAt: { not: null },
      },
      select: { receivedAt: true, createdAt: true, completedAt: true },
    }),
    prisma.order.groupBy({
      by: ['orderStatus'],
      where: { orderStatus: { notIn: ['completed', 'cancelled'] } },
      _count: { _all: true },
    }),
    prisma.reservation.count({ where: { status: 'pending' } }),
    prisma.deliveryTask.count({ where: { courierId: null, status: 'assigned' } }),
    prisma.deliveryTask.groupBy({ by: ['status'], _count: { _all: true } }),
  ]);

  const durations = completedOrders
    .filter((o) => o.completedAt)
    .map((o) => (o.completedAt!.getTime() - (o.receivedAt ?? o.createdAt).getTime()) / 3_600_000);
  const averageHours =
    durations.length > 0 ? Number((durations.reduce((a, b) => a + b, 0) / durations.length).toFixed(1)) : 0;

  return {
    period: { from: range.from, to: range.to },
    summary: {
      averageCompletionHours: averageHours,
      completedOrders: completedOrders.length,
      pendingReservations,
      unassignedDeliveryTasks: unassignedTasks,
    },
    activeByStatus: activeByStatus.map((row) => ({ status: row.orderStatus, count: row._count._all })),
    deliveryTaskStats: taskStats.map((row) => ({ status: row.status, count: row._count._all })),
    empty: completedOrders.length === 0 && activeByStatus.length === 0,
  };
}

export function toCsv(rows: Array<Record<string, unknown>>, columns: Array<{ key: string; label: string }>): string {
  const escape = (value: unknown) => {
    if (value === null || value === undefined) return '';
    const text = String(value);
    return /[",\n;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const header = columns.map((c) => escape(c.label)).join(',');
  const lines = rows.map((row) => columns.map((c) => escape(row[c.key])).join(','));
  return `\uFEFF${[header, ...lines].join('\r\n')}`;
}

export async function buildExport(input: { type: 'revenue' | 'orders' | 'services' | 'customers'; from?: string; to?: string }) {
  const range = resolveRange(input);
  if (input.type === 'revenue') {
    const report = await getRevenueReport({ ...range, groupBy: 'day' });
    return {
      filename: `laporan-pendapatan-${range.from}-${range.to}.csv`,
      csv: toCsv(report.series, [
        { key: 'period', label: 'Tanggal' },
        { key: 'transactions', label: 'Jumlah Transaksi' },
        { key: 'revenue', label: 'Pendapatan (IDR)' },
        { key: 'refunds', label: 'Refund (IDR)' },
      ]),
    };
  }
  if (input.type === 'orders') {
    const report = await getOrderReport({ ...range, groupBy: 'day' });
    return {
      filename: `laporan-pesanan-${range.from}-${range.to}.csv`,
      csv: toCsv(report.series, [
        { key: 'period', label: 'Tanggal' },
        { key: 'orders', label: 'Pesanan' },
        { key: 'completed', label: 'Selesai' },
        { key: 'cancelled', label: 'Dibatalkan' },
        { key: 'value', label: 'Nilai Pesanan (IDR)' },
      ]),
    };
  }
  if (input.type === 'services') {
    const report = await getPopularServices({ ...range });
    return {
      filename: `laporan-layanan-${range.from}-${range.to}.csv`,
      csv: toCsv(report.data, [
        { key: 'name', label: 'Layanan' },
        { key: 'pricingUnit', label: 'Satuan' },
        { key: 'orderCount', label: 'Jumlah Pesanan' },
        { key: 'quantity', label: 'Total Kuantitas' },
        { key: 'value', label: 'Nilai (IDR)' },
      ]),
    };
  }
  const report = await getCustomerReport({ ...range });
  return {
    filename: `laporan-pelanggan-${range.from}-${range.to}.csv`,
    csv: toCsv(report.topCustomers, [
      { key: 'name', label: 'Pelanggan' },
      { key: 'email', label: 'Email' },
      { key: 'orderCount', label: 'Jumlah Pesanan' },
      { key: 'totalValue', label: 'Nilai Transaksi (IDR)' },
    ]),
  };
}

export async function listAuditLogs(filters: {
  action?: string;
  entityType?: string;
  page: number;
  limit: number;
  skip: number;
}) {
  const where = {
    ...(filters.action ? { action: { contains: filters.action, mode: 'insensitive' as const } } : {}),
    ...(filters.entityType ? { entityType: filters.entityType } : {}),
  };
  const [total, rows] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
      skip: filters.skip,
      take: filters.limit,
    }),
  ]);
  return { total, rows };
}

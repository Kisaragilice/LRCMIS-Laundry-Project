import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ArrowRight,
  CalendarCheck,
  Clock,
  Package,
  ShoppingBag,
  Star,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  StatCard,
  StatusBadge,
} from '../../components/ui';
import { DataTable, Stars, Td, Th } from '../../components/common';
import { useApi } from '../../lib/useApi';
import { useAuth } from '../../lib/auth';
import { api } from '../../lib/api';
import { useToast } from '../../lib/toast';
import {
  addDaysIso,
  formatCurrency,
  formatDate,
  formatDateTime,
  monthStartIso,
  orderStatusLabel,
  reservationStatusLabel,
  todayIso,
} from '../../lib/format';
import type { DashboardData } from '../../lib/types';

type RangeKey = '7' | '30' | '90' | 'month';

const ranges: Array<{ key: RangeKey; label: string }> = [
  { key: '7', label: '7 hari' },
  { key: '30', label: '30 hari' },
  { key: '90', label: '90 hari' },
  { key: 'month', label: 'Bulan ini' },
];

const statusColors: Record<string, string> = {
  pending: '#f59e0b',
  received: '#38bdf8',
  washing: '#2f86f6',
  drying: '#6366f1',
  ironing: '#8b5cf6',
  packaging: '#0ea5e9',
  ready: '#12a8a7',
  delivering: '#14b8a6',
  completed: '#10b981',
  cancelled: '#f43f5e',
  on_hold: '#94a3b8',
};

function rangeBounds(range: RangeKey): { from: string; to: string } {
  const to = todayIso();
  if (range === 'month') return { from: monthStartIso(), to };
  const days = range === '7' ? 6 : range === '30' ? 29 : 89;
  return { from: addDaysIso(-days), to };
}

export function AdminDashboardPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [range, setRange] = useState<RangeKey>('30');
  const [confirming, setConfirming] = useState<string | null>(null);
  const isAdmin = Boolean(user?.roles.includes('admin'));
  const { from, to } = rangeBounds(range);
  const dashboard = useApi<DashboardData>(`/admin/dashboard?from=${from}&to=${to}`, [from, to]);

  const confirm = async (id: string) => {
    setConfirming(id);
    try {
      await api.patch(`/admin/reservations/${id}/confirm`);
      toast('Reservasi dikonfirmasi');
      dashboard.refetch();
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Gagal mengonfirmasi reservasi', 'error');
    } finally {
      setConfirming(null);
    }
  };

  if (dashboard.loading) return <LoadingState label="Memuat dashboard operasional..." />;
  if (dashboard.error || !dashboard.data) {
    return <ErrorState message={dashboard.error ?? 'Dashboard tidak tersedia'} onRetry={dashboard.refetch} />;
  }

  const data = dashboard.data;
  const series = data.revenue.series.map((row) => ({
    ...row,
    label: row.period.length === 7 ? row.period : formatDate(`${row.period}T12:00:00+07:00`).replace(/ \d{4}$/, ''),
  }));
  const orderSeries = data.orders.series.map((row) => ({
    ...row,
    label: row.period.length === 7 ? row.period : formatDate(`${row.period}T12:00:00+07:00`).replace(/ \d{4}$/, ''),
  }));
  const statusData = data.orders.byStatus
    .filter((row) => row.count > 0)
    .map((row) => ({
      ...row,
      label: orderStatusLabel[row.status] ?? row.status,
      color: statusColors[row.status] ?? '#94a3b8',
    }));
  const pendingCount = data.operations.summary.pendingReservations + data.pendingPayments.length;

  return (
    <div>
      <PageHeader
        eyebrow={isAdmin ? 'Operasional' : 'Kepemilikan'}
        title={isAdmin ? 'Dashboard operasional' : 'Ringkasan bisnis'}
        description="Pendapatan, pesanan, pelanggan, dan antrean operasional dari data aktual."
        actions={
          isAdmin ? (
            <>
              <Link to="/admin/reservasi">
                <Button variant="outline" icon={<CalendarCheck className="h-4 w-4" />}>
                  Reservasi
                </Button>
              </Link>
              <Link to="/admin/laporan">
                <Button icon={<TrendingUp className="h-4 w-4" />}>Laporan</Button>
              </Link>
            </>
          ) : (
            <Link to="/owner/laporan">
              <Button icon={<TrendingUp className="h-4 w-4" />}>Buka laporan</Button>
            </Link>
          )
        }
      />

      <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-ink-100 bg-white p-3 shadow-card sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-1 overflow-x-auto rounded-xl bg-sand-100 p-1" role="group" aria-label="Rentang tanggal dashboard">
          {ranges.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => setRange(option.key)}
              aria-pressed={range === option.key}
              className={`whitespace-nowrap rounded-lg px-3.5 py-2 text-xs font-bold transition ${
                range === option.key ? 'bg-white text-brand-700 shadow-sm' : 'text-ink-500 hover:text-ink-800'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
        <p className="px-2 text-xs text-ink-500">
          Periode <span className="font-semibold text-ink-800">{formatDate(from)}</span> –{' '}
          <span className="font-semibold text-ink-800">{formatDate(to)}</span>
        </p>
      </div>

      {pendingCount > 0 && (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200/70 bg-amber-50 px-4 py-3.5 text-sm text-amber-900">
          <p className="flex items-center gap-2">
            <Clock className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>
              <strong>{data.operations.summary.pendingReservations}</strong> reservasi dan{' '}
              <strong>{data.pendingPayments.length}</strong> pembayaran menunggu tindakan.
            </span>
          </p>
          <Link to={isAdmin ? '/admin/reservasi' : '/owner/laporan'} className="inline-flex items-center gap-1 text-xs font-bold hover:underline">
            Tinjau sekarang <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Pendapatan bersih"
          value={formatCurrency(data.revenue.summary.netRevenue)}
          hint={`${data.revenue.summary.paidTransactions} transaksi lunas · refund ${formatCurrency(data.revenue.summary.refunds)}`}
          icon={<Wallet className="h-5 w-5" />}
          tone="dark"
          to={isAdmin ? '/admin/pembayaran' : '/owner/laporan'}
        />
        <StatCard
          label="Total pesanan"
          value={data.orders.summary.totalOrders}
          hint={`${data.orders.summary.activeOrders} masih berjalan`}
          icon={<ShoppingBag className="h-5 w-5" />}
          to={isAdmin ? '/admin/pesanan' : '/owner/laporan'}
        />
        <StatCard
          label="Pelanggan aktif"
          value={data.customers.summary.activeCustomers}
          hint={`${data.customers.summary.newCustomers} pelanggan baru`}
          icon={<Users className="h-5 w-5" />}
          tone="teal"
          to={isAdmin ? '/admin/pelanggan' : '/owner/laporan'}
        />
        <StatCard
          label="Rating rata-rata"
          value={data.reviews.averageRating?.toFixed(1) ?? '—'}
          hint={`${data.reviews.total} ulasan · ${data.orders.summary.completionRate}% selesai`}
          icon={<Star className="h-5 w-5" />}
          tone="sand"
          to={isAdmin ? '/admin/ulasan' : '/owner/laporan'}
        />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 xl:items-start xl:grid-cols-[1.55fr_0.75fr]">
        <Card className="p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-extrabold text-ink-950">Tren pendapatan</h2>
              <p className="mt-1 text-xs text-ink-500">Pembayaran lunas per periode, dikurangi refund.</p>
            </div>
            <div className="flex flex-wrap gap-4 text-xs">
              <span className="inline-flex items-center gap-1.5 text-ink-500">
                <span className="h-2 w-2 rounded-full bg-brand-500" aria-hidden="true" /> Pendapatan
              </span>
              <span className="inline-flex items-center gap-1.5 text-ink-500">
                <span className="h-2 w-2 rounded-full bg-rose-400" aria-hidden="true" /> Refund
              </span>
            </div>
          </div>
          <div className="mt-4 h-64 w-full">
            {series.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-ink-400">Belum ada data pendapatan.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={series} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#2f86f6" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#2f86f6" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eef2f8" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    axisLine={false}
                    tickLine={false}
                    width={64}
                    tickFormatter={(value) => `${Math.round(Number(value) / 1000)}k`}
                  />
                  <Tooltip
                    formatter={(value, name) => [
                      formatCurrency(Number(value)),
                      name === 'revenue' ? 'Pendapatan' : 'Refund',
                    ]}
                    labelStyle={{ fontSize: 12, color: '#0f172a' }}
                    contentStyle={{ borderRadius: 12, borderColor: '#e2e8f0', fontSize: 12 }}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="#1a6bea" strokeWidth={2.5} fill="url(#revenueFill)" />
                  <Area
                    type="monotone"
                    dataKey="refunds"
                    stroke="#fb7185"
                    strokeWidth={2}
                    fill="transparent"
                    strokeDasharray="4 3"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        <Card className="p-5 sm:p-6">
          <div>
            <h2 className="text-base font-extrabold text-ink-950">Distribusi status</h2>
            <p className="mt-1 text-xs text-ink-500">Pesanan pada periode terpilih.</p>
          </div>
          {statusData.length === 0 ? (
            <div className="flex h-[240px] items-center justify-center text-sm text-ink-400">Belum ada pesanan.</div>
          ) : (
            <>
              <div className="relative mx-auto mt-2 h-[190px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusData}
                      dataKey="count"
                      nameKey="label"
                      innerRadius={54}
                      outerRadius={80}
                      paddingAngle={2}
                      strokeWidth={0}
                    >
                      {statusData.map((entry) => (
                        <Cell key={entry.status} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value, name) => [`${value} pesanan`, name]}
                      contentStyle={{ borderRadius: 12, borderColor: '#e2e8f0', fontSize: 12 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <p className="text-2xl font-extrabold text-ink-950">{data.orders.summary.totalOrders}</p>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-400">Pesanan</p>
                </div>
              </div>
              <ul className="mt-2 space-y-2">
                {statusData.slice(0, 6).map((entry) => (
                  <li key={entry.status} className="flex items-center justify-between gap-3 text-xs">
                    <span className="inline-flex min-w-0 items-center gap-2 text-ink-600">
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: entry.color }} aria-hidden="true" />
                      <span className="truncate">{entry.label}</span>
                    </span>
                    <span className="font-bold text-ink-900">{entry.count}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 xl:items-start xl:grid-cols-[1.55fr_0.75fr]">
        <Card className="p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-extrabold text-ink-950">Volume pesanan</h2>
              <p className="mt-1 text-xs text-ink-500">Jumlah pesanan masuk dan yang selesai per periode.</p>
            </div>
            <div className="flex gap-4 text-xs">
              <span className="inline-flex items-center gap-1.5 text-ink-500">
                <span className="h-2 w-2 rounded-full bg-brand-500" aria-hidden="true" /> Masuk
              </span>
              <span className="inline-flex items-center gap-1.5 text-ink-500">
                <span className="h-2 w-2 rounded-full bg-accent-500" aria-hidden="true" /> Selesai
              </span>
            </div>
          </div>
          <div className="mt-4 h-56">
            {orderSeries.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-ink-400">Belum ada data pesanan.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={orderSeries} margin={{ top: 5, right: 5, left: -24, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eef2f8" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ borderRadius: 12, borderColor: '#e2e8f0', fontSize: 12 }} />
                  <Bar dataKey="orders" fill="#2f86f6" radius={[4, 4, 0, 0]} name="Masuk" />
                  <Bar dataKey="completed" fill="#12a8a7" radius={[4, 4, 0, 0]} name="Selesai" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        <div className="space-y-5">
          <Card className="p-5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-ink-400">Kinerja</p>
              <Badge tone={data.orders.summary.completionRate >= 80 ? 'green' : 'amber'}>
                {data.orders.summary.completionRate}% selesai
              </Badge>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-4">
              <div>
                <p className="text-2xl font-extrabold text-ink-950">{data.orders.summary.activeOrders}</p>
                <p className="text-xs text-ink-400">Pesanan aktif</p>
              </div>
              <div>
                <p className="text-2xl font-extrabold text-ink-950">{data.operations.summary.averageCompletionHours}j</p>
                <p className="text-xs text-ink-400">Rata-rata selesai</p>
              </div>
            </div>
            <div className="mt-4 space-y-2 border-t border-ink-100 pt-4 text-sm">
              <div className="flex justify-between">
                <span className="text-ink-500">Reservasi menunggu</span>
                <span className="font-bold text-ink-900">{data.operations.summary.pendingReservations}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-500">Pembayaran menunggu</span>
                <span className="font-bold text-ink-900">{data.pendingPayments.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-500">Tugas antar belum ditugaskan</span>
                <span className="font-bold text-ink-900">{data.operations.summary.unassignedDeliveryTasks}</span>
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="text-sm font-extrabold text-ink-950">Layanan populer</h2>
            <p className="mt-1 text-xs text-ink-500">Berdasarkan nilai pesanan pada periode ini.</p>
            <div className="mt-3 space-y-3">
              {data.popularServices.length === 0 ? (
                <p className="text-sm text-ink-400">Belum ada data layanan.</p>
              ) : (
                data.popularServices.slice(0, 5).map((service, index) => (
                  <div key={service.serviceId} className="flex items-center gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-xs font-bold text-brand-700">
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-ink-900">{service.name}</p>
                      <p className="text-[11px] text-ink-400">
                        {service.orderCount} pesanan · {service.quantity} {service.pricingUnit}
                      </p>
                    </div>
                    <span className="text-xs font-bold text-ink-800">{formatCurrency(service.value)}</span>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 xl:items-start xl:grid-cols-[1.35fr_0.65fr]">
        <Card className="p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-extrabold text-ink-950">Pesanan terbaru</h2>
              <p className="mt-1 text-xs text-ink-500">Delapan pesanan terakhir di sistem.</p>
            </div>
            <Link
              to={isAdmin ? '/admin/pesanan' : '/owner/laporan'}
              className="inline-flex items-center gap-1 text-xs font-bold text-brand-700 hover:text-brand-900"
            >
              Lihat semua <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>
          <div className="mt-4">
            {data.recentOrders.length === 0 ? (
              <EmptyState title="Belum ada pesanan" />
            ) : (
              <>
              <ul className="divide-y divide-ink-50 md:hidden">
                {data.recentOrders.slice(0, 6).map((order) => {
                  const body = (
                    <div className="flex items-center justify-between gap-3 px-1 py-3">
                      <div className="min-w-0">
                        <p className="whitespace-nowrap text-sm font-bold text-ink-900">{order.orderCode}</p>
                        <p className="mt-0.5 truncate text-xs text-ink-500">{order.customer?.name ?? '-'}</p>
                        <p className="mt-0.5 text-[11px] text-ink-400">
                          {formatDateTime(order.createdAt)} · {formatCurrency(order.totalAmount)}
                        </p>
                      </div>
                      <StatusBadge
                        status={order.orderStatus}
                        label={orderStatusLabel[order.orderStatus] ?? order.orderStatus}
                      />
                    </div>
                  );
                  return (
                    <li key={order.id}>
                      {isAdmin ? (
                        <Link to={`/admin/pesanan/${order.id}`} className="block rounded-xl transition hover:bg-sand-50">
                          {body}
                        </Link>
                      ) : (
                        body
                      )}
                    </li>
                  );
                })}
              </ul>
              <div className="hidden md:block">
              <DataTable>
                <thead>
                  <tr>
                    <Th>Kode</Th>
                    <Th>Pelanggan</Th>
                    <Th>Status</Th>
                    <Th className="text-right">Total</Th>
                    <Th>Dibuat</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-50">
                  {data.recentOrders.map((order) => (
                    <tr key={order.id}>
                      <Td>
                        {isAdmin ? (
                          <Link
                            to={`/admin/pesanan/${order.id}`}
                            className="whitespace-nowrap font-bold text-brand-700 hover:text-brand-900"
                          >
                            {order.orderCode}
                          </Link>
                        ) : (
                          <span className="font-bold text-ink-900">{order.orderCode}</span>
                        )}
                      </Td>
                      <Td>{order.customer?.name ?? '-'}</Td>
                      <Td>
                        <StatusBadge
                          status={order.orderStatus}
                          label={orderStatusLabel[order.orderStatus] ?? order.orderStatus}
                        />
                      </Td>
                      <Td className="text-right font-semibold">{formatCurrency(order.totalAmount)}</Td>
                      <Td className="text-xs text-ink-400">{formatDateTime(order.createdAt)}</Td>
                    </tr>
                  ))}
                </tbody>
              </DataTable>
              </div>
              </>
            )}
          </div>
        </Card>

        <Card className="p-5 sm:p-6">
          <h2 className="text-base font-extrabold text-ink-950">Kualitas layanan</h2>
          <div className="mt-4 flex items-center gap-4 rounded-2xl bg-sand-50 p-4">
            <div>
              <p className="text-3xl font-extrabold text-ink-950">{data.reviews.averageRating?.toFixed(1) ?? '—'}</p>
              <Stars value={Math.round(data.reviews.averageRating ?? 0)} size="sm" />
              <p className="mt-1 text-xs text-ink-400">{data.reviews.total} ulasan</p>
            </div>
            <div className="h-14 w-px bg-ink-200" />
            <p className="text-xs leading-relaxed text-ink-600">
              Ulasan hanya berasal dari pelanggan dengan pesanan selesai.
            </p>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
            <Link
              to={isAdmin ? '/admin/ulasan' : '/owner/laporan'}
              className="rounded-xl border border-ink-100 px-3 py-2.5 font-semibold text-ink-700 hover:border-brand-200 hover:text-brand-800"
            >
              Lihat ulasan
            </Link>
            <Link
              to={isAdmin ? '/admin/keluhan' : '/owner/laporan'}
              className="rounded-xl border border-ink-100 px-3 py-2.5 font-semibold text-ink-700 hover:border-brand-200 hover:text-brand-800"
            >
              Kelola keluhan
            </Link>
          </div>
        </Card>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 xl:items-start xl:grid-cols-2">
        <Card className="p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-extrabold text-ink-950">Reservasi menunggu</h2>
              <p className="mt-1 text-xs text-ink-500">Konfirmasi agar pesanan dapat dibuat.</p>
            </div>
            <Link to={isAdmin ? '/admin/reservasi' : '/owner/laporan'} className="text-xs font-bold text-brand-700">
              Kelola →
            </Link>
          </div>
          <div className="mt-4 space-y-2">
            {data.pendingReservations.length === 0 ? (
              <p className="text-sm text-ink-400">Tidak ada reservasi menunggu.</p>
            ) : (
              data.pendingReservations.map((reservation) => (
                <div
                  key={reservation.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-ink-100 px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-bold text-ink-900">{reservation.reservationCode}</p>
                    <p className="text-xs text-ink-400">
                      {reservation.customer?.name} · {formatDate(reservation.timeSlot.slotDate)}{' '}
                      {reservation.timeSlot.startTime}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge
                      status={reservation.status}
                      label={reservationStatusLabel[reservation.status] ?? reservation.status}
                    />
                    {isAdmin && (
                      <Button
                        size="sm"
                        variant="outline"
                        loading={confirming === reservation.id}
                        onClick={() => confirm(reservation.id)}
                      >
                        Konfirmasi
                      </Button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card className="p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-extrabold text-ink-950">Pembayaran menunggu</h2>
              <p className="mt-1 text-xs text-ink-500">Transfer bank yang perlu diverifikasi.</p>
            </div>
            {isAdmin && (
              <Link to="/admin/pembayaran" className="text-xs font-bold text-brand-700">
                Verifikasi →
              </Link>
            )}
          </div>
          <div className="mt-4 space-y-2">
            {data.pendingPayments.length === 0 ? (
              <p className="text-sm text-ink-400">Tidak ada pembayaran menunggu.</p>
            ) : (
              data.pendingPayments.map((payment) => (
                <div
                  key={payment.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-ink-100 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-ink-900">{formatCurrency(payment.amount)}</p>
                    <p className="truncate text-xs text-ink-400">
                      {payment.order?.customer?.name} · {payment.order?.orderCode}
                    </p>
                  </div>
                  <Badge tone="amber">Menunggu</Badge>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 xl:items-start xl:grid-cols-2">
        <Card className="p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-extrabold text-ink-950">Slot mendatang</h2>
              <p className="mt-1 text-xs text-ink-500">Kapasitas terpakai dari reservasi aktif.</p>
            </div>
            {isAdmin && (
              <Link to="/admin/slot" className="text-xs font-bold text-brand-700">
                Atur slot →
              </Link>
            )}
          </div>
          <div className="mt-4 space-y-3">
            {data.upcomingSlots.length === 0 ? (
              <p className="text-sm text-ink-400">Belum ada slot mendatang.</p>
            ) : (
              data.upcomingSlots.map((slot) => {
                const ratio = slot.capacity > 0 ? Math.min(100, Math.round((slot.reserved / slot.capacity) * 100)) : 0;
                return (
                  <div key={slot.id}>
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-ink-700">
                        {formatDate(slot.slotDate)} · {slot.startTime}–{slot.endTime}
                      </span>
                      <span className="text-ink-400">
                        {slot.reserved}/{slot.capacity}
                      </span>
                    </div>
                    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-ink-100">
                      <div
                        className={`h-full rounded-full ${ratio >= 90 ? 'bg-rose-400' : ratio >= 60 ? 'bg-amber-400' : 'bg-brand-500'}`}
                        style={{ width: `${ratio}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Card>

        <Card className="p-5 sm:p-6">
          <h2 className="text-base font-extrabold text-ink-950">Ringkasan pelanggan</h2>
          <div className="mt-4 grid grid-cols-3 gap-3 text-center">
            <div className="rounded-xl bg-sand-50 p-3">
              <p className="text-xl font-extrabold text-ink-950">{data.customers.summary.activeCustomers}</p>
              <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-400">Aktif</p>
            </div>
            <div className="rounded-xl bg-sand-50 p-3">
              <p className="text-xl font-extrabold text-ink-950">{data.customers.summary.newCustomers}</p>
              <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-400">Baru</p>
            </div>
            <div className="rounded-xl bg-sand-50 p-3">
              <p className="text-xl font-extrabold text-ink-950">{data.customers.summary.repeatCustomers}</p>
              <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-400">Repeat</p>
            </div>
          </div>
          <p className="mt-4 text-xs leading-relaxed text-ink-500">
            Rata-rata {data.customers.summary.averageOrdersPerCustomer} pesanan per pelanggan pada periode terpilih.
          </p>
          <div className="mt-4">
            <Link
              to={isAdmin ? '/admin/pelanggan' : '/owner/laporan'}
              className="inline-flex items-center gap-1 text-xs font-bold text-brand-700 hover:text-brand-900"
            >
              Lihat data pelanggan <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>
        </Card>
      </div>

      {!isAdmin && (
        <div className="mt-5 flex flex-wrap items-center gap-3 rounded-2xl border border-brand-100 bg-brand-50 px-5 py-4 text-sm text-brand-900">
          <Package className="h-4 w-4" aria-hidden="true" />
          Anda melihat ringkasan kepemilikan. Perubahan operasional dilakukan oleh administrator.
        </div>
      )}
    </div>
  );
}

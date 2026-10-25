import { Link } from 'react-router-dom';
import {
  ArrowRight,
  CalendarCheck,
  CalendarDays,
  CheckCircle2,
  Clock,
  MessageSquare,
  Package,
  Plus,
  ShoppingBag,
  Sparkles,
  Truck,
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
import { OrderProgress } from '../../components/common';
import { useApi } from '../../lib/useApi';
import { useAuth } from '../../lib/auth';
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  orderStatusLabel,
  paymentStatusLabel,
  reservationStatusLabel,
} from '../../lib/format';
import type { Order, Reservation } from '../../lib/types';

export function CustomerDashboardPage() {
  const { user } = useAuth();
  const orders = useApi<Order[]>('/orders/me');
  const reservations = useApi<Reservation[]>('/reservations/me');

  const loading = orders.loading || reservations.loading;
  const error = orders.error || reservations.error;

  if (loading) return <LoadingState label="Memuat dashboard Anda..." />;
  if (error) {
    return (
      <ErrorState
        message={error}
        onRetry={() => {
          orders.refetch();
          reservations.refetch();
        }}
      />
    );
  }

  const orderList = orders.data ?? [];
  const reservationList = reservations.data ?? [];
  const activeOrders = orderList.filter((order) => !['completed', 'cancelled'].includes(order.orderStatus));
  const completedOrders = orderList.filter((order) => order.orderStatus === 'completed');
  const totalPaid = orderList.reduce((sum, order) => sum + order.paidAmount, 0);
  const outstanding = orderList.reduce((sum, order) => sum + Math.max(0, order.remainingAmount), 0);
  const unpaidCount = orderList.filter((order) => order.remainingAmount > 0 && order.orderStatus !== 'cancelled').length;
  const activeReservations = reservationList.filter((reservation) => ['pending', 'confirmed'].includes(reservation.status));
  const upcoming = activeReservations
    .filter((reservation) => new Date(reservation.timeSlot.startsAt) > new Date())
    .sort((a, b) => new Date(a.timeSlot.startsAt).getTime() - new Date(b.timeSlot.startsAt).getTime())[0];
  const activeOrder = activeOrders[0];

  const today = new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date());

  return (
    <div>
      <PageHeader
        eyebrow={today}
        title={`Halo, ${user?.name.split(' ')[0] ?? 'Pelanggan'}`}
        description="Ringkasan cucian, jadwal berikutnya, dan tagihan Anda dalam satu tempat."
        actions={
          <Link to="/reservasi/baru">
            <Button icon={<Plus className="h-4 w-4" />}>Buat reservasi</Button>
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total dibayar"
          value={formatCurrency(totalPaid)}
          hint={
            unpaidCount > 0
              ? `${unpaidCount} tagihan belum lunas · ${formatCurrency(outstanding)}`
              : 'Tidak ada sisa tagihan'
          }
          icon={<Wallet className="h-5 w-5" />}
          tone="dark"
          to="/pembayaran"
        />
        <StatCard
          label="Pesanan berjalan"
          value={activeOrders.length}
          hint="Sedang diproses atau siap"
          icon={<Package className="h-5 w-5" />}
          to="/pesanan"
        />
        <StatCard
          label="Pesanan selesai"
          value={completedOrders.length}
          hint="Total pesanan yang telah selesai"
          icon={<CheckCircle2 className="h-5 w-5" />}
          tone="teal"
          to="/pesanan"
        />
        <StatCard
          label="Reservasi aktif"
          value={activeReservations.length}
          hint="Menunggu atau terkonfirmasi"
          icon={<CalendarDays className="h-5 w-5" />}
          tone="sand"
          to="/reservasi"
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-5 xl:items-start xl:grid-cols-[1.45fr_0.55fr]">
        <div className="space-y-5">
          <Card className="overflow-hidden">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-ink-100 px-5 py-4 sm:px-6">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-brand-600">Pesanan aktif</p>
                {activeOrder ? (
                  <p className="mt-1 text-lg font-extrabold tracking-tight text-ink-950">{activeOrder.orderCode}</p>
                ) : (
                  <p className="mt-1 text-lg font-extrabold tracking-tight text-ink-950">Tidak ada pesanan berjalan</p>
                )}
              </div>
              {activeOrder && (
                <StatusBadge
                  status={activeOrder.orderStatus}
                  label={orderStatusLabel[activeOrder.orderStatus] ?? activeOrder.orderStatus}
                />
              )}
            </div>

            {activeOrder ? (
              <div className="px-5 py-5 sm:px-6">
                <OrderProgress status={activeOrder.orderStatus} />

                <div className="mt-5 grid gap-3 rounded-2xl bg-sand-50 p-4 text-sm sm:grid-cols-4">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-400">Total tagihan</p>
                    <p className="mt-1 font-bold text-ink-900">{formatCurrency(activeOrder.totalAmount)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-400">Pembayaran</p>
                    <p className="mt-1 font-bold text-ink-900">
                      {paymentStatusLabel[activeOrder.paymentStatus] ?? activeOrder.paymentStatus}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-400">Layanan</p>
                    <p className="mt-1 font-bold text-ink-900">{activeOrder.items.length} item</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-400">Diperbarui</p>
                    <p className="mt-1 font-bold text-ink-900">{formatDateTime(activeOrder.updatedAt)}</p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Link to={`/pesanan/${activeOrder.id}`}>
                    <Button size="sm" icon={<ArrowRight className="h-4 w-4" />}>
                      Lihat detail & timeline
                    </Button>
                  </Link>
                  <Link to="/keluhan">
                    <Button size="sm" variant="outline" icon={<MessageSquare className="h-4 w-4" />}>
                      Ajukan keluhan
                    </Button>
                  </Link>
                </div>
              </div>
            ) : (
              <div className="p-5 sm:p-6">
                <EmptyState
                  title="Belum ada pesanan berjalan"
                  description="Buat reservasi untuk memulai. Setelah dikonfirmasi dan cucian diterima, pesanan akan tampil di sini."
                  icon={<ShoppingBag className="h-6 w-6" />}
                  action={
                    <Link to="/reservasi/baru">
                      <Button size="sm">Buat reservasi pertama</Button>
                    </Link>
                  }
                />
              </div>
            )}
          </Card>

          <Card className="p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-ink-400">Pesanan terbaru</p>
                <p className="mt-1 text-lg font-extrabold tracking-tight text-ink-950">Riwayat singkat</p>
              </div>
              <Link to="/pesanan" className="text-sm font-bold text-brand-700 hover:text-brand-900">
                Semua pesanan →
              </Link>
            </div>
            {orderList.length === 0 ? (
              <div className="mt-4">
                <EmptyState title="Belum ada pesanan" description="Pesanan akan muncul setelah reservasi diproses admin." />
              </div>
            ) : (
              <div className="mt-3 divide-y divide-ink-100">
                {orderList.slice(0, 5).map((order) => (
                  <Link
                    key={order.id}
                    to={`/pesanan/${order.id}`}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl px-2 py-3.5 transition hover:bg-sand-50"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-ink-900">{order.orderCode}</p>
                      <p className="mt-0.5 text-xs text-ink-400">
                        {formatDateTime(order.createdAt)} · {order.items.length} layanan
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold text-ink-900">{formatCurrency(order.totalAmount)}</span>
                      <StatusBadge
                        status={order.orderStatus}
                        label={orderStatusLabel[order.orderStatus] ?? order.orderStatus}
                      />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-5">
          <Card className="overflow-hidden">
            <div className="relative bg-gradient-to-br from-brand-600 to-accent-600 px-5 py-4 text-white">
              <div className="pointer-events-none absolute -right-6 -top-8 h-24 w-24 rounded-full bg-white/10 blur-2xl" />
              <p className="relative text-[10px] font-bold uppercase tracking-[0.16em] text-white/70">Reservasi berikutnya</p>
              {upcoming ? (
                <p className="relative mt-1 text-lg font-extrabold">{formatDate(upcoming.timeSlot.slotDate)}</p>
              ) : (
                <p className="relative mt-1 text-lg font-extrabold">Belum dijadwalkan</p>
              )}
            </div>
            <div className="p-5">
              {upcoming ? (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="brand">{reservationStatusLabel[upcoming.status] ?? upcoming.status}</Badge>
                    <Badge tone={upcoming.pickupType === 'pickup' ? 'blue' : 'slate'}>
                      {upcoming.pickupType === 'pickup' ? 'Pickup' : 'Drop-off'}
                    </Badge>
                  </div>
                  <div className="mt-4 flex items-center gap-2 text-sm font-bold text-ink-900">
                    <Clock className="h-4 w-4 text-brand-600" aria-hidden="true" />
                    {upcoming.timeSlot.startTime}–{upcoming.timeSlot.endTime} WIB
                  </div>
                  <p className="mt-2 text-xs text-ink-400">{upcoming.reservationCode}</p>
                  <Link to="/reservasi" className="mt-4 inline-block">
                    <Button size="sm" variant="outline">
                      Kelola reservasi
                    </Button>
                  </Link>
                </>
              ) : (
                <>
                  <p className="text-sm leading-relaxed text-ink-500">
                    Belum ada reservasi mendatang. Pilih slot agar cucian Anda terjadwal.
                  </p>
                  <Link to="/reservasi/baru" className="mt-4 inline-block">
                    <Button size="sm" variant="outline">
                      Pilih jadwal
                    </Button>
                  </Link>
                </>
              )}
            </div>
          </Card>

          <Card className="p-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-ink-400">Akses cepat</p>
            <div className="mt-3 grid gap-2">
              {[
                { to: '/reservasi/baru', label: 'Buat reservasi baru', icon: CalendarCheck },
                { to: '/pembayaran', label: 'Riwayat pembayaran', icon: Wallet },
                { to: '/voucher', label: 'Voucher tersedia', icon: Sparkles },
                { to: '/profil', label: 'Atur alamat pickup', icon: Truck },
              ].map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className="flex items-center gap-3 rounded-xl border border-ink-100 px-3.5 py-3 text-sm font-semibold text-ink-700 transition hover:border-brand-200 hover:bg-brand-50/40"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                    <item.icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  {item.label}
                  <ArrowRight className="ml-auto h-4 w-4 text-ink-300" aria-hidden="true" />
                </Link>
              ))}
            </div>
          </Card>

          <Card className="relative overflow-hidden bg-brand-950 p-5 text-white">
            <div className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-brand-500/20 blur-2xl" />
            <p className="relative text-base font-extrabold">Butuh bantuan?</p>
            <p className="relative mt-1.5 text-sm leading-relaxed text-brand-100/70">
              Sampaikan kendala pesanan melalui menu keluhan. Tim akan menindaklanjuti dan mencatat penyelesaiannya.
            </p>
            <Link to="/keluhan" className="relative mt-4 inline-block">
              <Button size="sm" variant="light">
                Buka keluhan
              </Button>
            </Link>
          </Card>
        </div>
      </div>
    </div>
  );
}

import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  ClipboardList,
  Droplets,
  PackageCheck,
  RefreshCw,
  Search,
  Timer,
} from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  LoadingState,
  PageHeader,
  StatCard,
  StatusBadge,
} from '../../components/ui';
import { useApi } from '../../lib/useApi';
import { useAuth } from '../../lib/auth';
import { formatCurrency, formatDateTime, orderStatusLabel, paymentStatusLabel } from '../../lib/format';
import type { Order } from '../../lib/types';

const productionFlow = [
  { key: 'received', label: 'Diterima', color: 'bg-sky-400' },
  { key: 'washing', label: 'Dicuci', color: 'bg-brand-500' },
  { key: 'drying', label: 'Dikeringkan', color: 'bg-indigo-400' },
  { key: 'ironing', label: 'Disetrika', color: 'bg-violet-400' },
  { key: 'packaging', label: 'Dikemas', color: 'bg-cyan-400' },
  { key: 'ready', label: 'Siap', color: 'bg-accent-500' },
];

export function StaffDashboardPage() {
  const { user } = useAuth();
  const orders = useApi<Order[]>('/staff/orders');
  const [query, setQuery] = useState('');

  const rows = useMemo(() => orders.data ?? [], [orders.data]);
  const active = rows.filter((order) => !['completed', 'cancelled'].includes(order.orderStatus));
  const completed = rows.filter((order) => order.orderStatus === 'completed');
  const ready = rows.filter((order) => order.orderStatus === 'ready');

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return active;
    return active.filter((order) =>
      `${order.orderCode} ${order.customer?.name ?? ''} ${order.items.map((item) => item.serviceName).join(' ')}`
        .toLowerCase()
        .includes(term),
    );
  }, [active, query]);

  const stageCounts = productionFlow.map((stage) => ({
    ...stage,
    count: active.filter((order) => order.orderStatus === stage.key).length,
  }));
  const maxStage = Math.max(1, ...stageCounts.map((stage) => stage.count));

  if (orders.loading) return <LoadingState label="Memuat tugas produksi..." />;
  if (orders.error) return <ErrorState message={orders.error} onRetry={orders.refetch} />;

  return (
    <div>
      <PageHeader
        eyebrow="Ruang kerja produksi"
        title={`Halo, ${user?.name.split(' ')[0] ?? 'Staff'}`}
        description="Daftar pesanan yang ditugaskan kepada Anda. Buka detail untuk memperbarui tahap produksi."
        actions={
          <Button variant="outline" onClick={orders.refetch} icon={<RefreshCw className="h-4 w-4" />}>
            Muat ulang
          </Button>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Pesanan aktif"
          value={active.length}
          hint="Sedang dikerjakan"
          icon={<ClipboardList className="h-5 w-5" />}
        />
        <StatCard
          label="Siap diambil / antar"
          value={ready.length}
          hint="Menunggu serah terima"
          tone="teal"
          icon={<PackageCheck className="h-5 w-5" />}
        />
        <StatCard
          label="Selesai"
          value={completed.length}
          hint="Riwayat penugasan Anda"
          tone="sand"
          icon={<Timer className="h-5 w-5" />}
        />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:items-start xl:grid-cols-[1.55fr_0.75fr]">
        <Card className="overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-ink-100 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-extrabold text-ink-950">Antrean produksi</h2>
              <p className="mt-0.5 text-xs text-ink-500">{filtered.length} pesanan ditampilkan</p>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
              <Input
                className="pl-9"
                placeholder="Cari kode atau pelanggan..."
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                aria-label="Cari pesanan produksi"
              />
            </div>
          </div>

          {rows.length === 0 ? (
            <div className="p-5">
              <EmptyState
                title="Belum ada pesanan ditugaskan"
                description="Administrator akan menugaskan pesanan ke Anda. Muat ulang halaman untuk memeriksa pembaruan."
                icon={<ClipboardList className="h-6 w-6" />}
              />
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-5">
              <EmptyState title="Pesanan tidak ditemukan" description="Coba kata kunci lain atau kosongkan pencarian." />
            </div>
          ) : (
            <ul className="divide-y divide-ink-50">
              {filtered.map((order) => (
                <li key={order.id} className="relative px-4 py-4 transition hover:bg-sand-50/60 sm:px-5">
                  <span
                    className={`absolute inset-y-4 left-0 w-1 rounded-r-full ${
                      productionFlow.find((stage) => stage.key === order.orderStatus)?.color ?? 'bg-ink-300'
                    }`}
                    aria-hidden="true"
                  />
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-bold text-brand-700">{order.orderCode}</span>
                        <StatusBadge
                          status={order.orderStatus}
                          label={orderStatusLabel[order.orderStatus] ?? order.orderStatus}
                        />
                        <Badge
                          tone={
                            order.paymentStatus === 'paid'
                              ? 'green'
                              : order.paymentStatus === 'refunded'
                                ? 'red'
                                : 'amber'
                          }
                        >
                          {paymentStatusLabel[order.paymentStatus] ?? order.paymentStatus}
                        </Badge>
                      </div>
                      <p className="mt-1.5 text-sm font-bold text-ink-900">{order.customer?.name ?? 'Pelanggan'}</p>
                      <p className="mt-0.5 line-clamp-1 text-xs text-ink-500">
                        {order.items.map((item) => `${item.serviceName} × ${item.quantity} ${item.unit}`).join(', ') ||
                          'Belum ada item'}
                      </p>
                      <p className="mt-1 text-[11px] text-ink-400">
                        Diterima: {order.receivedAt ? formatDateTime(order.receivedAt) : 'Belum ditimbang'} ·{' '}
                        {formatCurrency(order.totalAmount)}
                      </p>
                    </div>
                    <Link to={`/staff/pesanan/${order.id}`} className="shrink-0">
                      <Button size="sm" variant="soft" icon={<ArrowRight className="h-3.5 w-3.5" />}>
                        Kelola
                      </Button>
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="space-y-5">
          <Card className="p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-extrabold text-ink-950">Beban per tahap</h2>
              <Droplets className="h-4 w-4 text-brand-500" aria-hidden="true" />
            </div>
            <div className="mt-4 space-y-3">
              {stageCounts.map((stage) => (
                <div key={stage.key}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-ink-700">{stage.label}</span>
                    <span className="text-ink-400">{stage.count}</span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-ink-100">
                    <div
                      className={`h-full rounded-full ${stage.color}`}
                      style={{ width: `${Math.round((stage.count / maxStage) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-4 border-t border-ink-100 pt-3 text-[11px] leading-relaxed text-ink-400">
              Perubahan status mengikuti alur produksi yang divalidasi server.
            </p>
          </Card>

          <Card className="p-5">
            <h2 className="text-sm font-extrabold text-ink-950">Selesai terbaru</h2>
            {completed.length === 0 ? (
              <p className="mt-3 text-sm text-ink-400">Belum ada pesanan selesai.</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {completed.slice(0, 4).map((order) => (
                  <li key={order.id}>
                    <Link
                      to={`/staff/pesanan/${order.id}`}
                      className="flex items-center justify-between gap-2 rounded-xl border border-ink-100 px-3 py-2.5 transition hover:border-brand-200 hover:bg-brand-50/40"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-mono text-[11px] font-bold text-ink-800">{order.orderCode}</p>
                        <p className="truncate text-xs text-ink-500">{order.customer?.name ?? 'Pelanggan'}</p>
                      </div>
                      <span className="shrink-0 text-[11px] text-ink-400">
                        {order.completedAt ? formatDateTime(order.completedAt) : 'Selesai'}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="rounded-2xl border-brand-100 bg-brand-50 p-5">
            <p className="text-sm font-bold text-brand-900">Alur produksi</p>
            <ol className="mt-2 space-y-1 text-xs text-brand-800/80">
              {productionFlow.map((stage, index) => (
                <li key={stage.key} className="flex items-center gap-2">
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white text-[9px] font-bold text-brand-700">
                    {index + 1}
                  </span>
                  {stage.label}
                </li>
              ))}
            </ol>
          </Card>
        </div>
      </div>
    </div>
  );
}

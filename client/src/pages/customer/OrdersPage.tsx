import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Package, Plus, ReceiptText } from 'lucide-react';
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  StatusBadge,
  Tabs,
} from '../../components/ui';
import { useApi } from '../../lib/useApi';
import { formatCurrency, formatDateTime, orderStatusLabel, paymentStatusLabel } from '../../lib/format';
import type { Order } from '../../lib/types';

const tabs = [
  { value: 'all', label: 'Semua' },
  { value: 'active', label: 'Berjalan' },
  { value: 'completed', label: 'Selesai' },
  { value: 'cancelled', label: 'Dibatalkan' },
] as const;

type Tab = (typeof tabs)[number]['value'];

export function OrdersPage() {
  const orders = useApi<Order[]>('/orders/me');
  const [tab, setTab] = useState<Tab>('all');

  const rows = (orders.data ?? []).filter((order) => {
    if (tab === 'active') return !['completed', 'cancelled'].includes(order.orderStatus);
    if (tab === 'completed') return order.orderStatus === 'completed';
    if (tab === 'cancelled') return order.orderStatus === 'cancelled';
    return true;
  });

  return (
    <div>
      <PageHeader
        eyebrow="Pesanan"
        title="Pesanan saya"
        description="Lihat rincian, status pembayaran, dan timeline pengerjaan setiap pesanan."
        actions={
          <Link to="/reservasi/baru">
            <Button variant="outline" icon={<Plus className="h-4 w-4" />}>Reservasi baru</Button>
          </Link>
        }
      />

      <Tabs value={tab} onChange={setTab} tabs={tabs.map((item) => ({ ...item }))} />

      <div className="mt-5">
        {orders.loading ? (
          <LoadingState label="Memuat pesanan..." />
        ) : orders.error ? (
          <ErrorState message={orders.error} onRetry={orders.refetch} />
        ) : rows.length === 0 ? (
          <EmptyState
            title="Belum ada pesanan"
            description="Pesanan muncul setelah reservasi dikonfirmasi dan cucian diterima."
            icon={<Package className="h-6 w-6" />}
            action={<Link to="/reservasi/baru"><Button size="sm">Buat reservasi</Button></Link>}
          />
        ) : (
          <div className="space-y-3">
            {rows.map((order) => (
              <Card key={order.id} className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                      <Package className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-ink-950">{order.orderCode}</p>
                      <p className="mt-0.5 text-xs text-ink-400">{formatDateTime(order.createdAt)}</p>
                      <p className="mt-1 text-xs text-ink-500">
                        {order.items.map((item) => `${item.serviceName} × ${item.quantity} ${item.unit}`).join(' · ') || 'Belum ada rincian'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-extrabold text-ink-950">{formatCurrency(order.totalAmount)}</p>
                    <p className="mt-0.5 text-xs text-ink-400">{paymentStatusLabel[order.paymentStatus] ?? order.paymentStatus}</p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-ink-100 pt-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={order.orderStatus} label={orderStatusLabel[order.orderStatus] ?? order.orderStatus} />
                    {order.reservation?.pickupType === 'pickup' && <span className="rounded-full bg-sky-50 px-2.5 py-1 text-[11px] font-bold text-sky-700">Pickup</span>}
                    {order.remainingAmount > 0 && order.paymentStatus !== 'refunded' && (
                      <span className="text-xs text-ink-500">Sisa tagihan {formatCurrency(order.remainingAmount)}</span>
                    )}
                  </div>
                  <Link to={`/pesanan/${order.id}`}>
                    <Button size="sm" variant="outline" icon={<ArrowRight className="h-4 w-4" />}>Detail</Button>
                  </Link>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <div className="mt-6 flex items-center gap-2 text-xs text-ink-400">
        <ReceiptText className="h-4 w-4" /> Total tagihan final ditetapkan setelah penimbangan dan penerapan voucher.
      </div>
    </div>
  );
}

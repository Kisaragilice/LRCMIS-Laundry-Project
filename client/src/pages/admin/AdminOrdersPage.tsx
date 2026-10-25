import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Package, Search } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  LoadingState,
  PageHeader,
  Pagination,
  Select,
  StatusBadge,
} from '../../components/ui';
import { DataTable, Td, Th } from '../../components/common';
import { usePagedApi } from '../../lib/useApi';
import { formatCurrency, formatDateTime, orderStatusLabel, paymentStatusLabel } from '../../lib/format';
import type { Order } from '../../lib/types';

export function AdminOrdersPage() {
  const [page, setPage] = useState(1);
  const [orderStatus, setOrderStatus] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  const query = new URLSearchParams({ page: String(page), limit: '10' });
  if (orderStatus) query.set('orderStatus', orderStatus);
  if (paymentStatus) query.set('paymentStatus', paymentStatus);
  if (from) query.set('from', from);
  if (to) query.set('to', to);
  if (search) query.set('search', search);

  const orders = usePagedApi<Order>(`/admin/orders?${query.toString()}`, [page, orderStatus, paymentStatus, from, to, search]);

  return (
    <div>
      <PageHeader
        eyebrow="Operasional"
        title="Pesanan"
        description="Pantau seluruh pesanan, timbang cucian, ubah status, dan kelola pembayaran."
      />

      <Card className="mb-5 p-4">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            setPage(1);
            setSearch(searchInput.trim());
          }}
          className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1fr_170px_170px_150px_150px_auto]"
        >
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
            <Input className="pl-10" placeholder="Cari kode / pelanggan..." aria-label="Cari pesanan" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} />
          </div>
          <Select aria-label="Filter status pesanan" value={orderStatus} onChange={(event) => { setOrderStatus(event.target.value); setPage(1); }}>
            <option value="">Semua status</option>
            {Object.entries(orderStatusLabel).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </Select>
          <Select aria-label="Filter status pembayaran" value={paymentStatus} onChange={(event) => { setPaymentStatus(event.target.value); setPage(1); }}>
            <option value="">Semua pembayaran</option>
            {Object.entries(paymentStatusLabel).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </Select>
          <Input type="date" value={from} onChange={(event) => { setFrom(event.target.value); setPage(1); }} aria-label="Dari tanggal" />
          <Input type="date" value={to} onChange={(event) => { setTo(event.target.value); setPage(1); }} aria-label="Sampai tanggal" />
          <Button type="submit">Terapkan</Button>
        </form>
      </Card>

      {orders.loading ? (
        <LoadingState label="Memuat pesanan..." />
      ) : orders.error ? (
        <ErrorState message={orders.error} onRetry={orders.refetch} />
      ) : orders.rows.length === 0 ? (
        <EmptyState title="Tidak ada pesanan" description="Coba ubah filter atau buat pesanan dari reservasi terkonfirmasi." icon={<Package className="h-6 w-6" />} />
      ) : (
        <>
          <div className="space-y-3 md:hidden">
            {orders.rows.map((order) => (
              <Card key={order.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="whitespace-nowrap font-bold text-ink-900">{order.orderCode}</p>
                    <p className="mt-0.5 text-[11px] text-ink-400">
                      {order.items.length} layanan · {order.actualWeight ? `${order.actualWeight} kg` : 'belum ditimbang'}
                    </p>
                  </div>
                  <StatusBadge
                    status={order.orderStatus}
                    label={orderStatusLabel[order.orderStatus] ?? order.orderStatus}
                  />
                </div>
                <div className="mt-3 flex items-center justify-between gap-3 border-t border-ink-50 pt-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink-800">{order.customer?.name ?? '-'}</p>
                    <p className="truncate text-[11px] text-ink-400">{order.customer?.phone ?? order.customer?.email}</p>
                  </div>
                  <Badge
                    tone={
                      order.paymentStatus === 'paid'
                        ? 'green'
                        : order.paymentStatus === 'partial'
                          ? 'amber'
                          : order.paymentStatus === 'refunded'
                            ? 'red'
                            : 'slate'
                    }
                  >
                    {paymentStatusLabel[order.paymentStatus] ?? order.paymentStatus}
                  </Badge>
                </div>
                <div className="mt-3 flex items-end justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-ink-900">{formatCurrency(order.totalAmount)}</p>
                    <p className="text-[11px] text-ink-400">
                      {order.paymentStatus === 'paid'
                        ? 'Lunas'
                        : order.totalAmount === 0
                          ? 'Belum ditagihkan'
                          : `Sisa ${formatCurrency(order.remainingAmount)}`}
                    </p>
                    <p className="mt-1 text-[11px] text-ink-400">{formatDateTime(order.createdAt)}</p>
                  </div>
                  <Link to={`/admin/pesanan/${order.id}`}>
                    <Button size="sm" variant="outline" icon={<ArrowRight className="h-3.5 w-3.5" />}>
                      Kelola
                    </Button>
                  </Link>
                </div>
              </Card>
            ))}
          </div>

          <div className="hidden md:block">
            <DataTable>
              <thead>
                <tr>
                  <Th>Pesanan</Th>
                  <Th>Pelanggan</Th>
                  <Th>Status</Th>
                  <Th>Pembayaran</Th>
                  <Th>Tagihan</Th>
                  <Th>Dibuat</Th>
                  <Th />
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-50">
                {orders.rows.map((order) => (
                  <tr key={order.id} className="hover:bg-sand-50/50">
                    <Td>
                      <p className="whitespace-nowrap font-bold text-ink-900">{order.orderCode}</p>
                      <p className="mt-0.5 text-[11px] text-ink-400">
                        {order.items.length} layanan · {order.actualWeight ? `${order.actualWeight} kg` : 'belum ditimbang'}
                      </p>
                    </Td>
                    <Td>
                      <p className="font-semibold text-ink-800">{order.customer?.name ?? '-'}</p>
                      <p className="text-[11px] text-ink-400">{order.customer?.phone ?? order.customer?.email}</p>
                    </Td>
                    <Td>
                      <StatusBadge
                        status={order.orderStatus}
                        label={orderStatusLabel[order.orderStatus] ?? order.orderStatus}
                      />
                    </Td>
                    <Td>
                      <Badge
                        tone={
                          order.paymentStatus === 'paid'
                            ? 'green'
                            : order.paymentStatus === 'partial'
                              ? 'amber'
                              : order.paymentStatus === 'refunded'
                                ? 'red'
                                : 'slate'
                        }
                      >
                        {paymentStatusLabel[order.paymentStatus] ?? order.paymentStatus}
                      </Badge>
                    </Td>
                    <Td>
                      <p className="font-semibold text-ink-900">{formatCurrency(order.totalAmount)}</p>
                      {order.remainingAmount > 0 && (
                        <p className="text-[11px] text-ink-400">Sisa {formatCurrency(order.remainingAmount)}</p>
                      )}
                    </Td>
                    <Td className="text-xs text-ink-400">{formatDateTime(order.createdAt)}</Td>
                    <Td>
                      <Link to={`/admin/pesanan/${order.id}`}>
                        <Button size="sm" variant="outline" icon={<ArrowRight className="h-3.5 w-3.5" />}>
                          Kelola
                        </Button>
                      </Link>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          </div>
          <div className="mt-4">
            <Pagination page={page} totalPages={orders.meta?.totalPages ?? 1} total={orders.meta?.total} onChange={setPage} />
          </div>
        </>
      )}
    </div>
  );
}

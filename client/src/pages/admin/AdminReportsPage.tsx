import { useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { BarChart3, Download, RefreshCw } from 'lucide-react';
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  Field,
  Input,
  LoadingState,
  PageHeader,
  Select,
  StatCard,
} from '../../components/ui';
import { DataTable, Td, Th } from '../../components/common';
import { useApi } from '../../lib/useApi';
import { api } from '../../lib/api';
import { useToast } from '../../lib/toast';
import { formatCurrency, formatDate, formatNumber, monthStartIso, todayIso } from '../../lib/format';
import type { ReportRevenue } from '../../lib/types';

interface Period {
  from: string;
  to: string;
  groupBy?: string;
}

interface OrderReport {
  period: Period;
  summary: {
    totalOrders: number;
    completedOrders: number;
    cancelledOrders: number;
    activeOrders: number;
    totalOrderValue: number;
    completionRate: number;
  };
  byStatus: Array<{ status: string; count: number }>;
  byPaymentStatus: Array<{ status: string; count: number }>;
  series: Array<{ period: string; orders: number; completed: number; cancelled: number; value: number }>;
  empty: boolean;
}

interface ServiceReport {
  period: Period;
  data: Array<{ serviceId: string; name: string; pricingUnit: string; orderCount: number; quantity: number; value: number }>;
  empty: boolean;
}

interface CustomerReport {
  period: Period;
  summary: {
    activeCustomers: number;
    newCustomers: number;
    repeatCustomers: number;
    totalActiveCustomers: number;
    averageOrdersPerCustomer: number;
  };
  topCustomers: Array<{ id: string; name: string; email: string; orderCount: number; totalValue: number }>;
  empty: boolean;
}

interface OperationsReport {
  period: Period;
  summary: {
    averageCompletionHours: number;
    completedOrders: number;
    pendingReservations: number;
    unassignedDeliveryTasks: number;
  };
  activeByStatus: Array<{ status: string; count: number }>;
  deliveryTaskStats: Array<{ status: string; count: number }>;
  empty: boolean;
}

export function AdminReportsPage() {
  const { toast } = useToast();
  const [from, setFrom] = useState(monthStartIso());
  const [to, setTo] = useState(todayIso());
  const [groupBy, setGroupBy] = useState<'day' | 'month'>('day');
  const [exporting, setExporting] = useState<string | null>(null);

  const query = new URLSearchParams({ from, to, groupBy }).toString();
  const revenue = useApi<ReportRevenue>(`/admin/reports/revenue?${query}`, [from, to, groupBy]);
  const orders = useApi<OrderReport>(`/admin/reports/orders?${query}`, [from, to, groupBy]);
  const services = useApi<ServiceReport>(`/admin/reports/services?${query}`, [from, to, groupBy]);
  const customers = useApi<CustomerReport>(`/admin/reports/customers?${query}`, [from, to, groupBy]);
  const operations = useApi<OperationsReport>(`/admin/reports/operations?${query}`, [from, to, groupBy]);

  const refresh = () => {
    revenue.refetch();
    orders.refetch();
    services.refetch();
    customers.refetch();
    operations.refetch();
  };

  const exportCsv = async (type: 'revenue' | 'orders' | 'services' | 'customers') => {
    setExporting(type);
    try {
      await api.download(
        `/admin/reports/export?type=${type}&from=${from}&to=${to}`,
        `laporan-${type}-${from}-${to}.csv`,
      );
      toast('Laporan CSV diunduh');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Gagal mengunduh laporan', 'error');
    } finally {
      setExporting(null);
    }
  };

  const loading = revenue.loading || orders.loading || services.loading || customers.loading || operations.loading;
  const error = revenue.error || orders.error || services.error || customers.error || operations.error;
  const revenueData = revenue.data;
  const orderData = orders.data;
  const serviceData = services.data;
  const customerData = customers.data;
  const operationData = operations.data;
  const hasData = Boolean(revenueData || orderData || serviceData || customerData || operationData);

  return (
    <div>
      <PageHeader
        eyebrow="Analitik"
        title="Laporan bisnis"
        description="Analisis pendapatan, pesanan, layanan populer, pelanggan, dan operasional. Semua nominal dalam IDR."
        actions={
          <>
            <Button variant="outline" icon={<RefreshCw className="h-4 w-4" />} onClick={refresh}>Muat ulang</Button>
            <Button icon={<Download className="h-4 w-4" />} onClick={() => exportCsv('revenue')} loading={exporting === 'revenue'}>Ekspor CSV</Button>
          </>
        }
      />

      <Card className="mb-5 flex flex-wrap items-end gap-3 p-4">
        <Field label="Dari" className="w-full sm:w-44">
          <Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
        </Field>
        <Field label="Sampai" className="w-full sm:w-44">
          <Input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
        </Field>
        <Field label="Kelompok" className="w-full sm:w-40">
          <Select value={groupBy} onChange={(event) => setGroupBy(event.target.value as 'day' | 'month')}>
            <option value="day">Harian</option>
            <option value="month">Bulanan</option>
          </Select>
        </Field>
        <div className="ml-auto flex flex-wrap gap-2">
          {(['revenue', 'orders', 'services', 'customers'] as const).map((type) => (
            <Button key={type} size="sm" variant="outline" onClick={() => exportCsv(type)} loading={exporting === type}>
              CSV {type === 'revenue' ? 'pendapatan' : type === 'orders' ? 'pesanan' : type === 'services' ? 'layanan' : 'pelanggan'}
            </Button>
          ))}
        </div>
      </Card>

      {loading && !hasData ? (
        <LoadingState label="Menghitung laporan..." />
      ) : error ? (
        <ErrorState message={error} onRetry={refresh} />
      ) : !hasData ? (
        <EmptyState title="Laporan tidak tersedia" description="Pilih rentang tanggal lalu muat ulang." icon={<BarChart3 className="h-6 w-6" />} />
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Pendapatan bersih" value={formatCurrency(revenueData?.summary.netRevenue ?? 0)} hint={`${revenueData?.summary.paidTransactions ?? 0} transaksi lunas`} tone="brand" />
            <StatCard label="Refund" value={formatCurrency(revenueData?.summary.refunds ?? 0)} hint={`${revenueData?.summary.refundTransactions ?? 0} transaksi refund`} tone="rose" />
            <StatCard label="Total pesanan" value={formatNumber(orderData?.summary.totalOrders ?? 0)} hint={`${orderData?.summary.completedOrders ?? 0} selesai`} tone="blue" />
            <StatCard label="Rata-rata order" value={formatCurrency(revenueData?.summary.averageOrderValue ?? 0)} hint={`${orderData?.summary.completionRate ?? 0}% completion rate`} tone="sand" />
          </div>

          <Card className="p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-lg font-bold text-ink-950">Tren pendapatan</h2>
                <p className="text-sm text-ink-500">Pendapatan lunas dan refund per {groupBy === 'day' ? 'hari' : 'bulan'}.</p>
              </div>
              <p className="text-xs text-ink-400">{formatDate(`${from}T12:00:00+07:00`)} – {formatDate(`${to}T12:00:00+07:00`)}</p>
            </div>
            {(revenueData?.series ?? []).length === 0 ? (
              <p className="py-10 text-center text-sm text-ink-400">Belum ada transaksi pada periode ini.</p>
            ) : (
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={revenueData?.series ?? []} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e7e2d8" vertical={false} />
                    <XAxis dataKey="period" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(value: number) => `${Math.round(value / 1000)}k`} />
                    <Tooltip formatter={(value) => formatCurrency(Number(value))} contentStyle={{ borderRadius: 12, borderColor: '#e7e2d8', fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="revenue" name="Pendapatan" fill="#245c4f" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="refunds" name="Refund" fill="#f2b8b5" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>

          <div className="grid gap-6 xl:grid-cols-2">
            <Card className="p-5">
              <h2 className="mb-1 text-lg font-bold text-ink-950">Pesanan per status</h2>
              <p className="mb-4 text-sm text-ink-500">Distribusi seluruh pesanan pada periode.</p>
              <DataTable>
                <thead><tr><Th>Status</Th><Th className="text-right">Jumlah</Th></tr></thead>
                <tbody className="divide-y divide-ink-50">
                  {(orderData?.byStatus ?? []).filter((row) => row.count > 0).map((row) => (
                    <tr key={row.status}>
                      <Td className="capitalize">{row.status.replace('_', ' ')}</Td>
                      <Td className="text-right font-semibold">{row.count}</Td>
                    </tr>
                  ))}
                </tbody>
              </DataTable>
            </Card>

            <Card className="p-5">
              <h2 className="mb-1 text-lg font-bold text-ink-950">Layanan populer</h2>
              <p className="mb-4 text-sm text-ink-500">Berdasarkan nilai pesanan (10 teratas).</p>
              <DataTable>
                <thead><tr><Th>Layanan</Th><Th className="text-right">Qty</Th><Th className="text-right">Nilai</Th></tr></thead>
                <tbody className="divide-y divide-ink-50">
                  {(serviceData?.data ?? []).map((row) => (
                    <tr key={row.serviceId}>
                      <Td>
                        <p className="font-semibold text-ink-900">{row.name}</p>
                        <p className="text-[11px] text-ink-400">{row.orderCount} pesanan</p>
                      </Td>
                      <Td className="text-right">{formatNumber(row.quantity, 2)}</Td>
                      <Td className="text-right font-semibold">{formatCurrency(row.value)}</Td>
                    </tr>
                  ))}
                </tbody>
              </DataTable>
            </Card>

            <Card className="p-5">
              <h2 className="mb-1 text-lg font-bold text-ink-950">Pelanggan teratas</h2>
              <p className="mb-4 text-sm text-ink-500">Berdasarkan nilai transaksi pada periode.</p>
              <DataTable>
                <thead><tr><Th>Pelanggan</Th><Th className="text-right">Pesanan</Th><Th className="text-right">Nilai</Th></tr></thead>
                <tbody className="divide-y divide-ink-50">
                  {(customerData?.topCustomers ?? []).map((row) => (
                    <tr key={row.id}>
                      <Td>
                        <p className="font-semibold text-ink-900">{row.name}</p>
                        <p className="text-[11px] text-ink-400">{row.email}</p>
                      </Td>
                      <Td className="text-right">{row.orderCount}</Td>
                      <Td className="text-right font-semibold">{formatCurrency(row.totalValue)}</Td>
                    </tr>
                  ))}
                </tbody>
              </DataTable>
            </Card>

            <Card className="p-5">
              <h2 className="mb-1 text-lg font-bold text-ink-950">Ringkasan operasional</h2>
              <p className="mb-4 text-sm text-ink-500">Kinerja produksi dan pengantaran.</p>
              <div className="space-y-3">
                <div className="flex items-center justify-between rounded-xl bg-ink-50 px-4 py-3">
                  <span className="text-sm text-ink-600">Rata-rata penyelesaian</span>
                  <span className="font-bold text-ink-900">{operationData?.summary.averageCompletionHours ?? 0} jam</span>
                </div>
                <div className="flex items-center justify-between rounded-xl bg-ink-50 px-4 py-3">
                  <span className="text-sm text-ink-600">Pesanan selesai (periode)</span>
                  <span className="font-bold text-ink-900">{operationData?.summary.completedOrders ?? 0}</span>
                </div>
                <div className="flex items-center justify-between rounded-xl bg-ink-50 px-4 py-3">
                  <span className="text-sm text-ink-600">Reservasi menunggu konfirmasi</span>
                  <span className="font-bold text-ink-900">{operationData?.summary.pendingReservations ?? 0}</span>
                </div>
                <div className="flex items-center justify-between rounded-xl bg-ink-50 px-4 py-3">
                  <span className="text-sm text-ink-600">Tugas antar tanpa kurir</span>
                  <span className="font-bold text-ink-900">{operationData?.summary.unassignedDeliveryTasks ?? 0}</span>
                </div>
                <div className="rounded-xl border border-ink-100 px-4 py-3">
                  <p className="mb-2 text-xs font-bold uppercase tracking-wider text-ink-400">Status pengantaran</p>
                  <div className="flex flex-wrap gap-2">
                    {(operationData?.deliveryTaskStats ?? []).map((row) => (
                      <span key={row.status} className="rounded-lg bg-sand-100 px-2.5 py-1 text-xs font-semibold text-ink-700">
                        {row.status}: {row.count}
                      </span>
                    ))}
                    {(operationData?.deliveryTaskStats ?? []).length === 0 && <span className="text-sm text-ink-400">Belum ada tugas.</span>}
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

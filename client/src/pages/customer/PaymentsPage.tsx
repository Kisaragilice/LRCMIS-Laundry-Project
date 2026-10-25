import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Banknote, CreditCard, ReceiptText, Wallet } from 'lucide-react';
import { Badge, Card, EmptyState, ErrorState, LoadingState, PageHeader, StatCard, Tabs } from '../../components/ui';
import { useApi } from '../../lib/useApi';
import { formatCurrency, formatDateTime, methodLabel } from '../../lib/format';
import type { Payment } from '../../lib/types';

const tabs = [
  { value: 'all', label: 'Semua' },
  { value: 'paid', label: 'Lunas' },
  { value: 'pending', label: 'Menunggu' },
  { value: 'refunded', label: 'Refund' },
  { value: 'failed', label: 'Gagal' },
] as const;

type Tab = (typeof tabs)[number]['value'];

export function PaymentsPage() {
  const payments = useApi<Payment[]>('/payments/me?limit=100');
  const [tab, setTab] = useState<Tab>('all');

  const rows = (payments.data ?? []).filter((payment) => tab === 'all' || payment.status === tab);
  const paid = (payments.data ?? []).filter((payment) => payment.status === 'paid').reduce((sum, payment) => sum + payment.amount, 0);
  const pending = (payments.data ?? []).filter((payment) => payment.status === 'pending').reduce((sum, payment) => sum + payment.amount, 0);
  const refunded = (payments.data ?? []).filter((payment) => payment.status === 'refunded').reduce((sum, payment) => sum + payment.amount, 0);

  return (
    <div>
      <PageHeader
        eyebrow="Keuangan"
        title="Riwayat pembayaran"
        description="Seluruh transaksi pembayaran yang tercatat pada pesanan Anda."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Total lunas" value={formatCurrency(paid)} hint={`${(payments.data ?? []).filter((p) => p.status === 'paid').length} transaksi`} icon={<Wallet className="h-5 w-5" />} />
        <StatCard label="Menunggu verifikasi" value={formatCurrency(pending)} hint="Transfer bank yang belum diverifikasi" icon={<Banknote className="h-5 w-5" />} tone="sand" />
        <StatCard label="Refund" value={formatCurrency(refunded)} hint="Dicatat sebagai transaksi terpisah" icon={<ReceiptText className="h-5 w-5" />} tone="rose" />
      </div>

      <div className="mt-6"><Tabs value={tab} onChange={setTab} tabs={tabs.map((item) => ({ ...item }))} /></div>

      <div className="mt-5">
        {payments.loading ? (
          <LoadingState label="Memuat pembayaran..." />
        ) : payments.error ? (
          <ErrorState message={payments.error} onRetry={payments.refetch} />
        ) : rows.length === 0 ? (
          <EmptyState
            title="Belum ada pembayaran"
            description="Pembayaran akan muncul setelah admin mencatatnya pada pesanan."
            icon={<CreditCard className="h-6 w-6" />}
          />
        ) : (
          <div className="space-y-3">
            {rows.map((payment) => (
              <Card key={payment.id} className="flex flex-wrap items-center justify-between gap-4 p-5">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-ink-50 text-ink-600">
                    <CreditCard className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-ink-950">{formatCurrency(payment.amount)}</p>
                    <p className="mt-0.5 text-xs text-ink-400">
                      {methodLabel[payment.method] ?? payment.method} · {formatDateTime(payment.createdAt)}
                    </p>
                    {payment.order && (
                      <Link to={`/pesanan/${payment.order.id}`} className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:text-brand-900">
                        {payment.order.orderCode} <ArrowRight className="h-3 w-3" />
                      </Link>
                    )}
                    {payment.referenceCode && <p className="mt-1 text-xs text-ink-500">Ref: {payment.referenceCode}</p>}
                    {payment.verifiedBy && <p className="mt-0.5 text-xs text-ink-400">Diverifikasi oleh {payment.verifiedBy}</p>}
                    {payment.refundNote && <p className="mt-1 text-xs text-red-600">Refund: {payment.refundNote}</p>}
                  </div>
                </div>
                <div className="text-right">
                  <Badge tone={payment.status === 'paid' ? 'green' : payment.status === 'pending' ? 'amber' : payment.status === 'refunded' ? 'red' : 'slate'}>
                    {payment.status === 'paid' ? 'Lunas' : payment.status === 'pending' ? 'Menunggu verifikasi' : payment.status === 'refunded' ? 'Refund' : 'Gagal'}
                  </Badge>
                  {payment.paidAt && <p className="mt-1 text-[11px] text-ink-400">Dibayar {formatDateTime(payment.paidAt)}</p>}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

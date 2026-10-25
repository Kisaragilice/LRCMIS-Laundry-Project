import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, RefreshCw, Search, Undo2, X } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Field,
  Input,
  LoadingState,
  Modal,
  PageHeader,
  Pagination,
  Select,
  Textarea,
} from '../../components/ui';
import { DataTable, Td, Th } from '../../components/common';
import { usePagedApi } from '../../lib/useApi';
import { api, ApiError } from '../../lib/api';
import { useToast } from '../../lib/toast';
import { formatCurrency, formatDateTime, methodLabel } from '../../lib/format';
import type { Payment } from '../../lib/types';

type ActionKind = 'verify' | 'reject' | 'refund';

export function AdminPaymentsPage() {
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [method, setMethod] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  const query = new URLSearchParams({ page: String(page), limit: '10' });
  if (status) query.set('status', status);
  if (method) query.set('method', method);
  if (search) query.set('search', search);

  const payments = usePagedApi<Payment>(`/admin/payments?${query.toString()}`, [page, status, method, search]);
  const [action, setAction] = useState<{ kind: ActionKind; payment: Payment } | null>(null);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const open = (kind: ActionKind, payment: Payment) => {
    setAction({ kind, payment });
    setNotes('');
    setError(null);
  };

  const submit = async () => {
    if (!action) return;
    setBusy(true);
    setError(null);
    try {
      if (action.kind === 'verify') {
        await api.patch(`/admin/payments/${action.payment.id}/verify`, { notes: notes.trim() || undefined });
        toast('Pembayaran diverifikasi');
      } else if (action.kind === 'reject') {
        await api.patch(`/admin/payments/${action.payment.id}/reject`, { reason: notes.trim() });
        toast('Pembayaran ditolak');
      } else {
        await api.patch(`/admin/payments/${action.payment.id}/refund`, { reason: notes.trim() });
        toast('Refund dicatat');
      }
      setAction(null);
      payments.refetch();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Aksi gagal');
    } finally {
      setBusy(false);
    }
  };

  const title = action?.kind === 'verify' ? 'Verifikasi pembayaran' : action?.kind === 'reject' ? 'Tolak pembayaran' : 'Catat refund';

  const renderActions = (payment: Payment) => (
    <div className="flex flex-wrap gap-1.5">
      {payment.status === 'pending' && (
        <>
          <Button
            size="sm"
            variant="outline"
            onClick={() => open('verify', payment)}
            icon={<Check className="h-3.5 w-3.5" />}
          >
            Verifikasi
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-red-600"
            onClick={() => open('reject', payment)}
            icon={<X className="h-3.5 w-3.5" />}
          >
            Tolak
          </Button>
        </>
      )}
      {payment.status === 'paid' && (
        <Button size="sm" variant="ghost" onClick={() => open('refund', payment)} icon={<Undo2 className="h-3.5 w-3.5" />}>
          Refund
        </Button>
      )}
      {(payment.status === 'paid' || payment.status === 'refunded' || payment.status === 'failed') && (
        <Link to={`/admin/pesanan/${payment.orderId}`}>
          <Button size="sm" variant="ghost" icon={<RefreshCw className="h-3.5 w-3.5" />}>
            Pesanan
          </Button>
        </Link>
      )}
    </div>
  );

  return (
    <div>
      <PageHeader
        eyebrow="Keuangan"
        title="Pembayaran"
        description="Verifikasi transfer bank, catat refund, dan pantau transaksi tunai."
      />

      <Card className="mb-5 p-4">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            setPage(1);
            setSearch(searchInput.trim());
          }}
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_170px_170px_auto]"
        >
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
            <Input
              className="pl-10"
              placeholder="Cari referensi / kode pesanan / pelanggan..."
              aria-label="Cari pembayaran"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
            />
          </div>
          <Select aria-label="Filter status pembayaran" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}>
            <option value="">Semua status</option>
            <option value="pending">Menunggu</option>
            <option value="paid">Lunas</option>
            <option value="failed">Gagal</option>
            <option value="refunded">Refund</option>
          </Select>
          <Select aria-label="Filter metode pembayaran" value={method} onChange={(event) => { setMethod(event.target.value); setPage(1); }}>
            <option value="">Semua metode</option>
            <option value="cash">Tunai</option>
            <option value="bank_transfer">Transfer bank</option>
          </Select>
          <Button type="submit">Terapkan</Button>
        </form>
      </Card>

      {payments.loading ? (
        <LoadingState label="Memuat pembayaran..." />
      ) : payments.error ? (
        <ErrorState message={payments.error} onRetry={payments.refetch} />
      ) : payments.rows.length === 0 ? (
        <EmptyState title="Tidak ada pembayaran" description="Pembayaran dicatat dari halaman detail pesanan." />
      ) : (
        <>
          <div className="space-y-3 md:hidden">
            {payments.rows.map((payment) => (
              <Card key={payment.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="whitespace-nowrap font-bold text-ink-900">
                      {payment.order?.orderCode ?? 'Pesanan'}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-ink-500">{payment.order?.customer?.name ?? '-'}</p>
                  </div>
                  <Badge
                    tone={
                      payment.status === 'paid'
                        ? 'green'
                        : payment.status === 'pending'
                          ? 'amber'
                          : payment.status === 'refunded'
                            ? 'red'
                            : 'slate'
                    }
                  >
                    {payment.status === 'paid'
                      ? 'Lunas'
                      : payment.status === 'pending'
                        ? 'Menunggu'
                        : payment.status === 'refunded'
                          ? 'Refund'
                          : 'Gagal'}
                  </Badge>
                </div>
                <div className="mt-3 flex items-end justify-between gap-3 border-t border-ink-50 pt-3">
                  <div>
                    <p className="text-lg font-extrabold text-ink-950">{formatCurrency(payment.amount)}</p>
                    <p className="text-[11px] text-ink-400">{methodLabel[payment.method] ?? payment.method}</p>
                  </div>
                  <div className="text-right text-[11px] text-ink-400">
                    <p>{formatDateTime(payment.createdAt)}</p>
                    {payment.referenceCode && <p className="mt-0.5">Ref: {payment.referenceCode}</p>}
                  </div>
                </div>
                <div className="mt-3">{renderActions(payment)}</div>
              </Card>
            ))}
          </div>

          <div className="hidden md:block">
            <DataTable>
              <thead>
                <tr>
                  <Th>Transaksi</Th>
                  <Th>Pesanan</Th>
                  <Th>Metode</Th>
                  <Th>Jumlah</Th>
                  <Th>Status</Th>
                  <Th>Aksi</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-50">
                {payments.rows.map((payment) => (
                  <tr key={payment.id} className="hover:bg-sand-50/50">
                    <Td>
                      <p className="text-xs font-semibold text-ink-700">{formatDateTime(payment.createdAt)}</p>
                      {payment.referenceCode && <p className="text-[11px] text-ink-400">Ref: {payment.referenceCode}</p>}
                      {payment.verifiedBy && <p className="text-[11px] text-ink-400">oleh {payment.verifiedBy}</p>}
                    </Td>
                    <Td>
                      <Link
                        to={`/admin/pesanan/${payment.orderId}`}
                        className="whitespace-nowrap font-bold text-brand-700 hover:text-brand-900"
                      >
                        {payment.order?.orderCode ?? 'Lihat pesanan'}
                      </Link>
                      <p className="text-[11px] text-ink-400">{payment.order?.customer?.name}</p>
                    </Td>
                    <Td className="text-sm">{methodLabel[payment.method] ?? payment.method}</Td>
                    <Td className="font-semibold text-ink-900">{formatCurrency(payment.amount)}</Td>
                    <Td>
                      <Badge
                        tone={
                          payment.status === 'paid'
                            ? 'green'
                            : payment.status === 'pending'
                              ? 'amber'
                              : payment.status === 'refunded'
                                ? 'red'
                                : 'slate'
                        }
                      >
                        {payment.status === 'paid'
                          ? 'Lunas'
                          : payment.status === 'pending'
                            ? 'Menunggu'
                            : payment.status === 'refunded'
                              ? 'Refund'
                              : 'Gagal'}
                      </Badge>
                    </Td>
                    <Td>{renderActions(payment)}</Td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          </div>
          <div className="mt-4">
            <Pagination page={page} totalPages={payments.meta?.totalPages ?? 1} total={payments.meta?.total} onChange={setPage} />
          </div>
        </>
      )}

      <Modal open={Boolean(action)} onClose={() => setAction(null)} title={title} size="sm">
        {action && (
          <div className="space-y-4">
            {error && <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
            <div className="rounded-xl bg-ink-50 px-4 py-3 text-sm">
              <p className="font-bold text-ink-900">{formatCurrency(action.payment.amount)}</p>
              <p className="mt-0.5 text-xs text-ink-500">{action.payment.order?.orderCode} · {methodLabel[action.payment.method]}</p>
            </div>
            {action.kind !== 'verify' && (
              <Field label={action.kind === 'reject' ? 'Alasan penolakan' : 'Alasan refund'} htmlFor="actionNotes" required>
                <Textarea id="actionNotes" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Minimal 3 karakter" />
              </Field>
            )}
            {action.kind === 'verify' && (
              <Field label="Catatan verifikasi" htmlFor="actionNotes" hint="Opsional">
                <Textarea id="actionNotes" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Contoh: bukti transfer sesuai" />
              </Field>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setAction(null)}>Batal</Button>
              <Button
                variant={action.kind === 'reject' ? 'danger' : 'primary'}
                onClick={submit}
                loading={busy}
                disabled={action.kind !== 'verify' && notes.trim().length < 3}
              >
                {action.kind === 'verify' ? 'Verifikasi' : action.kind === 'reject' ? 'Tolak pembayaran' : 'Catat refund'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

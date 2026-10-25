import { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import {
  Button,
  Card,
  ErrorState,
  Field,
  Input,
  LoadingState,
  Modal,
  PageHeader,
} from '../../components/ui';
import { Note } from '../../components/common';
import { useApi } from '../../lib/useApi';
import { api, ApiError } from '../../lib/api';
import { useToast } from '../../lib/toast';

interface HistorySummary {
  reservations: number;
  orders: number;
  payments: number;
  deliveryTasks: number;
  reviews: number;
  complaints: number;
  notifications: number;
  chatConversations: number;
  auditLogs: number;
}

const summaryItems: Array<{ key: keyof HistorySummary; label: string }> = [
  { key: 'reservations', label: 'Reservasi' },
  { key: 'orders', label: 'Pesanan' },
  { key: 'payments', label: 'Pembayaran' },
  { key: 'deliveryTasks', label: 'Tugas antar' },
  { key: 'reviews', label: 'Ulasan' },
  { key: 'complaints', label: 'Keluhan' },
  { key: 'notifications', label: 'Notifikasi' },
  { key: 'chatConversations', label: 'Percakapan' },
  { key: 'auditLogs', label: 'Audit log' },
];

const preservedItems = [
  'Akun admin, owner, staff, kurir, dan pelanggan',
  'Alamat dan data profil pengguna',
  'Layanan dan harga',
  'Slot waktu',
  'Promosi',
  'Peran dan hak akses',
];

export function AdminHistoryResetPage() {
  const { toast } = useToast();
  const history = useApi<HistorySummary>('/admin/maintenance/history-summary');
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const summary = history.data;
  const total = summary ? summaryItems.reduce((sum, item) => sum + summary[item.key], 0) : 0;
  const confirmed = confirmation.trim() === 'HAPUS RIWAYAT';

  const reset = async () => {
    if (!confirmed || busy) return;
    setBusy(true);
    setError(null);
    try {
      await api.post('/admin/maintenance/reset-history', { confirmation: confirmation.trim() });
      setOpen(false);
      setConfirmation('');
      history.refetch();
      toast('Riwayat transaksi berhasil dibersihkan');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal membersihkan riwayat');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow="Pemeliharaan"
        title="Reset riwayat transaksi"
        description="Bersihkan seluruh riwayat operasional sehingga sistem kembali seperti belum memiliki pesanan, tanpa menghapus akun atau data master."
      />

      <div className="mb-5 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
        <div>
          <p className="font-bold">Tindakan permanen</p>
          <p className="mt-1 leading-relaxed">
            Riwayat yang dihapus tidak dapat dipulihkan dari aplikasi. Pastikan Anda sudah membuat cadangan database
            jika data lama masih mungkin diperlukan.
          </p>
        </div>
      </div>

      {history.loading ? (
        <LoadingState label="Menghitung riwayat..." />
      ) : history.error ? (
        <ErrorState message={history.error} onRetry={history.refetch} />
      ) : (
        <div className="space-y-5">
          <Card className="p-5 sm:p-6">
            <div className="flex items-center gap-2">
              <Database className="h-5 w-5 text-brand-700" aria-hidden="true" />
              <h2 className="text-base font-bold text-ink-950">Riwayat yang akan dihapus</h2>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {summaryItems.map((item) => (
                <div key={item.key} className="rounded-xl border border-ink-100 bg-sand-50/60 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-ink-400">{item.label}</p>
                  <p className="mt-1 text-xl font-extrabold text-ink-950">{summary?.[item.key] ?? 0}</p>
                </div>
              ))}
            </div>
            <p className="mt-4 text-sm text-ink-500">
              Total <span className="font-bold text-ink-900">{total}</span> catatan riwayat akan dibersihkan.
            </p>
          </Card>

          <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
            <Card className="p-5 sm:p-6">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-emerald-600" aria-hidden="true" />
                <h2 className="text-base font-bold text-ink-950">Data yang tetap dipertahankan</h2>
              </div>
              <ul className="mt-4 space-y-2.5 text-sm text-ink-600">
                {preservedItems.map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" aria-hidden="true" />
                    {item}
                  </li>
                ))}
              </ul>
              <div className="mt-4">
                <Note>Kredensial akun, termasuk administrator utama, tidak berubah setelah reset.</Note>
              </div>
            </Card>

            <Card className="border-red-100 p-5 sm:p-6">
              <div className="flex items-center gap-2">
                <Trash2 className="h-5 w-5 text-red-600" aria-hidden="true" />
                <h2 className="text-base font-bold text-ink-950">Bersihkan riwayat</h2>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-ink-500">
                Reservasi, pesanan, pembayaran, tugas, ulasan, keluhan, notifikasi, dan audit log akan dihapus.
              </p>
              <Button
                variant="danger"
                className="mt-5 w-full"
                icon={<Trash2 className="h-4 w-4" />}
                onClick={() => {
                  setError(null);
                  setConfirmation('');
                  setOpen(true);
                }}
                disabled={total === 0}
              >
                {total === 0 ? 'Riwayat sudah bersih' : 'Hapus semua riwayat'}
              </Button>
            </Card>
          </div>
        </div>
      )}

      <Modal
        open={open}
        onClose={() => {
          if (!busy) setOpen(false);
        }}
        title="Hapus seluruh riwayat?"
        description="Tindakan ini tidak dapat dibatalkan."
        size="sm"
      >
        <div className="space-y-4">
          {error && (
            <div role="alert" className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}
          <p className="text-sm leading-relaxed text-ink-600">
            {total} catatan transaksi akan dihapus permanen. Akun pengguna dan data master tetap dipertahankan.
          </p>
          <Field label="Ketik HAPUS RIWAYAT untuk melanjutkan" htmlFor="reset-confirmation" required>
            <Input
              id="reset-confirmation"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              placeholder="HAPUS RIWAYAT"
              autoComplete="off"
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
              Batal
            </Button>
            <Button
              variant="danger"
              onClick={reset}
              loading={busy}
              disabled={!confirmed}
              icon={<Trash2 className="h-4 w-4" />}
            >
              Hapus permanen
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

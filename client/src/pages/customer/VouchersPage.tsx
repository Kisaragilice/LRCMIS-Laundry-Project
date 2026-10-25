import { useState } from 'react';
import { CheckCircle2, Tag, Ticket, XCircle } from 'lucide-react';
import { Badge, Button, Card, EmptyState, ErrorState, Field, Input, LoadingState, PageHeader } from '../../components/ui';
import { useApi } from '../../lib/useApi';
import { api, ApiError } from '../../lib/api';
import { useToast } from '../../lib/toast';
import { formatCurrency, formatDate, formatDateTime } from '../../lib/format';
import type { Promotion } from '../../lib/types';

interface VoucherResult {
  promotionId: string;
  code: string;
  discountAmount: number;
  description: string;
}

export function VouchersPage() {
  const { toast } = useToast();
  const promotions = useApi<Promotion[]>('/promotions');
  const [code, setCode] = useState('');
  const [subtotal, setSubtotal] = useState('');
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<VoucherResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const validate = async () => {
    setChecking(true);
    setError(null);
    setResult(null);
    try {
      const response = await api.post<VoucherResult>('/promotions/validate', {
        code: code.trim(),
        subtotal: Number(subtotal || 0),
      });
      setResult(response);
      toast('Voucher memenuhi syarat');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Voucher tidak dapat divalidasi');
    } finally {
      setChecking(false);
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow="Promosi"
        title="Voucher saya"
        description="Voucher aktif yang dapat digunakan pada pesanan berikutnya. Validasi akhir tetap dilakukan server saat penerimaan cucian."
      />

      <div className="grid gap-5 xl:grid-cols-[1.4fr_0.6fr]">
        <div>
          {promotions.loading ? (
            <LoadingState label="Memuat voucher..." />
          ) : promotions.error ? (
            <ErrorState message={promotions.error} onRetry={promotions.refetch} />
          ) : (promotions.data ?? []).length === 0 ? (
            <EmptyState title="Belum ada voucher aktif" description="Pantau halaman ini untuk promosi berikutnya." icon={<Ticket className="h-6 w-6" />} />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {(promotions.data ?? []).map((promotion) => (
                <Card key={promotion.id} className={`relative overflow-hidden p-5 ${promotion.eligible === false ? 'opacity-70' : ''}`}>
                  <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-brand-50" />
                  <div className="relative">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-900 text-white">
                        <Tag className="h-5 w-5" />
                      </div>
                      <Badge tone={promotion.eligible === false ? 'slate' : 'green'}>
                        {promotion.eligible === false ? 'Belum memenuhi' : 'Aktif'}
                      </Badge>
                    </div>
                    <p className="mt-3 font-mono text-lg font-bold tracking-wide text-ink-950">{promotion.code}</p>
                    <p className="mt-1 text-sm font-semibold text-brand-800">
                      {promotion.discountType === 'percentage'
                        ? `Diskon ${promotion.discountValue}%`
                        : `Potongan ${formatCurrency(promotion.discountValue)}`}
                      {promotion.maxDiscount ? ` (maks. ${formatCurrency(promotion.maxDiscount)})` : ''}
                    </p>
                    <p className="mt-1 text-xs text-ink-500">Minimum transaksi {formatCurrency(promotion.minPurchase)}</p>
                    <p className="mt-1 text-xs text-ink-400">Berlaku sampai {formatDate(promotion.endAt)} · {formatDateTime(promotion.endAt).split(',')[1] ?? ''}</p>
                    {promotion.remainingQuota !== null && promotion.remainingQuota !== undefined && (
                      <p className="mt-1 text-xs text-ink-400">Sisa kuota: {promotion.remainingQuota}</p>
                    )}
                    {promotion.reason && <p className="mt-2 text-xs font-semibold text-amber-700">{promotion.reason}</p>}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <Card className="p-5">
            <p className="text-sm font-bold text-ink-950">Cek kelayakan voucher</p>
            <p className="mt-1 text-xs leading-relaxed text-ink-500">
              Masukkan kode dan subtotal belanja untuk melihat estimasi diskon. Penerapan final dilakukan admin saat
              penimbangan.
            </p>
            <div className="mt-4 space-y-3">
              <Field label="Kode voucher" htmlFor="code">
                <Input id="code" value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} placeholder="HEMAT10" />
              </Field>
              <Field label="Subtotal (Rp)" htmlFor="subtotal">
                <Input id="subtotal" type="number" min="0" value={subtotal} onChange={(event) => setSubtotal(event.target.value)} placeholder="50000" />
              </Field>
              <Button className="w-full" onClick={validate} loading={checking} disabled={!code.trim()}>
                Validasi voucher
              </Button>
            </div>

            {error && (
              <div className="mt-4 flex items-start gap-2 rounded-xl border border-red-100 bg-red-50 px-3 py-2.5 text-xs text-red-700">
                <XCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
              </div>
            )}
            {result && (
              <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2.5 text-xs text-emerald-800">
                <p className="flex items-center gap-1.5 font-bold"><CheckCircle2 className="h-4 w-4" /> Voucher dapat digunakan</p>
                <p className="mt-1">{result.description}</p>
                <p className="mt-1">Estimasi diskon: <span className="font-bold">{formatCurrency(result.discountAmount)}</span></p>
              </div>
            )}
          </Card>
          <Card className="bg-sand-100 p-5">
            <p className="text-sm font-bold text-ink-900">Ketentuan umum</p>
            <ul className="mt-2 space-y-2 text-xs leading-relaxed text-ink-600">
              <li>• Satu voucher hanya dapat digunakan sesuai batas per pengguna.</li>
              <li>• Kuota divalidasi ulang secara transaksional saat penerapan.</li>
              <li>• Voucher kedaluwarsa atau tidak memenuhi minimum akan ditolak.</li>
              <li>• Diskon tidak dapat melebihi subtotal tagihan.</li>
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}

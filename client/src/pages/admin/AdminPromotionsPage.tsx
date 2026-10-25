import { useState } from 'react';
import { Pencil, Plus, Tag } from 'lucide-react';
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
  Select,
} from '../../components/ui';
import { DataTable, Td, Th } from '../../components/common';
import { useApi } from '../../lib/useApi';
import { api, ApiError } from '../../lib/api';
import { useToast } from '../../lib/toast';
import { formatCurrency, formatDate } from '../../lib/format';
import type { Promotion } from '../../lib/types';

const toLocalInput = (iso: string) => {
  const date = new Date(iso);
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
};

const nowLocal = () => toLocalInput(new Date().toISOString());
const daysLaterLocal = (days: number) => toLocalInput(new Date(Date.now() + days * 86_400_000).toISOString());

interface PromotionForm {
  code: string;
  discountType: 'percentage' | 'fixed';
  discountValue: string;
  minPurchase: string;
  maxDiscount: string;
  perUserLimit: string;
  usageLimit: string;
  startAt: string;
  endAt: string;
  isActive: boolean;
}

const emptyForm = (): PromotionForm => ({
  code: '',
  discountType: 'percentage',
  discountValue: '10',
  minPurchase: '0',
  maxDiscount: '',
  perUserLimit: '1',
  usageLimit: '',
  startAt: nowLocal(),
  endAt: daysLaterLocal(30),
  isActive: true,
});

const promoStatus = (promotion: Promotion): { label: string; tone: 'green' | 'amber' | 'slate' | 'red' } => {
  if (!promotion.isActive) return { label: 'Nonaktif', tone: 'slate' };
  const now = Date.now();
  if (new Date(promotion.startAt).getTime() > now) return { label: 'Terjadwal', tone: 'amber' };
  if (new Date(promotion.endAt).getTime() < now) return { label: 'Berakhir', tone: 'red' };
  return { label: 'Aktif', tone: 'green' };
};

export function AdminPromotionsPage() {
  const { toast } = useToast();
  const promotions = useApi<Promotion[]>('/admin/promotions');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Promotion | null>(null);
  const [form, setForm] = useState<PromotionForm>(emptyForm);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setError(null);
    setOpen(true);
  };

  const startEdit = (promotion: Promotion) => {
    setEditing(promotion);
    setForm({
      code: promotion.code,
      discountType: promotion.discountType,
      discountValue: String(promotion.discountValue),
      minPurchase: String(promotion.minPurchase),
      maxDiscount: promotion.maxDiscount === null ? '' : String(promotion.maxDiscount),
      perUserLimit: String(promotion.perUserLimit ?? 1),
      usageLimit: promotion.usageLimit === null ? '' : String(promotion.usageLimit),
      startAt: toLocalInput(promotion.startAt),
      endAt: toLocalInput(promotion.endAt),
      isActive: promotion.isActive,
    });
    setError(null);
    setOpen(true);
  };

  const patch = <K extends keyof PromotionForm>(key: K, value: PromotionForm[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const submit = async () => {
    setBusy(true);
    setError(null);
    const payload = {
      code: form.code.trim().toUpperCase(),
      discountType: form.discountType,
      discountValue: Number(form.discountValue),
      minPurchase: Number(form.minPurchase || 0),
      maxDiscount: form.maxDiscount === '' ? null : Number(form.maxDiscount),
      perUserLimit: Number(form.perUserLimit || 1),
      usageLimit: form.usageLimit === '' ? null : Number(form.usageLimit),
      startAt: new Date(form.startAt).toISOString(),
      endAt: new Date(form.endAt).toISOString(),
      isActive: form.isActive,
    };
    try {
      if (editing) {
        const { code: _code, ...updates } = payload;
        await api.patch(`/admin/promotions/${editing.id}`, updates);
        toast('Promosi diperbarui');
      } else {
        await api.post('/admin/promotions', payload);
        toast('Promosi dibuat');
      }
      setOpen(false);
      promotions.refetch();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal menyimpan promosi');
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (promotion: Promotion) => {
    try {
      await api.patch(`/admin/promotions/${promotion.id}`, { isActive: !promotion.isActive });
      toast(promotion.isActive ? 'Promosi dinonaktifkan' : 'Promosi diaktifkan');
      promotions.refetch();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Gagal mengubah promosi', 'error');
    }
  };

  const renderActions = (promotion: Promotion) => (
    <div className="flex flex-wrap gap-1.5">
      <Button size="sm" variant="outline" icon={<Pencil className="h-3.5 w-3.5" />} onClick={() => startEdit(promotion)}>
        Ubah
      </Button>
      <Button size="sm" variant="ghost" onClick={() => toggle(promotion)}>
        {promotion.isActive ? 'Nonaktifkan' : 'Aktifkan'}
      </Button>
    </div>
  );

  return (
    <div>
      <PageHeader
        eyebrow="Pemasaran"
        title="Promosi & voucher"
        description="Atur diskon persentase atau nominal, minimum belanja, kuota, dan masa berlaku."
        actions={<Button icon={<Plus className="h-4 w-4" />} onClick={startCreate}>Buat promosi</Button>}
      />

      {promotions.loading ? (
        <LoadingState label="Memuat promosi..." />
      ) : promotions.error ? (
        <ErrorState message={promotions.error} onRetry={promotions.refetch} />
      ) : (promotions.data ?? []).length === 0 ? (
        <EmptyState
          title="Belum ada promosi"
          description="Buat voucher pertama untuk meningkatkan kunjungan pelanggan."
          icon={<Tag className="h-6 w-6" />}
          action={<Button onClick={startCreate}>Buat promosi</Button>}
        />
      ) : (
        <>
          <div className="space-y-3 md:hidden">
            {(promotions.data ?? []).map((promotion) => {
              const status = promoStatus(promotion);
              return (
                <Card key={promotion.id} className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <span className="rounded-lg bg-brand-50 px-2 py-1 font-mono text-sm font-bold text-brand-800">
                      {promotion.code}
                    </span>
                    <Badge tone={status.tone}>{status.label}</Badge>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3 border-t border-ink-50 pt-3 text-sm">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wide text-ink-400">Diskon</p>
                      <p className="font-bold text-ink-900">
                        {promotion.discountType === 'percentage'
                          ? `${promotion.discountValue}%`
                          : formatCurrency(promotion.discountValue)}
                      </p>
                      {promotion.maxDiscount !== null && (
                        <p className="text-[11px] text-ink-400">Maks {formatCurrency(promotion.maxDiscount)}</p>
                      )}
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wide text-ink-400">Pemakaian</p>
                      <p className="font-semibold text-ink-800">{promotion.usageCount ?? 0}</p>
                      <p className="text-[11px] text-ink-400">
                        {promotion.usageLimit ? `dari ${promotion.usageLimit}` : 'tanpa batas'}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wide text-ink-400">Ketentuan</p>
                      <p className="text-xs text-ink-600">Min. {formatCurrency(promotion.minPurchase)}</p>
                      <p className="text-[11px] text-ink-400">{promotion.perUserLimit ?? 1}x per pelanggan</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wide text-ink-400">Periode</p>
                      <p className="text-xs text-ink-600">{formatDate(promotion.startAt)}</p>
                      <p className="text-[11px] text-ink-400">s.d. {formatDate(promotion.endAt)}</p>
                    </div>
                  </div>
                  <div className="mt-3">{renderActions(promotion)}</div>
                </Card>
              );
            })}
          </div>

          <div className="hidden md:block">
            <DataTable>
              <thead>
                <tr>
                  <Th>Kode</Th>
                  <Th>Diskon</Th>
                  <Th>Ketentuan</Th>
                  <Th>Periode</Th>
                  <Th>Pemakaian</Th>
                  <Th>Status</Th>
                  <Th>Aksi</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-50">
                {(promotions.data ?? []).map((promotion) => {
                  const status = promoStatus(promotion);
                  return (
                    <tr key={promotion.id} className="hover:bg-sand-50/50">
                      <Td>
                        <span className="rounded-lg bg-brand-50 px-2 py-1 font-mono text-sm font-bold text-brand-800">
                          {promotion.code}
                        </span>
                      </Td>
                      <Td>
                        <p className="font-semibold text-ink-900">
                          {promotion.discountType === 'percentage'
                            ? `${promotion.discountValue}%`
                            : formatCurrency(promotion.discountValue)}
                        </p>
                        {promotion.maxDiscount !== null && (
                          <p className="text-[11px] text-ink-400">Maks {formatCurrency(promotion.maxDiscount)}</p>
                        )}
                      </Td>
                      <Td>
                        <p className="text-xs text-ink-600">Min. {formatCurrency(promotion.minPurchase)}</p>
                        <p className="text-[11px] text-ink-400">{promotion.perUserLimit ?? 1}x per pelanggan</p>
                      </Td>
                      <Td>
                        <p className="text-xs text-ink-600">{formatDate(promotion.startAt)}</p>
                        <p className="text-[11px] text-ink-400">s.d. {formatDate(promotion.endAt)}</p>
                      </Td>
                      <Td>
                        <p className="text-sm font-semibold">{promotion.usageCount ?? 0}</p>
                        <p className="text-[11px] text-ink-400">
                          {promotion.usageLimit ? `dari ${promotion.usageLimit}` : 'tanpa batas'}
                        </p>
                      </Td>
                      <Td>
                        <Badge tone={status.tone}>{status.label}</Badge>
                      </Td>
                      <Td>{renderActions(promotion)}</Td>
                    </tr>
                  );
                })}
              </tbody>
            </DataTable>
          </div>
        </>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? `Ubah promosi ${editing.code}` : 'Buat promosi'} size="lg">
        <div className="space-y-4">
          {error && <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Kode voucher" htmlFor="promo-code" required hint="Huruf kapital, angka, _ atau -">
              <Input id="promo-code" value={form.code} disabled={Boolean(editing)} onChange={(event) => patch('code', event.target.value.toUpperCase())} placeholder="HEMAT10" />
            </Field>
            <Field label="Tipe diskon" required>
              <Select value={form.discountType} onChange={(event) => patch('discountType', event.target.value as PromotionForm['discountType'])}>
                <option value="percentage">Persentase</option>
                <option value="fixed">Nominal</option>
              </Select>
            </Field>
            <Field label={form.discountType === 'percentage' ? 'Persentase (%)' : 'Nominal (IDR)'} htmlFor="promo-value" required>
              <Input id="promo-value" type="number" min="1" max={form.discountType === 'percentage' ? 100 : undefined} value={form.discountValue} onChange={(event) => patch('discountValue', event.target.value)} />
            </Field>
            <Field label="Diskon maksimum (IDR)" htmlFor="promo-max" hint="Kosongkan bila tanpa batas">
              <Input id="promo-max" type="number" min="1" value={form.maxDiscount} onChange={(event) => patch('maxDiscount', event.target.value)} />
            </Field>
            <Field label="Minimum belanja (IDR)" htmlFor="promo-min">
              <Input id="promo-min" type="number" min="0" value={form.minPurchase} onChange={(event) => patch('minPurchase', event.target.value)} />
            </Field>
            <Field label="Batas per pelanggan" htmlFor="promo-user">
              <Input id="promo-user" type="number" min="1" value={form.perUserLimit} onChange={(event) => patch('perUserLimit', event.target.value)} />
            </Field>
            <Field label="Kuota total" htmlFor="promo-quota" hint="Kosongkan bila tanpa batas">
              <Input id="promo-quota" type="number" min="1" value={form.usageLimit} onChange={(event) => patch('usageLimit', event.target.value)} />
            </Field>
            <Field label="Status">
              <Select value={form.isActive ? 'true' : 'false'} onChange={(event) => patch('isActive', event.target.value === 'true')}>
                <option value="true">Aktif</option>
                <option value="false">Nonaktif</option>
              </Select>
            </Field>
            <Field label="Mulai" htmlFor="promo-start" required>
              <Input id="promo-start" type="datetime-local" value={form.startAt} onChange={(event) => patch('startAt', event.target.value)} />
            </Field>
            <Field label="Berakhir" htmlFor="promo-end" required>
              <Input id="promo-end" type="datetime-local" value={form.endAt} onChange={(event) => patch('endAt', event.target.value)} />
            </Field>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Batal</Button>
            <Button onClick={submit} loading={busy} disabled={form.code.trim().length < 3 || !form.discountValue}>Simpan</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

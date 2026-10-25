import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, Plus, Store, Truck } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Field,
  LoadingState,
  Modal,
  PageHeader,
  StatusBadge,
  Tabs,
  Textarea,
} from '../../components/ui';
import { KeyValue, Note } from '../../components/common';
import { useApi } from '../../lib/useApi';
import { api, ApiError } from '../../lib/api';
import { useToast } from '../../lib/toast';
import { formatDate, formatDateTime, reservationStatusLabel } from '../../lib/format';
import type { Reservation } from '../../lib/types';

type Tab = 'all' | 'pending' | 'confirmed' | 'cancelled' | 'expired';

export function ReservationsPage() {
  const { toast } = useToast();
  const reservations = useApi<Reservation[]>('/reservations/me');
  const [tab, setTab] = useState<Tab>('all');
  const [cancelTarget, setCancelTarget] = useState<Reservation | null>(null);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rows = (reservations.data ?? []).filter((reservation) => tab === 'all' || reservation.status === tab);

  const cancel = async () => {
    if (!cancelTarget) return;
    setSaving(true);
    setError(null);
    try {
      await api.patch(`/reservations/${cancelTarget.id}/cancel`, { reason: reason.trim() || undefined });
      toast('Reservasi berhasil dibatalkan');
      setCancelTarget(null);
      setReason('');
      reservations.refetch();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal membatalkan reservasi');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow="Reservasi"
        title="Reservasi saya"
        description="Kelola jadwal antar/jemput. Pembatalan mengikuti batas waktu yang berlaku."
        actions={
          <Link to="/reservasi/baru">
            <Button icon={<Plus className="h-4 w-4" />}>Reservasi baru</Button>
          </Link>
        }
      />

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'all', label: 'Semua' },
          { value: 'pending', label: 'Menunggu' },
          { value: 'confirmed', label: 'Dikonfirmasi' },
          { value: 'cancelled', label: 'Dibatalkan' },
          { value: 'expired', label: 'Kedaluwarsa' },
        ]}
      />

      <div className="mt-5">
        {reservations.loading ? (
          <LoadingState label="Memuat reservasi..." />
        ) : reservations.error ? (
          <ErrorState message={reservations.error} onRetry={reservations.refetch} />
        ) : rows.length === 0 ? (
          <EmptyState
            title="Tidak ada reservasi"
            description="Belum ada reservasi pada kategori ini. Buat reservasi baru untuk memilih jadwal."
            icon={<CalendarDays className="h-6 w-6" />}
            action={
              <Link to="/reservasi/baru">
                <Button size="sm">Buat reservasi</Button>
              </Link>
            }
          />
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {rows.map((reservation) => (
              <Card key={reservation.id} className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-ink-950">{reservation.reservationCode}</p>
                    <p className="mt-0.5 text-xs text-ink-400">Dibuat {formatDateTime(reservation.createdAt)}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={reservation.status} label={reservationStatusLabel[reservation.status] ?? reservation.status} />
                    <Badge tone={reservation.pickupType === 'pickup' ? 'blue' : 'slate'}>
                      {reservation.pickupType === 'pickup' ? <Truck className="h-3 w-3" /> : <Store className="h-3 w-3" />}
                      {reservation.pickupType === 'pickup' ? 'Pickup' : 'Drop-off'}
                    </Badge>
                  </div>
                </div>

                <div className="mt-4 rounded-xl bg-sand-50 px-4 py-3">
                  <p className="text-xs font-bold uppercase tracking-wide text-ink-400">Jadwal</p>
                  <p className="mt-1 text-sm font-bold text-ink-900">{formatDate(reservation.timeSlot.slotDate)}</p>
                  <p className="text-sm text-ink-500">{reservation.timeSlot.startTime}–{reservation.timeSlot.endTime} WIB</p>
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  {reservation.items.map((item) => (
                    <span key={item.id} className="rounded-full bg-ink-50 px-2.5 py-1 text-[11px] font-semibold text-ink-600">
                      {item.name ?? 'Layanan'} × {item.quantity}
                    </span>
                  ))}
                </div>

                {reservation.pickupType === 'pickup' && reservation.address && (
                  <p className="mt-3 text-xs leading-relaxed text-ink-500">Pickup: {reservation.address.addressText}</p>
                )}
                {reservation.notes && <p className="mt-2 text-xs text-ink-400">Catatan: {reservation.notes}</p>}

                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-ink-100 pt-4">
                  {reservation.order ? (
                    <Link to={`/pesanan/${reservation.order.id}`} className="text-sm font-bold text-brand-700 hover:text-brand-900">
                      Lihat pesanan {reservation.order.orderCode} →
                    </Link>
                  ) : (
                    <p className="text-xs text-ink-400">
                      {reservation.status === 'confirmed' ? 'Menunggu cucian diterima admin' : 'Pesanan dibuat setelah konfirmasi'}
                    </p>
                  )}
                  {['pending', 'confirmed'].includes(reservation.status) && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                      onClick={() => {
                        setCancelTarget(reservation);
                        setError(null);
                        setReason('');
                      }}
                    >
                      Batalkan
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <div className="mt-6"><Note tone="warning">Pembatalan hanya dapat dilakukan paling lambat 2 jam sebelum slot dimulai. Setelah itu, hubungi admin melalui menu keluhan.</Note></div>

      <Modal open={Boolean(cancelTarget)} onClose={() => setCancelTarget(null)} title="Batalkan reservasi" description={cancelTarget?.reservationCode} size="sm">
        <div className="space-y-4">
          {error && <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
          <KeyValue label="Jadwal" value={cancelTarget ? `${formatDate(cancelTarget.timeSlot.slotDate)} · ${cancelTarget.timeSlot.startTime}` : '-'} />
          <Field label="Alasan pembatalan" htmlFor="reason" hint="Opsional, membantu tim memahami kendala Anda">
            <Textarea id="reason" value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} placeholder="Contoh: rencana berubah" />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setCancelTarget(null)}>Tutup</Button>
            <Button variant="danger" onClick={cancel} loading={saving}>Batalkan reservasi</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

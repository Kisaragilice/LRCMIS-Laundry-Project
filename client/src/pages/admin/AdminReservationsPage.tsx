import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarCheck, Check, Eye, Plus, Search, X } from 'lucide-react';
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
  StatusBadge,
  Textarea,
} from '../../components/ui';
import { DataTable, KeyValue, Td, Th } from '../../components/common';
import { usePagedApi } from '../../lib/useApi';
import { api, ApiError } from '../../lib/api';
import { useToast } from '../../lib/toast';
import { formatDate, formatDateTime, reservationStatusLabel } from '../../lib/format';
import type { Order, Reservation } from '../../lib/types';

export function AdminReservationsPage() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [date, setDate] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  const query = new URLSearchParams();
  query.set('page', String(page));
  query.set('limit', '10');
  if (status) query.set('status', status);
  if (date) query.set('date', date);
  if (search) query.set('search', search);

  const reservations = usePagedApi<Reservation>(`/admin/reservations?${query.toString()}`, [page, status, date, search]);
  const [detail, setDetail] = useState<Reservation | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Reservation | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const act = async (id: string, fn: () => Promise<unknown>, message: string) => {
    setBusy(id);
    setError(null);
    try {
      await fn();
      toast(message);
      reservations.refetch();
      return true;
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Terjadi kesalahan');
      return false;
    } finally {
      setBusy(null);
    }
  };

  const confirm = (reservation: Reservation) =>
    act(reservation.id, () => api.patch(`/admin/reservations/${reservation.id}/confirm`), 'Reservasi dikonfirmasi');

  const cancel = async () => {
    if (!cancelTarget) return;
    const done = await act(
      cancelTarget.id,
      () => api.patch(`/admin/reservations/${cancelTarget.id}/cancel`, { reason: reason.trim() || 'Dibatalkan oleh admin' }),
      'Reservasi dibatalkan',
    );
    if (done) {
      setCancelTarget(null);
      setReason('');
    }
  };

  const createOrder = async (reservation: Reservation) => {
    setBusy(reservation.id);
    setError(null);
    try {
      const order = await api.post<Order>(`/admin/reservations/${reservation.id}/orders`, {});
      toast('Pesanan berhasil dibuat');
      navigate(`/admin/pesanan/${order.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal membuat pesanan');
    } finally {
      setBusy(null);
    }
  };

  const renderActions = (reservation: Reservation) => (
    <div className="flex flex-wrap gap-1.5">
      <Button size="sm" variant="ghost" onClick={() => setDetail(reservation)} icon={<Eye className="h-3.5 w-3.5" />}>
        Detail
      </Button>
      {reservation.status === 'pending' && (
        <>
          <Button
            size="sm"
            variant="outline"
            loading={busy === reservation.id}
            onClick={() => confirm(reservation)}
            icon={<Check className="h-3.5 w-3.5" />}
          >
            Konfirmasi
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-red-600"
            onClick={() => {
              setCancelTarget(reservation);
              setReason('');
              setError(null);
            }}
            icon={<X className="h-3.5 w-3.5" />}
          >
            Batal
          </Button>
        </>
      )}
      {reservation.status === 'confirmed' && !reservation.order && (
        <Button
          size="sm"
          variant="soft"
          loading={busy === reservation.id}
          onClick={() => createOrder(reservation)}
          icon={<Plus className="h-3.5 w-3.5" />}
        >
          Buat pesanan
        </Button>
      )}
      {reservation.order && (
        <Button size="sm" variant="ghost" onClick={() => navigate(`/admin/pesanan/${reservation.order!.id}`)}>
          Pesanan →
        </Button>
      )}
    </div>
  );

  return (
    <div>
      <PageHeader
        eyebrow="Operasional"
        title="Reservasi"
        description="Konfirmasi reservasi, batalkan bila perlu, lalu buat pesanan untuk penimbangan."
      />

      <Card className="mb-5 p-4">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            setPage(1);
            setSearch(searchInput.trim());
          }}
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_180px_180px_auto]"
        >
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
            <Input className="pl-10" placeholder="Cari kode atau nama pelanggan..." aria-label="Cari reservasi" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} />
          </div>
          <Select aria-label="Filter status reservasi" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}>
            <option value="">Semua status</option>
            <option value="pending">Menunggu</option>
            <option value="confirmed">Dikonfirmasi</option>
            <option value="cancelled">Dibatalkan</option>
            <option value="expired">Kedaluwarsa</option>
          </Select>
          <Input type="date" value={date} onChange={(event) => { setDate(event.target.value); setPage(1); }} aria-label="Filter tanggal slot" />
          <Button type="submit">Terapkan</Button>
        </form>
      </Card>

      {error && <div className="mb-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {reservations.loading ? (
        <LoadingState label="Memuat reservasi..." />
      ) : reservations.error ? (
        <ErrorState message={reservations.error} onRetry={reservations.refetch} />
      ) : reservations.rows.length === 0 ? (
        <EmptyState title="Tidak ada reservasi" description="Coba ubah filter atau rentang tanggal." icon={<CalendarCheck className="h-6 w-6" />} />
      ) : (
        <>
          <div className="space-y-3 md:hidden">
            {reservations.rows.map((reservation) => (
              <Card key={reservation.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="whitespace-nowrap font-bold text-ink-900">{reservation.reservationCode}</p>
                    <p className="mt-0.5 text-[11px] text-ink-400">{formatDateTime(reservation.createdAt)}</p>
                  </div>
                  <StatusBadge
                    status={reservation.status}
                    label={reservationStatusLabel[reservation.status] ?? reservation.status}
                  />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3 border-t border-ink-50 pt-3 text-sm">
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-ink-400">Pelanggan</p>
                    <p className="truncate font-semibold text-ink-800">{reservation.customer?.name ?? '-'}</p>
                    <p className="truncate text-[11px] text-ink-400">{reservation.customer?.email}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-ink-400">Jadwal</p>
                    <p className="font-semibold text-ink-800">{formatDate(reservation.timeSlot.slotDate)}</p>
                    <p className="text-[11px] text-ink-400">
                      {reservation.timeSlot.startTime}–{reservation.timeSlot.endTime}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <Badge tone={reservation.pickupType === 'pickup' ? 'blue' : 'slate'}>
                    {reservation.pickupType === 'pickup' ? 'Pickup' : 'Drop-off'}
                  </Badge>
                  {renderActions(reservation)}
                </div>
              </Card>
            ))}
          </div>

          <div className="hidden md:block">
            <DataTable>
              <thead>
                <tr>
                  <Th>Kode</Th>
                  <Th>Pelanggan</Th>
                  <Th>Jadwal</Th>
                  <Th>Metode</Th>
                  <Th>Status</Th>
                  <Th>Aksi</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-50">
                {reservations.rows.map((reservation) => (
                  <tr key={reservation.id} className="hover:bg-sand-50/50">
                    <Td>
                      <p className="whitespace-nowrap font-bold text-ink-900">{reservation.reservationCode}</p>
                      <p className="mt-0.5 text-[11px] text-ink-400">{formatDateTime(reservation.createdAt)}</p>
                    </Td>
                    <Td>
                      <p className="font-semibold text-ink-800">{reservation.customer?.name ?? '-'}</p>
                      <p className="text-[11px] text-ink-400">{reservation.customer?.email}</p>
                    </Td>
                    <Td>
                      <p className="text-sm">{formatDate(reservation.timeSlot.slotDate)}</p>
                      <p className="text-[11px] text-ink-400">
                        {reservation.timeSlot.startTime}–{reservation.timeSlot.endTime}
                      </p>
                    </Td>
                    <Td>
                      <Badge tone={reservation.pickupType === 'pickup' ? 'blue' : 'slate'}>
                        {reservation.pickupType === 'pickup' ? 'Pickup' : 'Drop-off'}
                      </Badge>
                    </Td>
                    <Td>
                      <StatusBadge
                        status={reservation.status}
                        label={reservationStatusLabel[reservation.status] ?? reservation.status}
                      />
                    </Td>
                    <Td>{renderActions(reservation)}</Td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          </div>
          <div className="mt-4">
            <Pagination page={page} totalPages={reservations.meta?.totalPages ?? 1} total={reservations.meta?.total} onChange={setPage} />
          </div>
        </>
      )}

      <Modal open={Boolean(detail)} onClose={() => setDetail(null)} title="Detail reservasi" description={detail?.reservationCode}>
        {detail && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={detail.status} label={reservationStatusLabel[detail.status] ?? detail.status} />
              <Badge tone={detail.pickupType === 'pickup' ? 'blue' : 'slate'}>{detail.pickupType === 'pickup' ? 'Pickup' : 'Drop-off'}</Badge>
            </div>
            <dl>
              <KeyValue label="Pelanggan" value={detail.customer?.name ?? '-'} />
              <KeyValue label="Email" value={detail.customer?.email ?? '-'} />
              <KeyValue label="Telepon" value={detail.customer?.phone ?? '-'} />
              <KeyValue label="Jadwal" value={`${formatDate(detail.timeSlot.slotDate)} · ${detail.timeSlot.startTime}–${detail.timeSlot.endTime}`} />
              <KeyValue label="Dibuat" value={formatDateTime(detail.createdAt)} />
            </dl>
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-ink-400">Layanan</p>
              <div className="mt-2 space-y-1.5">
                {detail.items.map((item) => (
                  <div key={item.id} className="flex justify-between rounded-lg bg-ink-50 px-3 py-2 text-sm">
                    <span>{item.name ?? 'Layanan'} × {item.quantity}</span>
                    <span className="text-xs text-ink-500">{item.pricingUnit}</span>
                  </div>
                ))}
              </div>
            </div>
            {detail.address && (
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-ink-400">Alamat pickup</p>
                <p className="mt-1 text-sm leading-relaxed text-ink-600">{detail.address.addressText}</p>
                <p className="mt-1 text-xs text-ink-400">{[detail.address.recipientName, detail.address.phone].filter(Boolean).join(' · ')}</p>
              </div>
            )}
            {detail.notes && (
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-ink-400">Catatan pelanggan</p>
                <p className="mt-1 text-sm leading-relaxed text-ink-600">{detail.notes}</p>
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal open={Boolean(cancelTarget)} onClose={() => setCancelTarget(null)} title="Batalkan reservasi" size="sm">
        <div className="space-y-4">
          <Field label="Alasan pembatalan" htmlFor="cancelReason" required>
            <Textarea id="cancelReason" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Alasan yang akan dicatat pada audit log" />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setCancelTarget(null)}>Tutup</Button>
            <Button variant="danger" onClick={cancel} loading={busy === cancelTarget?.id} disabled={reason.trim().length < 3}>Batalkan reservasi</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

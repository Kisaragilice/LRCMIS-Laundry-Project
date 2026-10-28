import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Mail, MapPin, Phone, UserRound } from 'lucide-react';
import { Badge, Button, Card, ErrorState, LoadingState, Modal, PageHeader, StatusBadge } from '../../components/ui';
import { DataTable, KeyValue, Note, Stars, Td, Th } from '../../components/common';
import { useApi } from '../../lib/useApi';
import { api, ApiError } from '../../lib/api';
import { useToast } from '../../lib/toast';
import { formatCurrency, formatDate, formatDateTime, orderStatusLabel, reservationStatusLabel } from '../../lib/format';
import type { Address } from '../../lib/types';

interface CustomerDetail {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  isActive: boolean;
  createdAt: string;
  addresses: Address[];
  orders: Array<{ id: string; orderCode: string; orderStatus: string; paymentStatus: string; totalAmount: number; createdAt: string }>;
  reservations: Array<{ id: string; reservationCode: string; status: string; pickupType: string; timeSlot: { slotDate: string; startTime: string; endTime: string }; itemCount: number; createdAt: string }>;
  reviews: Array<{ id: string; rating: number; comment: string | null; createdAt: string }>;
}

export function AdminCustomerDetailPage() {
  const { id } = useParams();
  const { toast } = useToast();
  const customer = useApi<CustomerDetail>(id ? `/admin/customers/${id}` : null, [id]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = async () => {
    if (!customer.data) return;
    setBusy(true);
    setError(null);
    try {
      await api.patch(`/admin/customers/${customer.data.id}/status`, { isActive: !customer.data.isActive });
      toast(customer.data.isActive ? 'Pelanggan dinonaktifkan' : 'Pelanggan diaktifkan');
      setConfirmOpen(false);
      customer.refetch();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal memperbarui status');
    } finally {
      setBusy(false);
    }
  };

  if (customer.loading) return <LoadingState label="Memuat detail pelanggan..." />;
  if (customer.error || !customer.data) return <ErrorState message={customer.error ?? 'Pelanggan tidak ditemukan'} onRetry={customer.refetch} />;
  const data = customer.data;
  const { addresses = [], orders = [], reservations = [], reviews = [] } = data;
  const lifetime = orders.filter((order) => order.paymentStatus === 'paid').reduce((sum, order) => sum + order.totalAmount, 0);

  return (
    <div>
      <PageHeader
        eyebrow="Pelanggan"
        title={data.name}
        description={`Bergabung ${formatDate(data.createdAt)}`}
        actions={
          <>
            <Link to="/admin/pelanggan"><Button variant="outline" size="sm" icon={<ArrowLeft className="h-4 w-4" />}>Kembali</Button></Link>
            <Button size="sm" variant={data.isActive ? 'danger' : 'primary'} onClick={() => { setConfirmOpen(true); setError(null); }}>
              {data.isActive ? 'Nonaktifkan' : 'Aktifkan'}
            </Button>
          </>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[0.75fr_1.25fr]">
        <div className="space-y-5">
          <Card className="p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-700"><UserRound className="h-6 w-6" /></div>
              <div>
                <p className="font-bold text-ink-950">{data.name}</p>
                <Badge tone={data.isActive ? 'green' : 'red'}>{data.isActive ? 'Aktif' : 'Nonaktif'}</Badge>
              </div>
            </div>
            <dl className="mt-4">
              <KeyValue label="Email" value={<span className="inline-flex items-center gap-1"><Mail className="h-3.5 w-3.5" /> {data.email}</span>} />
              <KeyValue label="Telepon" value={data.phone ? <span className="inline-flex items-center gap-1"><Phone className="h-3.5 w-3.5" /> {data.phone}</span> : '-'} />
              <KeyValue label="Total pesanan" value={orders.length} />
              <KeyValue label="Nilai lunas" value={formatCurrency(lifetime)} />
              <KeyValue label="Rating diberikan" value={reviews.length ? `${(reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)} (${reviews.length})` : '-'} />
            </dl>
          </Card>

          <Card className="p-5">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-ink-400">Alamat tersimpan</p>
            {addresses.length === 0 ? (
              <p className="mt-3 text-sm text-ink-400">Belum ada alamat.</p>
            ) : (
              <div className="mt-3 space-y-2">
                {addresses.map((address) => (
                  <div key={address.id} className="rounded-xl border border-ink-100 p-3">
                    <p className="flex items-center gap-1.5 text-sm font-semibold text-ink-900">
                      <MapPin className="h-3.5 w-3.5 text-brand-700" /> {address.label || 'Alamat'}
                      {address.isDefault && <span className="rounded bg-brand-100 px-1.5 py-0.5 text-[10px] font-bold text-brand-800">Utama</span>}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-ink-500">{address.addressText}</p>
                    {(address.recipientName || address.phone) && <p className="mt-1 text-[11px] text-ink-400">{[address.recipientName, address.phone].filter(Boolean).join(' · ')}</p>}
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="p-5">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-ink-400">Ulasan terakhir</p>
            {reviews.length === 0 ? (
              <p className="mt-3 text-sm text-ink-400">Belum ada ulasan.</p>
            ) : (
              <div className="mt-3 space-y-2">
                {reviews.map((review) => (
                  <div key={review.id} className="rounded-xl bg-ink-50 p-3">
                    <Stars value={review.rating} size="sm" />
                    <p className="mt-1 text-xs leading-relaxed text-ink-600">{review.comment || 'Tanpa komentar.'}</p>
                    <p className="mt-1 text-[10px] text-ink-400">{formatDateTime(review.createdAt)}</p>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-5">
          <Card className="p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-bold text-ink-950">Pesanan</h2>
              <Link to={`/admin/pesanan?search=${encodeURIComponent(data.email)}`} className="text-xs font-bold text-brand-700">Cari di pesanan →</Link>
            </div>
            <div className="mt-4">
              {orders.length === 0 ? (
                <p className="text-sm text-ink-400">Belum ada pesanan.</p>
              ) : (
                <DataTable>
                  <thead><tr><Th>Kode</Th><Th>Status</Th><Th className="text-right">Total</Th><Th>Dibuat</Th><Th /></tr></thead>
                  <tbody className="divide-y divide-ink-50">
                    {orders.map((order) => (
                      <tr key={order.id}>
                        <Td className="font-semibold text-ink-900">{order.orderCode}</Td>
                        <Td><StatusBadge status={order.orderStatus} label={orderStatusLabel[order.orderStatus] ?? order.orderStatus} /></Td>
                        <Td className="text-right font-semibold">{formatCurrency(order.totalAmount)}</Td>
                        <Td className="text-xs text-ink-400">{formatDate(order.createdAt)}</Td>
                        <Td><Link to={`/admin/pesanan/${order.id}`} className="text-brand-700"><ArrowRight className="h-4 w-4" /></Link></Td>
                      </tr>
                    ))}
                  </tbody>
                </DataTable>
              )}
            </div>
          </Card>

          <Card className="p-5 sm:p-6">
            <h2 className="text-base font-bold text-ink-950">Reservasi</h2>
            <div className="mt-4">
              {reservations.length === 0 ? (
                <p className="text-sm text-ink-400">Belum ada reservasi.</p>
              ) : (
                <DataTable>
                  <thead><tr><Th>Kode</Th><Th>Jadwal</Th><Th>Metode</Th><Th>Item</Th><Th>Status</Th></tr></thead>
                  <tbody className="divide-y divide-ink-50">
                    {reservations.map((reservation) => (
                      <tr key={reservation.id}>
                        <Td className="font-semibold text-ink-900">{reservation.reservationCode}</Td>
                        <Td className="text-xs">{formatDate(reservation.timeSlot.slotDate)} · {reservation.timeSlot.startTime}</Td>
                        <Td><Badge tone={reservation.pickupType === 'pickup' ? 'blue' : 'slate'}>{reservation.pickupType === 'pickup' ? 'Pickup' : 'Drop-off'}</Badge></Td>
                        <Td>{reservation.itemCount}</Td>
                        <Td><StatusBadge status={reservation.status} label={reservationStatusLabel[reservation.status] ?? reservation.status} /></Td>
                      </tr>
                    ))}
                  </tbody>
                </DataTable>
              )}
            </div>
          </Card>

          <Note>Data pelanggan hanya dapat diakses admin untuk keperluan operasional. Setiap perubahan status tercatat pada audit log.</Note>
        </div>
      </div>

      <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)} title={data.isActive ? 'Nonaktifkan pelanggan' : 'Aktifkan pelanggan'} size="sm">
        <div className="space-y-4">
          {error && <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
          <p className="text-sm leading-relaxed text-ink-600">
            {data.isActive
              ? `Akun ${data.name} tidak akan dapat masuk hingga diaktifkan kembali.`
              : `Aktifkan kembali akun ${data.name} agar dapat bertransaksi.`}
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>Batal</Button>
            <Button variant={data.isActive ? 'danger' : 'primary'} onClick={toggle} loading={busy}>{data.isActive ? 'Nonaktifkan' : 'Aktifkan'}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

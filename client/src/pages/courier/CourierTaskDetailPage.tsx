import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, MapPin, MessageCircle, Navigation, Phone, Play, UserRound, XCircle } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  ErrorState,
  Field,
  Input,
  LoadingState,
  Modal,
  PageHeader,
  StatusBadge,
  Textarea,
} from '../../components/ui';
import { KeyValue } from '../../components/common';
import { useApi } from '../../lib/useApi';
import { api, ApiError } from '../../lib/api';
import { useToast } from '../../lib/toast';
import { formatCurrency, formatDateTime, paymentStatusLabel, taskStatusLabel, taskTypeLabel } from '../../lib/format';
import type { DeliveryTask } from '../../lib/types';

type ModalKind = 'completed' | 'failed' | null;

export function CourierTaskDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const task = useApi<DeliveryTask>(id ? `/courier/tasks/${id}` : null, [id]);
  const [busy, setBusy] = useState(false);
  const [chatBusy, setChatBusy] = useState(false);
  const [modal, setModal] = useState<ModalKind>(null);
  const [handoverRecipient, setHandoverRecipient] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const update = async (status: 'accepted' | 'in_progress' | 'completed' | 'failed', extra?: { notes?: string; handoverRecipient?: string }) => {
    setBusy(true);
    setError(null);
    try {
      await api.patch(`/courier/tasks/${id}/status`, { status, ...extra });
      toast(`Status tugas diperbarui: ${taskStatusLabel[status]}`);
      setModal(null);
      task.refetch();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal memperbarui tugas');
    } finally {
      setBusy(false);
    }
  };

  if (task.loading) return <LoadingState label="Memuat detail tugas..." />;
  if (task.error || !task.data) return <ErrorState message={task.error ?? 'Tugas tidak ditemukan'} onRetry={task.refetch} />;

  const data = task.data;

  const openCustomerChat = async () => {
    if (chatBusy) return;
    setChatBusy(true);
    setError(null);
    try {
      const conversation = await api.post<{ id: string }>(`/chat/orders/${data.orderId}/thread`);
      navigate(`/chat?conversation=${conversation.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal membuka chat pelanggan');
    } finally {
      setChatBusy(false);
    }
  };

  const address = data.addressSnapshot || data.order?.address?.addressText || '';
  const phone = data.contactPhone || data.order?.customer?.phone || '';
  const customerName = data.order?.customer?.name ?? 'Pelanggan';
  const mapsUrl = address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}` : null;

  return (
    <div>
      <button type="button" onClick={() => navigate('/courier')} className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-500 hover:text-ink-800">
        <ArrowLeft className="h-4 w-4" /> Kembali ke tugas
      </button>

      <PageHeader
        eyebrow={taskTypeLabel[data.taskType]}
        title={`Tugas ${data.order?.orderCode ?? ''}`}
        description={`Dijadwalkan ${formatDateTime(data.scheduledAt)}`}
        actions={<StatusBadge status={data.status} label={taskStatusLabel[data.status] ?? data.status} />}
      />

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <Card className="p-5">
            <h2 className="mb-4 text-lg font-bold text-ink-950">Informasi pengantaran</h2>
            <div className="space-y-3">
              <div className="flex items-start gap-3 rounded-xl bg-ink-50 px-4 py-3">
                <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-brand-700" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold uppercase tracking-wider text-ink-400">Alamat</p>
                  <p className="mt-1 text-sm text-ink-800">{address || 'Alamat belum tersedia'}</p>
                </div>
                {mapsUrl && (
                  <a href={mapsUrl} target="_blank" rel="noreferrer">
                    <Button size="sm" variant="outline" icon={<Navigation className="h-3.5 w-3.5" />}>Navigasi</Button>
                  </a>
                )}
              </div>
              <div className="flex items-center gap-3 rounded-xl bg-ink-50 px-4 py-3">
                <UserRound className="h-5 w-5 shrink-0 text-brand-700" />
                <div className="flex-1">
                  <p className="text-xs font-semibold uppercase tracking-wider text-ink-400">Penerima / pelanggan</p>
                  <p className="mt-1 text-sm text-ink-800">{customerName}</p>
                </div>
              </div>
              {phone && (
                <div className="flex items-center gap-3 rounded-xl bg-ink-50 px-4 py-3">
                  <Phone className="h-5 w-5 shrink-0 text-brand-700" />
                  <div className="flex-1">
                    <p className="text-xs font-semibold uppercase tracking-wider text-ink-400">Telepon</p>
                    <a href={`tel:${phone}`} className="mt-1 block text-sm font-semibold text-brand-700">{phone}</a>
                  </div>
                </div>
              )}
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="mb-4 text-lg font-bold text-ink-950">Catatan</h2>
            {data.notes ? (
              <p className="rounded-xl bg-sand-50 px-4 py-3 text-sm text-ink-700">{data.notes}</p>
            ) : (
              <p className="text-sm text-ink-400">Tidak ada catatan dari admin.</p>
            )}
            {data.handoverRecipient && (
              <div className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                <p className="font-semibold">Serah terima selesai</p>
                <p className="mt-0.5">Diterima oleh {data.handoverRecipient} pada {formatDateTime(data.handoverConfirmedAt)}.</p>
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-5">
            <h2 className="mb-3 text-lg font-bold text-ink-950">Aksi tugas</h2>
            {error && <div className="mb-3 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
            <div className="space-y-2">
              {data.status === 'assigned' && (
                <Button className="w-full" loading={busy} icon={<CheckCircle2 className="h-4 w-4" />} onClick={() => update('accepted')}>
                  Terima tugas
                </Button>
              )}
              {data.status === 'accepted' && (
                <Button className="w-full" loading={busy} icon={<Play className="h-4 w-4" />} onClick={() => update('in_progress')}>
                  Mulai perjalanan
                </Button>
              )}
              {data.status === 'in_progress' && (
                <>
                  {data.taskType === 'delivery' && data.order?.orderStatus === 'delivering' && (
                    <Button
                      className="w-full"
                      variant="secondary"
                      loading={chatBusy}
                      icon={<MessageCircle className="h-4 w-4" />}
                      onClick={openCustomerChat}
                    >
                      Chat pelanggan
                    </Button>
                  )}
                  <Button className="w-full" icon={<CheckCircle2 className="h-4 w-4" />} onClick={() => { setNotes(''); setHandoverRecipient(''); setError(null); setModal('completed'); }}>
                    Selesaikan & serah terima
                  </Button>
                  <Button className="w-full" variant="outline" icon={<XCircle className="h-4 w-4" />} onClick={() => { setNotes(''); setError(null); setModal('failed'); }}>
                    Laporkan gagal
                  </Button>
                </>
              )}
              {['completed', 'failed'].includes(data.status) && (
                <p className="rounded-xl bg-ink-50 px-4 py-3 text-sm text-ink-500">
                  Tugas ini sudah final dan tidak dapat diubah.
                </p>
              )}
            </div>
            <p className="mt-4 text-[11px] leading-relaxed text-ink-400">
              Status pesanan akan otomatis menjadi “Diantar” saat perjalanan dimulai dan “Selesai” setelah serah terima
              untuk pesanan yang sudah lunas.
            </p>
          </Card>

          <Card className="p-5">
            <h2 className="mb-2 text-lg font-bold text-ink-950">Ringkasan pesanan</h2>
            <dl>
              <KeyValue label="Pesanan" value={<Link to={`/courier/tugas/${data.id}`} className="text-brand-700">{data.order?.orderCode ?? '-'}</Link>} />
              <KeyValue label="Status pesanan" value={data.order?.orderStatus ?? '-'} />
              <KeyValue label="Pembayaran" value={<Badge tone={data.order?.paymentStatus === 'paid' ? 'green' : 'amber'}>{paymentStatusLabel[data.order?.paymentStatus ?? 'unpaid'] ?? data.order?.paymentStatus}</Badge>} />
              <KeyValue label="Total" value={formatCurrency(data.order?.totalAmount ?? 0)} />
              <KeyValue label="Jadwal" value={formatDateTime(data.scheduledAt)} />
              {data.order?.reservation?.timeSlot && (
                <KeyValue label="Slot" value={`${data.order.reservation.timeSlot.startTime}–${data.order.reservation.timeSlot.endTime}`} />
              )}
            </dl>
          </Card>
        </div>
      </div>

      <Modal open={modal === 'completed'} onClose={() => setModal(null)} title="Konfirmasi serah terima" size="sm">
        <div className="space-y-4">
          {error && <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
          <Field label="Nama penerima" htmlFor="handover" required hint="Nama orang yang menerima pesanan">
            <Input id="handover" value={handoverRecipient} onChange={(event) => setHandoverRecipient(event.target.value)} placeholder="Contoh: Budi" />
          </Field>
          <Field label="Catatan (opsional)" htmlFor="complete-notes">
            <Textarea id="complete-notes" value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={1000} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setModal(null)}>Batal</Button>
            <Button
              loading={busy}
              disabled={handoverRecipient.trim().length < 2}
              onClick={() => update('completed', { handoverRecipient: handoverRecipient.trim(), notes: notes.trim() || undefined })}
            >
              Konfirmasi selesai
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={modal === 'failed'} onClose={() => setModal(null)} title="Laporkan tugas gagal" size="sm">
        <div className="space-y-4">
          {error && <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
          <Field label="Alasan" htmlFor="failed-notes" required>
            <Textarea id="failed-notes" value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={1000} placeholder="Contoh: pelanggan tidak di tempat" />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setModal(null)}>Batal</Button>
            <Button variant="danger" loading={busy} disabled={notes.trim().length < 3} onClick={() => update('failed', { notes: notes.trim() })}>
              Laporkan gagal
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

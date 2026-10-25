import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Banknote,
  ClipboardList,
  CreditCard,
  MapPin,
  MessageSquarePlus,
  Package,
  RefreshCw,
  Star,
  Truck,
} from 'lucide-react';
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
  Select,
  StatusBadge,
  Textarea,
} from '../../components/ui';
import { KeyValue, Note, OrderProgress, Stars, Timeline } from '../../components/common';
import { useApi } from '../../lib/useApi';
import { api, ApiError } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { useToast } from '../../lib/toast';
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  methodLabel,
  orderStatusLabel,
  paymentStatusLabel,
  taskStatusLabel,
  unitLabel,
} from '../../lib/format';
import type { Order } from '../../lib/types';

const transitions: Record<string, string[]> = {
  pending: ['cancelled'],
  received: ['washing', 'on_hold', 'cancelled'],
  washing: ['drying', 'on_hold'],
  drying: ['ironing', 'on_hold'],
  ironing: ['packaging', 'on_hold'],
  packaging: ['ready', 'on_hold'],
  ready: ['delivering', 'completed', 'on_hold'],
  delivering: ['completed', 'on_hold'],
  on_hold: ['received', 'washing', 'cancelled'],
  completed: [],
  cancelled: [],
};
const staffTargets = ['washing', 'drying', 'ironing', 'packaging', 'ready', 'on_hold'];

interface StaffMember {
  id: string;
  name: string;
  roles: string[];
}

interface NoteRow {
  id: string;
  note: string;
  createdAt: string;
  author: { id: string; name: string };
}

function Section({ title, description, action, children }: { title: string; description?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card className="p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-bold text-ink-950">{title}</h2>
          {description && <p className="mt-1 text-xs text-ink-500">{description}</p>}
        </div>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </Card>
  );
}

export function OrderDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const order = useApi<Order>(id ? `/orders/${id}` : null, [id]);
  const isAdmin = Boolean(user?.roles.includes('admin'));
  const isStaff = Boolean(user?.roles.includes('staff'));
  const isCustomer = Boolean(user?.roles.includes('customer'));
  const notes = useApi<NoteRow[]>(isAdmin && id ? `/admin/orders/${id}/notes` : null, [id]);
  const staffList = useApi<StaffMember[]>(isAdmin ? '/admin/staff' : null);

  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const [receiveOpen, setReceiveOpen] = useState(false);
  const [weight, setWeight] = useState('');
  const [promotionCode, setPromotionCode] = useState('');
  const [receiveNotes, setReceiveNotes] = useState('');
  const [pieceQuantities, setPieceQuantities] = useState<Record<string, number>>({});

  const [statusOpen, setStatusOpen] = useState(false);
  const [targetStatus, setTargetStatus] = useState('');
  const [statusNotes, setStatusNotes] = useState('');

  const [staffId, setStaffId] = useState('');

  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentForm, setPaymentForm] = useState({ amount: '', method: 'cash', referenceCode: '', notes: '' });
  const [idempotencyKey, setIdempotencyKey] = useState('');

  const [taskOpen, setTaskOpen] = useState(false);
  const [taskForm, setTaskForm] = useState({ taskType: 'delivery', scheduledAt: '', notes: '', courierId: '' });

  const [noteText, setNoteText] = useState('');
  const [reviewOpen, setReviewOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');

  const data = order.data;

  useEffect(() => {
    if (data?.assignedStaff) setStaffId(data.assignedStaff.id);
  }, [data?.assignedStaff]);

  useEffect(() => {
    if (!data) return;
    setPaymentForm((current) => ({ ...current, amount: String(data.remainingAmount || '') }));
    setPieceQuantities(
      Object.fromEntries(data.items.filter((item) => item.unit !== 'kg').map((item) => [item.serviceId, item.quantity])),
    );
  }, [data?.id, data?.remainingAmount]);

  const availableStatuses = useMemo(() => {
    if (!data) return [];
    const allowed = transitions[data.orderStatus] ?? [];
    return isStaff ? allowed.filter((status) => staffTargets.includes(status)) : allowed;
  }, [data, isStaff]);

  const staffMembers = (staffList.data ?? []).filter((member) => member.roles.includes('staff'));
  const courierMembers = (staffList.data ?? []).filter((member) => member.roles.includes('courier'));

  const runAction = async (fn: () => Promise<unknown>, success: string) => {
    setSaving(true);
    setActionError(null);
    try {
      await fn();
      toast(success);
      order.refetch();
      if (isAdmin) notes.refetch();
      return true;
    } catch (error) {
      setActionError(error instanceof ApiError ? error.message : 'Terjadi kesalahan');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async () => {
    if (!targetStatus || !data) return;
    const endpoint = isAdmin ? `/admin/orders/${data.id}/status` : `/staff/orders/${data.id}/status`;
    const done = await runAction(
      () => api.patch(endpoint, { status: targetStatus, notes: statusNotes.trim() || undefined }),
      'Status pesanan diperbarui',
    );
    if (done) {
      setStatusOpen(false);
      setStatusNotes('');
      setTargetStatus('');
    }
  };

  const receive = async () => {
    if (!data) return;
    const hasKg = data.items.some((item) => item.unit === 'kg');
    if (hasKg && !weight) {
      setActionError('Berat aktual wajib diisi untuk layanan kiloan');
      return;
    }
    const done = await runAction(
      () =>
        api.post(`/admin/orders/${data.id}/receive`, {
          ...(hasKg ? { actualWeight: Number(weight) } : {}),
          itemQuantities: data.items
            .filter((item) => item.unit !== 'kg')
            .map((item) => ({ serviceId: item.serviceId, quantity: pieceQuantities[item.serviceId] ?? item.quantity })),
          promotionCode: promotionCode.trim() || undefined,
          notes: receiveNotes.trim() || undefined,
        }),
      'Cucian diterima dan tagihan dihitung',
    );
    if (done) {
      setReceiveOpen(false);
      setWeight('');
      setPromotionCode('');
      setReceiveNotes('');
    }
  };

  const assign = async () => {
    if (!data) return;
    await runAction(
      () => api.patch(`/admin/orders/${data.id}/assign`, { staffId: staffId || null }),
      'Penugasan staff diperbarui',
    );
  };

  const openPayment = () => {
    setPaymentForm({ amount: String(data?.remainingAmount || ''), method: 'cash', referenceCode: '', notes: '' });
    setIdempotencyKey(crypto.randomUUID());
    setPaymentOpen(true);
    setActionError(null);
  };

  const recordPayment = async () => {
    if (!data) return;
    const done = await runAction(
      () =>
        api.post(
          `/admin/orders/${data.id}/payments`,
          {
            amount: Number(paymentForm.amount),
            method: paymentForm.method,
            referenceCode: paymentForm.referenceCode.trim() || undefined,
            notes: paymentForm.notes.trim() || undefined,
          },
          { 'Idempotency-Key': idempotencyKey },
        ),
      'Pembayaran dicatat',
    );
    if (done) setPaymentOpen(false);
  };

  const createTask = async () => {
    if (!data) return;
    if (!taskForm.scheduledAt) {
      setActionError('Jadwal tugas wajib diisi');
      return;
    }
    const done = await runAction(
      () =>
        api.post(`/admin/orders/${data.id}/tasks`, {
          taskType: taskForm.taskType,
          scheduledAt: new Date(taskForm.scheduledAt).toISOString(),
          courierId: taskForm.courierId || undefined,
          notes: taskForm.notes.trim() || undefined,
        }),
      'Tugas pengantaran dibuat',
    );
    if (done) {
      setTaskOpen(false);
      setTaskForm({ taskType: 'delivery', scheduledAt: '', notes: '', courierId: '' });
    }
  };

  const addNote = async () => {
    if (!data || noteText.trim().length < 2) return;
    const done = await runAction(
      () => api.post(`/admin/orders/${data.id}/notes`, { note: noteText.trim() }),
      'Catatan ditambahkan',
    );
    if (done) setNoteText('');
  };

  const submitReview = async () => {
    if (!data) return;
    const done = await runAction(
      () => api.post(`/orders/${data.id}/reviews`, { rating, comment: comment.trim() || undefined }),
      'Terima kasih atas ulasan Anda',
    );
    if (done) setReviewOpen(false);
  };

  if (order.loading) return <LoadingState label="Memuat detail pesanan..." />;
  if (order.error || !data) {
    return <ErrorState message={order.error ?? 'Pesanan tidak ditemukan'} onRetry={order.refetch} />;
  }

  const backLink = isAdmin ? '/admin/pesanan' : isStaff ? '/staff' : '/pesanan';
  const hasKg = data.items.some((item) => item.unit === 'kg');
  const isPending = data.orderStatus === 'pending';
  const isTerminal = ['completed', 'cancelled'].includes(data.orderStatus);

  return (
    <div>
      <PageHeader
        eyebrow="Detail pesanan"
        title={data.orderCode}
        description={data.invoiceNumber ? `Invoice ${data.invoiceNumber}` : undefined}
        actions={
          <Link to={backLink}>
            <Button variant="outline" size="sm" icon={<ArrowLeft className="h-4 w-4" />}>Kembali</Button>
          </Link>
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <StatusBadge status={data.orderStatus} label={orderStatusLabel[data.orderStatus] ?? data.orderStatus} />
        <Badge tone={data.paymentStatus === 'paid' ? 'green' : data.paymentStatus === 'partial' ? 'amber' : 'slate'}>
          {paymentStatusLabel[data.paymentStatus] ?? data.paymentStatus}
        </Badge>
        {data.reservation?.pickupType === 'pickup' && <Badge tone="blue"><Truck className="h-3 w-3" /> Pickup</Badge>}
        {isAdmin && isPending && <Badge tone="amber">Perlu diterima & ditimbang</Badge>}
      </div>

      {actionError && (
        <div role="alert" className="mb-5 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          {actionError}
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[1.45fr_0.55fr]">
        <div className="space-y-5">
          {!['cancelled'].includes(data.orderStatus) && (
            <Card className="p-5 sm:p-6">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-ink-400">Progres pengerjaan</p>
              <div className="mt-4">
                <OrderProgress status={data.orderStatus} />
              </div>
              {data.orderStatus === 'on_hold' && <div className="mt-4"><Note tone="warning">Pesanan sedang ditunda. Hubungi admin bila membutuhkan informasi lebih lanjut.</Note></div>}
            </Card>
          )}

          {isAdmin && isPending && (
            <Card className="border-brand-200 bg-brand-50/40 p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-ink-950">Terima & timbang cucian</h2>
                  <p className="mt-1 text-xs leading-relaxed text-ink-500">
                    Berat aktual dan voucher menentukan tagihan final. Harga layanan disalin sebagai snapshot.
                  </p>
                </div>
                <Button onClick={() => setReceiveOpen(true)} icon={<Package className="h-4 w-4" />}>Terima cucian</Button>
              </div>
            </Card>
          )}

          <Section title="Rincian layanan" description="Harga dan kuantitas final setelah penimbangan.">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-ink-100 text-left text-sm">
                <thead>
                  <tr>
                    <th className="pb-2 pr-3 text-[11px] font-bold uppercase tracking-wide text-ink-400">Layanan</th>
                    <th className="pb-2 pr-3 text-right text-[11px] font-bold uppercase tracking-wide text-ink-400">Harga</th>
                    <th className="pb-2 pr-3 text-right text-[11px] font-bold uppercase tracking-wide text-ink-400">Qty</th>
                    <th className="pb-2 text-right text-[11px] font-bold uppercase tracking-wide text-ink-400">Jumlah</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-50">
                  {data.items.map((item) => (
                    <tr key={item.id}>
                      <td className="py-3 pr-3 font-semibold text-ink-900">{item.serviceName}</td>
                      <td className="py-3 pr-3 text-right text-ink-600">{formatCurrency(item.price)}</td>
                      <td className="py-3 pr-3 text-right text-ink-600">{item.quantity} {unitLabel[item.unit] ?? item.unit}</td>
                      <td className="py-3 text-right font-semibold text-ink-900">{formatCurrency(item.lineTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 space-y-2 border-t border-ink-100 pt-4 text-sm">
              <div className="flex justify-between"><span className="text-ink-500">Subtotal</span><span className="font-semibold text-ink-900">{formatCurrency(data.subtotal)}</span></div>
              <div className="flex justify-between"><span className="text-ink-500">Diskon</span><span className="font-semibold text-emerald-700">−{formatCurrency(data.discountAmount)}</span></div>
              <div className="flex justify-between"><span className="text-ink-500">Biaya antar</span><span className="font-semibold text-ink-900">{formatCurrency(data.deliveryFee)}</span></div>
              <div className="flex justify-between border-t border-ink-100 pt-2 text-base"><span className="font-bold text-ink-950">Total tagihan</span><span className="font-extrabold text-brand-800">{formatCurrency(data.totalAmount)}</span></div>
              <div className="flex justify-between"><span className="text-ink-500">Dibayar</span><span className="font-semibold text-ink-900">{formatCurrency(data.paidAmount)}</span></div>
              <div className="flex justify-between"><span className="text-ink-500">Sisa</span><span className="font-semibold text-ink-900">{formatCurrency(data.remainingAmount)}</span></div>
            </div>
          </Section>

          <Section title="Pembayaran" description="Riwayat transaksi pesanan ini.">
            {data.payments.length === 0 ? (
              <p className="text-sm text-ink-500">Belum ada pembayaran tercatat.</p>
            ) : (
              <div className="space-y-2">
                {data.payments.map((payment) => (
                  <div key={payment.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ink-100 px-4 py-3">
                    <div>
                      <p className="text-sm font-bold text-ink-900">{formatCurrency(payment.amount)} · {methodLabel[payment.method] ?? payment.method}</p>
                      <p className="mt-0.5 text-xs text-ink-400">
                        Dicatat {formatDateTime(payment.createdAt)}
                        {payment.paidAt ? ` · Dibayar ${formatDateTime(payment.paidAt)}` : ''}
                      </p>
                      {payment.referenceCode && <p className="mt-0.5 text-xs text-ink-500">Ref: {payment.referenceCode}</p>}
                      {payment.notes && <p className="mt-0.5 text-xs text-ink-500">{payment.notes}</p>}
                    </div>
                    <Badge tone={payment.status === 'paid' ? 'green' : payment.status === 'pending' ? 'amber' : payment.status === 'refunded' ? 'red' : 'slate'}>
                      {payment.status === 'paid' ? 'Lunas' : payment.status === 'pending' ? 'Menunggu verifikasi' : payment.status === 'refunded' ? 'Refund' : 'Gagal'}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
            {isCustomer && (
              <div className="mt-4"><Note>Pembayaran tunai dicatat oleh admin saat Anda membayar di outlet. Untuk transfer bank, admin memverifikasi bukti transfer terlebih dahulu.</Note></div>
            )}
          </Section>

          {data.deliveryTasks.length > 0 && (
            <Section title="Pengantaran" description="Status tugas kurir untuk pesanan ini.">
              <div className="space-y-2">
                {data.deliveryTasks.map((task) => (
                  <div key={task.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ink-100 px-4 py-3">
                    <div>
                      <p className="text-sm font-bold text-ink-900">{task.taskType === 'pickup' ? 'Pickup' : 'Pengantaran'}</p>
                      <p className="mt-0.5 text-xs text-ink-400">
                        {task.courier ? `Kurir: ${task.courier.name}` : 'Belum ditugaskan'}
                        {task.scheduledAt ? ` · ${formatDateTime(task.scheduledAt)}` : ''}
                      </p>
                      {task.handoverRecipient && <p className="mt-0.5 text-xs text-ink-500">Diterima oleh: {task.handoverRecipient}</p>}
                    </div>
                    <Badge tone={task.status === 'completed' ? 'green' : task.status === 'failed' ? 'red' : 'amber'}>
                      {taskStatusLabel[task.status] ?? task.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </Section>
          )}

          <Section title="Timeline status" description="Setiap perubahan dicatat dan tidak dapat dihapus.">
            <Timeline entries={data.timeline} />
          </Section>

          {isAdmin && (
            <Section title="Catatan internal" description="Hanya terlihat oleh admin dan staff yang ditugaskan.">
              <div className="space-y-2">
                {(notes.data ?? []).map((note) => (
                  <div key={note.id} className="rounded-xl bg-ink-50 px-4 py-3">
                    <p className="text-sm text-ink-700">{note.note}</p>
                    <p className="mt-1 text-[11px] text-ink-400">{note.author.name} · {formatDateTime(note.createdAt)}</p>
                  </div>
                ))}
                {!notes.loading && (notes.data ?? []).length === 0 && <p className="text-sm text-ink-500">Belum ada catatan.</p>}
              </div>
              <div className="mt-3 flex gap-2">
                <Input value={noteText} onChange={(event) => setNoteText(event.target.value)} placeholder="Tulis catatan internal..." maxLength={1000} />
                <Button variant="outline" onClick={addNote} loading={saving} disabled={noteText.trim().length < 2}>Tambah</Button>
              </div>
            </Section>
          )}

          {isCustomer && data.orderStatus === 'completed' && (
            <Section title="Ulasan Anda" description="Ulasan hanya dapat diberikan sekali untuk pesanan yang selesai.">
              {data.review ? (
                <div>
                  <Stars value={data.review.rating} />
                  <p className="mt-2 text-sm leading-relaxed text-ink-600">{data.review.comment || 'Tanpa komentar.'}</p>
                </div>
              ) : (
                <Button onClick={() => setReviewOpen(true)} icon={<Star className="h-4 w-4" />}>Beri ulasan</Button>
              )}
            </Section>
          )}

          {isCustomer && (
            <div className="flex flex-wrap gap-2">
              <Link to="/keluhan">
                <Button variant="outline" icon={<MessageSquarePlus className="h-4 w-4" />}>Ajukan keluhan</Button>
              </Link>
              <Link to="/pembayaran">
                <Button variant="ghost" icon={<CreditCard className="h-4 w-4" />}>Riwayat pembayaran</Button>
              </Link>
            </div>
          )}
        </div>

        <div className="space-y-5">
          <Card className="p-5">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-ink-400">Informasi pesanan</p>
            <dl className="mt-2">
              <KeyValue label="Pelanggan" value={data.customer?.name ?? 'Anda'} />
              {data.customer?.phone && <KeyValue label="Telepon" value={data.customer.phone} />}
              <KeyValue label="Dibuat" value={formatDateTime(data.createdAt)} />
              <KeyValue label="Diterima" value={formatDateTime(data.receivedAt)} />
              <KeyValue label="Selesai" value={formatDateTime(data.completedAt)} />
              <KeyValue label="Berat aktual" value={data.actualWeight ? `${data.actualWeight} kg` : '-'} />
              <KeyValue label="Staff" value={data.assignedStaff?.name ?? 'Belum ditugaskan'} />
              {data.reservation && (
                <>
                  <KeyValue label="Reservasi" value={data.reservation.reservationCode} />
                  <KeyValue
                    label="Jadwal"
                    value={`${formatDate(data.reservation.timeSlot.slotDate)} · ${data.reservation.timeSlot.startTime}–${data.reservation.timeSlot.endTime}`}
                  />
                  <KeyValue label="Metode" value={data.reservation.pickupType === 'pickup' ? 'Pickup & delivery' : 'Drop-off'} />
                </>
              )}
            </dl>
            {data.reservation?.address && (
              <div className="mt-3 flex items-start gap-2 rounded-xl bg-sand-50 p-3 text-xs text-ink-600">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand-700" />
                <div>
                  <p className="font-semibold text-ink-800">{data.reservation.address.label || 'Alamat pickup'}</p>
                  <p className="mt-0.5 leading-relaxed">{data.reservation.address.addressText}</p>
                  <p className="mt-1 text-ink-400">{[data.reservation.address.recipientName, data.reservation.address.phone].filter(Boolean).join(' · ')}</p>
                </div>
              </div>
            )}
            {data.notes && <div className="mt-3 rounded-xl border border-ink-100 p-3 text-xs leading-relaxed text-ink-600">Catatan pesanan: {data.notes}</div>}
          </Card>

          {(isAdmin || isStaff) && !isTerminal && (
            <Card className="p-5">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-ink-400">Aksi operasional</p>
              <div className="mt-3 space-y-3">
                {availableStatuses.length > 0 ? (
                  <Button className="w-full" variant="outline" onClick={() => { setStatusOpen(true); setTargetStatus(availableStatuses[0]); setActionError(null); }} icon={<RefreshCw className="h-4 w-4" />}>
                    Ubah status pesanan
                  </Button>
                ) : (
                  <p className="text-xs text-ink-400">Tidak ada transisi status yang tersedia.</p>
                )}

                {isAdmin && (
                  <>
                    <div className="border-t border-ink-100 pt-3">
                      <Field label="Staff penanggung jawab" htmlFor="staff">
                        <Select id="staff" value={staffId} onChange={(event) => setStaffId(event.target.value)}>
                          <option value="">Belum ditugaskan</option>
                          {staffMembers.map((member) => (
                            <option key={member.id} value={member.id}>{member.name}</option>
                          ))}
                        </Select>
                      </Field>
                      <Button size="sm" variant="soft" className="mt-2 w-full" onClick={assign} loading={saving}>
                        Simpan penugasan
                      </Button>
                    </div>
                    {!isPending && (
                      <Button className="w-full" variant="outline" onClick={openPayment} disabled={data.remainingAmount <= 0} icon={<Banknote className="h-4 w-4" />}>
                        Catat pembayaran
                      </Button>
                    )}
                    <Button className="w-full" variant="outline" onClick={() => { setTaskOpen(true); setActionError(null); }} icon={<Truck className="h-4 w-4" />}>
                      Buat tugas antar
                    </Button>
                  </>
                )}
              </div>
            </Card>
          )}

          {isAdmin && isPending && (
            <Card className="p-5">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-ink-400">Langkah berikutnya</p>
              <p className="mt-2 text-sm leading-relaxed text-ink-500">
                Terima cucian dan masukkan berat aktual agar tagihan final dapat dihitung sebelum pembayaran.
              </p>
              <Button className="mt-3 w-full" onClick={() => setReceiveOpen(true)}>Terima & timbang</Button>
            </Card>
          )}

          {isCustomer && data.orderStatus === 'completed' && !data.review && (
            <Card className="bg-sand-100 p-5">
              <p className="text-sm font-bold text-ink-900">Bagaimana layanan kami?</p>
              <p className="mt-1 text-xs leading-relaxed text-ink-500">Ulasan Anda membantu kami meningkatkan kualitas.</p>
              <Button size="sm" className="mt-3" onClick={() => setReviewOpen(true)}>Beri ulasan</Button>
            </Card>
          )}
        </div>
      </div>

      <Modal open={receiveOpen} onClose={() => setReceiveOpen(false)} title="Terima & timbang cucian" description="Tagihan final dihitung dari berat dan voucher.">
        <div className="space-y-4">
          {hasKg && (
            <Field label="Berat aktual (kg)" htmlFor="weight" hint="Pembulatan dan minimum berat diterapkan otomatis" required>
              <Input id="weight" type="number" min="0.1" step="0.1" value={weight} onChange={(event) => setWeight(event.target.value)} placeholder="Contoh: 4.5" />
            </Field>
          )}
          {data.items.filter((item) => item.unit !== 'kg').length > 0 && (
            <div>
              <p className="text-sm font-semibold text-ink-800">Jumlah item</p>
              <div className="mt-2 space-y-2">
                {data.items.filter((item) => item.unit !== 'kg').map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-3 rounded-xl border border-ink-100 px-3 py-2">
                    <div>
                      <p className="text-sm font-semibold text-ink-900">{item.serviceName}</p>
                      <p className="text-xs text-ink-400">{formatCurrency(item.price)} / {unitLabel[item.unit]}</p>
                    </div>
                    <Input
                      type="number"
                      min="1"
                      className="w-24"
                      value={pieceQuantities[item.serviceId] ?? item.quantity}
                      onChange={(event) => setPieceQuantities((current) => ({ ...current, [item.serviceId]: Number(event.target.value) }))}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
          <Field label="Kode voucher" htmlFor="promotion" hint="Opsional. Voucher divalidasi secara transaksional.">
            <Input id="promotion" value={promotionCode} onChange={(event) => setPromotionCode(event.target.value.toUpperCase())} placeholder="Contoh: HEMAT10" />
          </Field>
          <Field label="Catatan penerimaan" htmlFor="receiveNotes">
            <Textarea id="receiveNotes" value={receiveNotes} onChange={(event) => setReceiveNotes(event.target.value)} placeholder="Kondisi cucian, jumlah item, atau catatan lain" />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setReceiveOpen(false)}>Batal</Button>
            <Button onClick={receive} loading={saving}>Simpan & hitung tagihan</Button>
          </div>
        </div>
      </Modal>

      <Modal open={statusOpen} onClose={() => setStatusOpen(false)} title="Ubah status pesanan" description={orderStatusLabel[data.orderStatus]} size="sm">
        <div className="space-y-4">
          <Field label="Status baru" htmlFor="status" required>
            <Select id="status" value={targetStatus} onChange={(event) => setTargetStatus(event.target.value)}>
              {availableStatuses.map((status) => (
                <option key={status} value={status}>{orderStatusLabel[status] ?? status}</option>
              ))}
            </Select>
          </Field>
          <Field label="Catatan" htmlFor="statusNotes" hint="Akan tampil di timeline pelanggan">
            <Textarea id="statusNotes" value={statusNotes} onChange={(event) => setStatusNotes(event.target.value)} placeholder="Opsional" />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setStatusOpen(false)}>Batal</Button>
            <Button onClick={changeStatus} loading={saving}>Perbarui status</Button>
          </div>
        </div>
      </Modal>

      <Modal open={paymentOpen} onClose={() => setPaymentOpen(false)} title="Catat pembayaran" description="Pembayaran tunai langsung lunas; transfer menunggu verifikasi.">
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Jumlah" htmlFor="amount" required>
              <Input id="amount" type="number" min="1" value={paymentForm.amount} onChange={(event) => setPaymentForm({ ...paymentForm, amount: event.target.value })} />
            </Field>
            <Field label="Metode" htmlFor="method" required>
              <Select id="method" value={paymentForm.method} onChange={(event) => setPaymentForm({ ...paymentForm, method: event.target.value })}>
                <option value="cash">Tunai</option>
                <option value="bank_transfer">Transfer bank</option>
              </Select>
            </Field>
          </div>
          {paymentForm.method === 'bank_transfer' && (
            <Field label="Nomor referensi" htmlFor="reference" required>
              <Input id="reference" value={paymentForm.referenceCode} onChange={(event) => setPaymentForm({ ...paymentForm, referenceCode: event.target.value })} placeholder="Nomor referensi transfer" />
            </Field>
          )}
          <Field label="Catatan" htmlFor="paymentNotes">
            <Input id="paymentNotes" value={paymentForm.notes} onChange={(event) => setPaymentForm({ ...paymentForm, notes: event.target.value })} placeholder="Opsional" />
          </Field>
          <div className="rounded-xl bg-ink-50 px-4 py-3 text-xs text-ink-500">
            Sisa tagihan saat ini <span className="font-bold text-ink-900">{formatCurrency(data.remainingAmount)}</span>. Idempotency key dibuat unik untuk transaksi ini.
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setPaymentOpen(false)}>Batal</Button>
            <Button onClick={recordPayment} loading={saving}>Simpan pembayaran</Button>
          </div>
        </div>
      </Modal>

      <Modal open={taskOpen} onClose={() => setTaskOpen(false)} title="Buat tugas pengantaran" description="Tugas dapat ditugaskan ke kurir sekarang atau nanti.">
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Jenis tugas" htmlFor="taskType" required>
              <Select id="taskType" value={taskForm.taskType} onChange={(event) => setTaskForm({ ...taskForm, taskType: event.target.value })}>
                <option value="delivery">Pengantaran</option>
                <option value="pickup">Pickup</option>
              </Select>
            </Field>
            <Field label="Jadwal" htmlFor="scheduled" required>
              <Input id="scheduled" type="datetime-local" value={taskForm.scheduledAt} onChange={(event) => setTaskForm({ ...taskForm, scheduledAt: event.target.value })} />
            </Field>
          </div>
          <Field label="Kurir" htmlFor="courier" hint="Opsional">
            <Select id="courier" value={taskForm.courierId} onChange={(event) => setTaskForm({ ...taskForm, courierId: event.target.value })}>
              <option value="">Belum ditugaskan</option>
              {courierMembers.map((member) => (
                <option key={member.id} value={member.id}>{member.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Catatan" htmlFor="taskNotes">
            <Textarea id="taskNotes" value={taskForm.notes} onChange={(event) => setTaskForm({ ...taskForm, notes: event.target.value })} placeholder="Instruksi untuk kurir" />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setTaskOpen(false)}>Batal</Button>
            <Button onClick={createTask} loading={saving}>Buat tugas</Button>
          </div>
        </div>
      </Modal>

      <Modal open={reviewOpen} onClose={() => setReviewOpen(false)} title="Beri ulasan" description={data.orderCode} size="sm">
        <div className="space-y-4">
          <div>
            <p className="text-sm font-semibold text-ink-800">Rating</p>
            <div className="mt-2"><Stars value={rating} onChange={setRating} size="lg" /></div>
          </div>
          <Field label="Komentar" htmlFor="comment" hint="Opsional, maksimal 1000 karakter">
            <Textarea id="comment" value={comment} onChange={(event) => setComment(event.target.value)} maxLength={1000} placeholder="Ceritakan pengalaman Anda..." />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setReviewOpen(false)}>Batal</Button>
            <Button onClick={submitReview} loading={saving}>Kirim ulasan</Button>
          </div>
        </div>
      </Modal>

      <div className="mt-6 flex items-center gap-2 text-xs text-ink-400">
        <ClipboardList className="h-4 w-4" />
        Semua aksi tercatat pada audit log. Halaman ini menampilkan data langsung dari API.
        {isAdmin && (
          <Button size="sm" variant="ghost" onClick={() => { order.refetch(); notes.refetch(); }} icon={<RefreshCw className="h-3.5 w-3.5" />}>Muat ulang</Button>
        )}
      </div>
    </div>
  );
}

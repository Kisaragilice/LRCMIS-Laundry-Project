import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, MessageSquare, Plus } from 'lucide-react';
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
  StatusBadge,
  Textarea,
} from '../../components/ui';
import { Note } from '../../components/common';
import { useApi } from '../../lib/useApi';
import { api, ApiError } from '../../lib/api';
import { useToast } from '../../lib/toast';
import { complaintStatusLabel, formatDateTime } from '../../lib/format';
import type { Complaint, Order } from '../../lib/types';

export function ComplaintsPage() {
  const { toast } = useToast();
  const complaints = useApi<Complaint[]>('/complaints/me');
  const orders = useApi<Order[]>('/orders/me');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ orderId: '', subject: '', description: '', priority: 'normal' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      await api.post('/complaints', {
        orderId: form.orderId || undefined,
        subject: form.subject.trim(),
        description: form.description.trim(),
        priority: form.priority,
      });
      toast('Keluhan berhasil dikirim');
      setOpen(false);
      setForm({ orderId: '', subject: '', description: '', priority: 'normal' });
      complaints.refetch();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal mengirim keluhan');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow="Layanan pelanggan"
        title="Keluhan saya"
        description="Sampaikan kendala terkait pesanan. Tim akan menindaklanjuti dan mencatat penyelesaiannya."
        actions={<Button onClick={() => { setOpen(true); setError(null); }} icon={<Plus className="h-4 w-4" />}>Buat keluhan</Button>}
      />

      {complaints.loading ? (
        <LoadingState label="Memuat keluhan..." />
      ) : complaints.error ? (
        <ErrorState message={complaints.error} onRetry={complaints.refetch} />
      ) : (complaints.data ?? []).length === 0 ? (
        <EmptyState
          title="Belum ada keluhan"
          description="Jika ada kendala pada pesanan, Anda dapat membuat keluhan dari halaman ini."
          icon={<MessageSquare className="h-6 w-6" />}
          action={<Button size="sm" onClick={() => setOpen(true)}>Buat keluhan</Button>}
        />
      ) : (
        <div className="space-y-4">
          {(complaints.data ?? []).map((complaint) => (
            <Card key={complaint.id} className="p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-bold text-ink-400">{complaint.code}</span>
                    <StatusBadge status={complaint.status} label={complaintStatusLabel[complaint.status] ?? complaint.status} />
                    <Badge tone={complaint.priority === 'high' ? 'red' : complaint.priority === 'low' ? 'slate' : 'amber'}>
                      Prioritas {complaint.priority}
                    </Badge>
                  </div>
                  <h2 className="mt-2 text-base font-bold text-ink-950">{complaint.subject}</h2>
                  <p className="mt-1 text-xs text-ink-400">Dibuat {formatDateTime(complaint.createdAt)}</p>
                </div>
                {complaint.order && (
                  <Link to={`/pesanan/${complaint.order.id}`} className="inline-flex items-center gap-1 text-xs font-bold text-brand-700 hover:text-brand-900">
                    {complaint.order.orderCode} <ArrowRight className="h-3 w-3" />
                  </Link>
                )}
              </div>
              <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-ink-600">{complaint.description}</p>

              {complaint.resolution && (
                <div className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                  <p className="text-xs font-bold uppercase tracking-wide">Resolusi</p>
                  <p className="mt-1 leading-relaxed">{complaint.resolution}</p>
                </div>
              )}

              {(complaint.followUps ?? []).length > 0 && (
                <div className="mt-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-ink-400">Tindak lanjut</p>
                  <div className="mt-2 space-y-2">
                    {(complaint.followUps ?? []).map((followUp) => (
                      <div key={followUp.id} className="rounded-xl bg-ink-50 px-4 py-3">
                        <p className="text-sm text-ink-700">{followUp.note}</p>
                        <p className="mt-1 text-[11px] text-ink-400">{followUp.user.name} · {formatDateTime(followUp.createdAt)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      <div className="mt-6"><Note>Untuk kendala mendesak, hubungi outlet langsung. Keluhan melalui sistem tetap disarankan agar riwayat penanganan tercatat.</Note></div>

      <Modal open={open} onClose={() => setOpen(false)} title="Buat keluhan" description="Jelaskan kendala sedetail mungkin agar tim dapat membantu.">
        <div className="space-y-4">
          {error && <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
          <Field label="Terkait pesanan" htmlFor="complaintOrder" hint="Opsional">
            <Select id="complaintOrder" value={form.orderId} onChange={(event) => setForm({ ...form, orderId: event.target.value })}>
              <option value="">Tidak terkait pesanan tertentu</option>
              {(orders.data ?? []).map((order) => (
                <option key={order.id} value={order.id}>{order.orderCode} — {order.items.map((item) => item.serviceName).join(', ')}</option>
              ))}
            </Select>
          </Field>
          <Field label="Subjek" htmlFor="subject" required>
            <Input id="subject" value={form.subject} onChange={(event) => setForm({ ...form, subject: event.target.value })} maxLength={150} placeholder="Ringkasan kendala" />
          </Field>
          <Field label="Deskripsi" htmlFor="description" hint="Minimal 10 karakter" required>
            <Textarea id="description" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} maxLength={2000} placeholder="Jelaskan apa yang terjadi, kapan, dan dampaknya..." />
          </Field>
          <Field label="Prioritas" htmlFor="priority">
            <Select id="priority" value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })}>
              <option value="low">Rendah</option>
              <option value="normal">Normal</option>
              <option value="high">Tinggi</option>
            </Select>
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Batal</Button>
            <Button
              onClick={submit}
              loading={saving}
              disabled={form.subject.trim().length < 3 || form.description.trim().length < 10}
            >
              Kirim keluhan
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

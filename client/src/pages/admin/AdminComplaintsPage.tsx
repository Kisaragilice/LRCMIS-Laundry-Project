import { useState } from 'react';
import { Link } from 'react-router-dom';
import { MessageSquare, Send } from 'lucide-react';
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
  Pagination,
  Select,
  Textarea,
} from '../../components/ui';
import { DataTable, Td, Th } from '../../components/common';
import { usePagedApi } from '../../lib/useApi';
import { api, ApiError } from '../../lib/api';
import { useToast } from '../../lib/toast';
import { complaintStatusLabel, formatDateTime } from '../../lib/format';
import type { Complaint } from '../../lib/types';

const priorityTone = (priority: string): 'red' | 'amber' | 'slate' =>
  priority === 'high' ? 'red' : priority === 'normal' ? 'amber' : 'slate';

export function AdminComplaintsPage() {
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const query = new URLSearchParams({ page: String(page), limit: '10' });
  if (status) query.set('status', status);
  const complaints = usePagedApi<Complaint>(`/admin/complaints?${query.toString()}`, [page, status]);

  const [selected, setSelected] = useState<Complaint | null>(null);
  const [form, setForm] = useState({ status: 'open', priority: 'normal', resolution: '' });
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openDetail = (complaint: Complaint) => {
    setSelected(complaint);
    setForm({ status: complaint.status, priority: complaint.priority, resolution: complaint.resolution ?? '' });
    setNote('');
    setError(null);
  };

  const save = async () => {
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await api.patch<Complaint>(`/admin/complaints/${selected.id}`, {
        status: form.status,
        priority: form.priority,
        resolution: form.resolution.trim() || null,
      });
      setSelected({ ...selected, ...updated });
      toast('Keluhan diperbarui');
      complaints.refetch();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal memperbarui keluhan');
    } finally {
      setBusy(false);
    }
  };

  const addFollowUp = async () => {
    if (!selected || note.trim().length < 2) return;
    setBusy(true);
    setError(null);
    try {
      await api.post(`/admin/complaints/${selected.id}/follow-ups`, { note: note.trim() });
      toast('Tindak lanjut ditambahkan');
      setNote('');
      const refreshed = await api.get<Complaint[]>(`/admin/complaints?page=${page}&limit=10${status ? `&status=${status}` : ''}`);
      const found = refreshed.find((row) => row.id === selected.id);
      if (found) setSelected(found);
      complaints.refetch();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal menambahkan tindak lanjut');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow="Layanan pelanggan"
        title="Keluhan"
        description="Tindak lanjuti keluhan pelanggan, ubah prioritas, dan catat resolusi."
      />

      <Card className="mb-5 flex flex-wrap items-end gap-3 p-4">
        <Field label="Status" className="w-full sm:w-56">
          <Select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}>
            <option value="">Semua status</option>
            {Object.entries(complaintStatusLabel).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </Select>
        </Field>
      </Card>

      {complaints.loading ? (
        <LoadingState label="Memuat keluhan..." />
      ) : complaints.error ? (
        <ErrorState message={complaints.error} onRetry={complaints.refetch} />
      ) : complaints.rows.length === 0 ? (
        <EmptyState title="Tidak ada keluhan" description="Semua keluhan pada filter ini sudah tertangani." icon={<MessageSquare className="h-6 w-6" />} />
      ) : (
        <>
          <DataTable>
            <thead>
              <tr>
                <Th>Keluhan</Th>
                <Th>Pelanggan</Th>
                <Th>Pesanan</Th>
                <Th>Prioritas</Th>
                <Th>Status</Th>
                <Th>Dibuat</Th>
                <Th>Aksi</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-50">
              {complaints.rows.map((complaint) => (
                <tr key={complaint.id} className="hover:bg-sand-50/50">
                  <Td>
                    <p className="font-mono text-[11px] font-semibold text-ink-400">{complaint.code}</p>
                    <p className="font-semibold text-ink-900">{complaint.subject}</p>
                    <p className="mt-0.5 line-clamp-1 max-w-xs text-xs text-ink-500">{complaint.description}</p>
                  </Td>
                  <Td>
                    <p className="text-sm font-medium">{complaint.customer?.name ?? '-'}</p>
                    <p className="text-[11px] text-ink-400">{complaint.customer?.email}</p>
                  </Td>
                  <Td>
                    {complaint.order ? (
                      <Link to={`/admin/pesanan/${complaint.order.id}`} className="text-xs font-bold text-brand-700 hover:text-brand-900">
                        {complaint.order.orderCode}
                      </Link>
                    ) : (
                      <span className="text-xs text-ink-400">-</span>
                    )}
                  </Td>
                  <Td><Badge tone={priorityTone(complaint.priority)}>{complaint.priority}</Badge></Td>
                  <Td>
                    <Badge tone={complaint.status === 'resolved' ? 'green' : complaint.status === 'open' ? 'amber' : complaint.status === 'closed' ? 'slate' : 'blue'}>
                      {complaintStatusLabel[complaint.status]}
                    </Badge>
                  </Td>
                  <Td><span className="text-xs text-ink-500">{formatDateTime(complaint.createdAt)}</span></Td>
                  <Td><Button size="sm" variant="outline" onClick={() => openDetail(complaint)}>Tangani</Button></Td>
                </tr>
              ))}
            </tbody>
          </DataTable>
          <div className="mt-4">
            <Pagination page={page} totalPages={complaints.meta?.totalPages ?? 1} total={complaints.meta?.total} onChange={setPage} />
          </div>
        </>
      )}

      <Modal open={Boolean(selected)} onClose={() => setSelected(null)} title={selected?.subject ?? 'Keluhan'} description={selected?.code} size="lg">
        {selected && (
          <div className="space-y-5">
            {error && <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

            <div className="rounded-xl bg-ink-50 px-4 py-3 text-sm text-ink-700">{selected.description}</div>

            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Status" htmlFor="complaint-status">
                <Select id="complaint-status" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
                  {Object.entries(complaintStatusLabel).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Prioritas" htmlFor="complaint-priority">
                <Select id="complaint-priority" value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })}>
                  <option value="low">Rendah</option>
                  <option value="normal">Normal</option>
                  <option value="high">Tinggi</option>
                </Select>
              </Field>
              <Field label="Pelanggan">
                <InputReadOnly value={`${selected.customer?.name ?? '-'} · ${selected.customer?.email ?? ''}`} />
              </Field>
            </div>

            <Field label="Resolusi" htmlFor="complaint-resolution" hint="Wajib ketika status diubah menjadi Selesai">
              <Textarea id="complaint-resolution" value={form.resolution} onChange={(event) => setForm({ ...form, resolution: event.target.value })} maxLength={2000} placeholder="Tindakan yang dilakukan..." />
            </Field>
            <div className="flex justify-end">
              <Button onClick={save} loading={busy}>Simpan perubahan</Button>
            </div>

            <div className="border-t border-ink-100 pt-4">
              <h3 className="mb-3 text-sm font-bold text-ink-900">Riwayat tindak lanjut</h3>
              {(selected.followUps ?? []).length === 0 ? (
                <p className="text-sm text-ink-400">Belum ada tindak lanjut.</p>
              ) : (
                <ol className="space-y-2">
                  {(selected.followUps ?? []).map((followUp) => (
                    <li key={followUp.id} className="rounded-xl border border-ink-100 px-3 py-2">
                      <p className="text-sm text-ink-700">{followUp.note}</p>
                      <p className="mt-1 text-[11px] text-ink-400">{followUp.user?.name} · {formatDateTime(followUp.createdAt)}</p>
                    </li>
                  ))}
                </ol>
              )}
              <div className="mt-3 flex items-end gap-2">
                <Field label="Tambah tindak lanjut" className="flex-1">
                  <Textarea value={note} onChange={(event) => setNote(event.target.value)} rows={2} maxLength={1000} placeholder="Catatan untuk pelanggan..." />
                </Field>
                <Button onClick={addFollowUp} loading={busy} disabled={note.trim().length < 2} icon={<Send className="h-4 w-4" />}>Kirim</Button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function InputReadOnly({ value }: { value: string }) {
  return <div className="rounded-xl border border-ink-100 bg-ink-50 px-3.5 py-2.5 text-sm text-ink-500">{value}</div>;
}

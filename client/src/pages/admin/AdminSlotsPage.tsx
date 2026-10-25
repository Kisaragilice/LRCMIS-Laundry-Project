import { useState } from 'react';
import { CalendarDays, Clock, Plus, Trash2 } from 'lucide-react';
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
} from '../../components/ui';
import { DataTable, Td, Th } from '../../components/common';
import { useApi } from '../../lib/useApi';
import { api, ApiError } from '../../lib/api';
import { useToast } from '../../lib/toast';
import { addDaysIso, formatDate, todayIso, weekday } from '../../lib/format';
import type { TimeSlot } from '../../lib/types';

export function AdminSlotsPage() {
  const { toast } = useToast();
  const [from, setFrom] = useState(todayIso());
  const [to, setTo] = useState(addDaysIso(14));
  const query = new URLSearchParams();
  if (from) query.set('from', from);
  if (to) query.set('to', to);
  const slots = useApi<TimeSlot[]>(`/admin/time-slots?${query.toString()}`, [from, to]);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ slotDate: todayIso(), startTime: '08:00', endTime: '10:00', capacity: '10' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<TimeSlot | null>(null);
  const [editing, setEditing] = useState<TimeSlot | null>(null);
  const [editCapacity, setEditCapacity] = useState('');

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.post('/admin/time-slots', {
        slotDate: form.slotDate,
        startTime: form.startTime,
        endTime: form.endTime,
        capacity: Number(form.capacity),
      });
      toast('Slot waktu dibuat');
      setOpen(false);
      slots.refetch();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal membuat slot');
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (slot: TimeSlot) => {
    try {
      await api.patch(`/admin/time-slots/${slot.id}`, { isAvailable: !slot.rawAvailable });
      toast(slot.rawAvailable ? 'Slot dinonaktifkan' : 'Slot diaktifkan');
      slots.refetch();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Gagal mengubah slot', 'error');
    }
  };

  const saveCapacity = async () => {
    if (!editing) return;
    setBusy(true);
    try {
      await api.patch(`/admin/time-slots/${editing.id}`, { capacity: Number(editCapacity) });
      toast('Kapasitas diperbarui');
      setEditing(null);
      slots.refetch();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Gagal memperbarui kapasitas', 'error');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!confirmDelete) return;
    setBusy(true);
    try {
      await api.delete(`/admin/time-slots/${confirmDelete.id}`);
      toast('Slot dihapus');
      setConfirmDelete(null);
      slots.refetch();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Gagal menghapus slot', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow="Kapasitas"
        title="Slot waktu"
        description="Atur kapasitas jemput/antar per rentang waktu. Kapasitas dijaga secara transaksional saat reservasi."
        actions={
          <Button icon={<Plus className="h-4 w-4" />} onClick={() => { setError(null); setOpen(true); }}>
            Tambah slot
          </Button>
        }
      />

      <Card className="mb-5 flex flex-wrap items-end gap-3 p-4">
        <Field label="Dari tanggal" className="w-full sm:w-48">
          <Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
        </Field>
        <Field label="Sampai tanggal" className="w-full sm:w-48">
          <Input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
        </Field>
      </Card>

      {slots.loading ? (
        <LoadingState label="Memuat slot..." />
      ) : slots.error ? (
        <ErrorState message={slots.error} onRetry={slots.refetch} />
      ) : (slots.data ?? []).length === 0 ? (
        <EmptyState
          title="Tidak ada slot pada rentang ini"
          description="Buat slot agar pelanggan dapat memilih jadwal."
          icon={<CalendarDays className="h-6 w-6" />}
          action={<Button onClick={() => setOpen(true)}>Tambah slot</Button>}
        />
      ) : (
        <DataTable>
          <thead>
            <tr>
              <Th>Tanggal</Th>
              <Th>Waktu</Th>
              <Th>Kapasitas</Th>
              <Th>Terisi</Th>
              <Th>Status</Th>
              <Th>Aksi</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-50">
            {(slots.data ?? []).map((slot) => (
              <tr key={slot.id} className="hover:bg-sand-50/50">
                <Td>
                  <p className="font-semibold text-ink-900">{formatDate(`${slot.slotDate}T12:00:00+07:00`)}</p>
                  <p className="text-[11px] capitalize text-ink-400">{weekday(slot.slotDate)}</p>
                </Td>
                <Td>
                  <span className="inline-flex items-center gap-1.5 font-semibold">
                    <Clock className="h-3.5 w-3.5 text-ink-400" /> {slot.startTime} – {slot.endTime}
                  </span>
                </Td>
                <Td>{slot.capacity}</Td>
                <Td>
                  <span className={slot.remaining === 0 ? 'font-semibold text-red-600' : 'text-ink-700'}>
                    {slot.reserved} / {slot.capacity}
                  </span>
                  <p className="text-[11px] text-ink-400">Sisa {slot.remaining}</p>
                </Td>
                <Td>
                  <Badge tone={!slot.rawAvailable ? 'slate' : slot.remaining === 0 ? 'red' : 'green'}>
                    {!slot.rawAvailable ? 'Nonaktif' : slot.remaining === 0 ? 'Penuh' : 'Tersedia'}
                  </Badge>
                </Td>
                <Td>
                  <div className="flex flex-wrap gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => { setEditing(slot); setEditCapacity(String(slot.capacity)); }}
                    >
                      Kapasitas
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => toggle(slot)}>
                      {slot.rawAvailable ? 'Nonaktifkan' : 'Aktifkan'}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-600"
                      icon={<Trash2 className="h-3.5 w-3.5" />}
                      onClick={() => setConfirmDelete(slot)}
                      disabled={slot.reserved > 0}
                    >
                      Hapus
                    </Button>
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Tambah slot waktu" size="md">
        <div className="space-y-4">
          {error && <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Tanggal" htmlFor="slot-date" required>
              <Input id="slot-date" type="date" value={form.slotDate} onChange={(event) => setForm({ ...form, slotDate: event.target.value })} />
            </Field>
            <Field label="Kapasitas" htmlFor="slot-capacity" required>
              <Input id="slot-capacity" type="number" min="0" value={form.capacity} onChange={(event) => setForm({ ...form, capacity: event.target.value })} />
            </Field>
            <Field label="Waktu mulai" htmlFor="slot-start" required>
              <Input id="slot-start" type="time" value={form.startTime} onChange={(event) => setForm({ ...form, startTime: event.target.value })} />
            </Field>
            <Field label="Waktu selesai" htmlFor="slot-end" required>
              <Input id="slot-end" type="time" value={form.endTime} onChange={(event) => setForm({ ...form, endTime: event.target.value })} />
            </Field>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Batal</Button>
            <Button onClick={create} loading={busy}>Simpan</Button>
          </div>
        </div>
      </Modal>

      <Modal open={Boolean(editing)} onClose={() => setEditing(null)} title="Ubah kapasitas" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-ink-600">
            Slot {editing && formatDate(`${editing.slotDate}T12:00:00+07:00`)} pukul {editing?.startTime}–{editing?.endTime}. Saat ini {editing?.reserved} reservasi aktif.
          </p>
          <Field label="Kapasitas baru" htmlFor="edit-capacity" required>
            <Input id="edit-capacity" type="number" min={editing?.reserved ?? 0} value={editCapacity} onChange={(event) => setEditCapacity(event.target.value)} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setEditing(null)}>Batal</Button>
            <Button onClick={saveCapacity} loading={busy} disabled={Number(editCapacity) < (editing?.reserved ?? 0)}>Simpan</Button>
          </div>
        </div>
      </Modal>

      <Modal open={Boolean(confirmDelete)} onClose={() => setConfirmDelete(null)} title="Hapus slot?" size="sm">
        <p className="text-sm text-ink-600">Slot tanpa reservasi akan dihapus permanen.</p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setConfirmDelete(null)}>Batal</Button>
          <Button variant="danger" loading={busy} onClick={remove}>Hapus</Button>
        </div>
      </Modal>
    </div>
  );
}

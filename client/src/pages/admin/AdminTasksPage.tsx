import { useState } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Phone, Truck, UserRound } from 'lucide-react';
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
} from '../../components/ui';
import { DataTable, Td, Th } from '../../components/common';
import { usePagedApi, useApi } from '../../lib/useApi';
import { api, ApiError } from '../../lib/api';
import { useToast } from '../../lib/toast';
import { formatDateTime, orderStatusLabel, taskStatusLabel, taskTypeLabel } from '../../lib/format';
import type { DeliveryTask } from '../../lib/types';

interface StaffMember {
  id: string;
  name: string;
  roles: string[];
}

export function AdminTasksPage() {
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const query = new URLSearchParams({ page: String(page), limit: '10' });
  if (status) query.set('status', status);

  const tasks = usePagedApi<DeliveryTask>(`/admin/delivery-tasks?${query.toString()}`, [page, status]);
  const staff = useApi<StaffMember[]>('/admin/staff');
  const couriers = (staff.data ?? []).filter((member) => member.roles.includes('courier'));

  const [target, setTarget] = useState<DeliveryTask | null>(null);
  const [courierId, setCourierId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const assign = async () => {
    if (!target) return;
    setBusy(true);
    setError(null);
    try {
      await api.patch(`/admin/delivery-tasks/${target.id}/assign`, { courierId: courierId || null });
      toast('Kurir diperbarui');
      setTarget(null);
      tasks.refetch();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal menugaskan kurir');
    } finally {
      setBusy(false);
    }
  };

  const renderAssign = (task: DeliveryTask) => (
    <Button
      size="sm"
      variant="outline"
      onClick={() => {
        setTarget(task);
        setCourierId(task.courier?.id ?? '');
        setError(null);
      }}
    >
      {task.courier ? 'Ganti kurir' : 'Tugaskan'}
    </Button>
  );

  return (
    <div>
      <PageHeader
        eyebrow="Logistik"
        title="Tugas antar-jemput"
        description="Pantau tugas pickup dan pengantaran. Tugas baru dibuat dari detail pesanan."
      />

      <Card className="mb-5 flex flex-wrap items-end gap-3 p-4">
        <Field label="Status tugas" className="w-full sm:w-56">
          <Select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}>
            <option value="">Semua status</option>
            <option value="assigned">Ditugaskan</option>
            <option value="accepted">Diterima kurir</option>
            <option value="in_progress">Dalam perjalanan</option>
            <option value="completed">Selesai</option>
            <option value="failed">Gagal</option>
          </Select>
        </Field>
      </Card>

      {tasks.loading ? (
        <LoadingState label="Memuat tugas..." />
      ) : tasks.error ? (
        <ErrorState message={tasks.error} onRetry={tasks.refetch} />
      ) : tasks.rows.length === 0 ? (
        <EmptyState title="Belum ada tugas" description="Buat tugas dari detail pesanan untuk memulai pengantaran." icon={<Truck className="h-6 w-6" />} />
      ) : (
        <>
          <div className="space-y-3 md:hidden">
            {tasks.rows.map((task) => (
              <Card key={task.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={task.taskType === 'delivery' ? 'brand' : 'blue'}>
                      {taskTypeLabel[task.taskType]}
                    </Badge>
                    <Badge
                      tone={
                        task.status === 'completed'
                          ? 'green'
                          : task.status === 'failed'
                            ? 'red'
                            : task.status === 'in_progress'
                              ? 'amber'
                              : 'slate'
                      }
                    >
                      {taskStatusLabel[task.status] ?? task.status}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-ink-400">{formatDateTime(task.scheduledAt)}</p>
                </div>
                <div className="mt-2">
                  <Link
                    to={`/admin/pesanan/${task.orderId}`}
                    className="whitespace-nowrap font-bold text-brand-700 hover:text-brand-900"
                  >
                    {task.order?.orderCode}
                  </Link>
                  <p className="text-xs text-ink-500">{task.order?.customer?.name}</p>
                  <p className="text-[11px] text-ink-400">
                    {orderStatusLabel[task.order?.orderStatus ?? ''] ?? task.order?.orderStatus}
                  </p>
                </div>
                <div className="mt-3 rounded-xl bg-sand-50 px-3 py-2.5 text-xs text-ink-600">
                  <p className="line-clamp-2">{task.addressSnapshot || task.order?.address?.addressText || '-'}</p>
                  {task.contactPhone && (
                    <p className="mt-1 inline-flex items-center gap-1 text-[11px] text-ink-400">
                      <Phone className="h-3 w-3" aria-hidden="true" /> {task.contactPhone}
                    </p>
                  )}
                </div>
                <div className="mt-3 flex items-center justify-between gap-3">
                  {task.courier ? (
                    <span className="inline-flex items-center gap-1.5 text-sm text-ink-700">
                      <UserRound className="h-3.5 w-3.5" aria-hidden="true" /> {task.courier.name}
                    </span>
                  ) : (
                    <span className="text-xs font-semibold text-amber-700">Belum ditugaskan</span>
                  )}
                  {renderAssign(task)}
                </div>
              </Card>
            ))}
          </div>

          <div className="hidden md:block">
            <DataTable>
              <thead>
                <tr>
                  <Th>Tugas</Th>
                  <Th>Pesanan</Th>
                  <Th>Alamat</Th>
                  <Th>Kurir</Th>
                  <Th>Status</Th>
                  <Th>Aksi</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-50">
                {tasks.rows.map((task) => (
                  <tr key={task.id} className="hover:bg-sand-50/50">
                    <Td>
                      <Badge tone={task.taskType === 'delivery' ? 'brand' : 'blue'}>
                        {taskTypeLabel[task.taskType]}
                      </Badge>
                      <p className="mt-1 text-[11px] text-ink-400">{formatDateTime(task.scheduledAt)}</p>
                      {task.completedAt && (
                        <p className="text-[11px] text-emerald-600">Selesai {formatDateTime(task.completedAt)}</p>
                      )}
                    </Td>
                    <Td>
                      <Link
                        to={`/admin/pesanan/${task.orderId}`}
                        className="whitespace-nowrap font-bold text-brand-700 hover:text-brand-900"
                      >
                        {task.order?.orderCode}
                      </Link>
                      <p className="text-[11px] text-ink-400">{task.order?.customer?.name}</p>
                      <p className="text-[11px] text-ink-400">
                        {orderStatusLabel[task.order?.orderStatus ?? ''] ?? task.order?.orderStatus}
                      </p>
                    </Td>
                    <Td className="max-w-[220px]">
                      <p className="line-clamp-2 text-xs text-ink-600">
                        {task.addressSnapshot || task.order?.address?.addressText || '-'}
                      </p>
                      {task.contactPhone && (
                        <p className="mt-1 inline-flex items-center gap-1 text-[11px] text-ink-400">
                          <Phone className="h-3 w-3" /> {task.contactPhone}
                        </p>
                      )}
                    </Td>
                    <Td>
                      {task.courier ? (
                        <span className="inline-flex items-center gap-1.5 text-sm text-ink-700">
                          <UserRound className="h-3.5 w-3.5" /> {task.courier.name}
                        </span>
                      ) : (
                        <span className="text-xs text-amber-700">Belum ditugaskan</span>
                      )}
                    </Td>
                    <Td>
                      <Badge
                        tone={
                          task.status === 'completed'
                            ? 'green'
                            : task.status === 'failed'
                              ? 'red'
                              : task.status === 'in_progress'
                                ? 'amber'
                                : 'slate'
                        }
                      >
                        {taskStatusLabel[task.status] ?? task.status}
                      </Badge>
                    </Td>
                    <Td>{renderAssign(task)}</Td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          </div>
          <div className="mt-4">
            <Pagination page={page} totalPages={tasks.meta?.totalPages ?? 1} total={tasks.meta?.total} onChange={setPage} />
          </div>
        </>
      )}

      <Modal open={Boolean(target)} onClose={() => setTarget(null)} title="Tugaskan kurir" description={target?.order?.orderCode} size="sm">
        <div className="space-y-4">
          {error && <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
          {target?.addressSnapshot && (
            <div className="flex items-start gap-2 rounded-xl bg-ink-50 px-3 py-2.5 text-xs text-ink-600">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0" /> {target.addressSnapshot}
            </div>
          )}
          <Field label="Kurir" htmlFor="courier" required>
            <Select id="courier" value={courierId} onChange={(event) => setCourierId(event.target.value)}>
              <option value="">Pilih kurir</option>
              {couriers.map((courier) => (
                <option key={courier.id} value={courier.id}>{courier.name}</option>
              ))}
            </Select>
          </Field>
          {couriers.length === 0 && <p className="text-xs text-amber-700">Belum ada akun kurir aktif.</p>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setTarget(null)}>Batal</Button>
            <Button onClick={assign} loading={busy} disabled={!courierId}>Simpan</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

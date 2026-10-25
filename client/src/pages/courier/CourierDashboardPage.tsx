import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  MapPin,
  Navigation,
  Phone,
  Play,
  RefreshCw,
  Search,
  Truck,
  UserRound,
  XCircle,
} from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  LoadingState,
  PageHeader,
  StatCard,
  StatusBadge,
} from '../../components/ui';
import { useApi } from '../../lib/useApi';
import { useAuth } from '../../lib/auth';
import { api, ApiError } from '../../lib/api';
import { useToast } from '../../lib/toast';
import {
  formatCurrency,
  formatDateTime,
  paymentStatusLabel,
  taskStatusLabel,
  taskTypeLabel,
} from '../../lib/format';
import type { DeliveryTask } from '../../lib/types';

type Tab = 'active' | 'completed' | 'failed';

const tabs: Array<{ key: Tab; label: string }> = [
  { key: 'active', label: 'Aktif' },
  { key: 'completed', label: 'Selesai' },
  { key: 'failed', label: 'Gagal' },
];

export function CourierDashboardPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const tasks = useApi<DeliveryTask[]>('/courier/tasks');
  const [tab, setTab] = useState<Tab>('active');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const rows = useMemo(() => tasks.data ?? [], [tasks.data]);
  const active = rows.filter((task) => ['assigned', 'accepted', 'in_progress'].includes(task.status));
  const completed = rows.filter((task) => task.status === 'completed');
  const failed = rows.filter((task) => task.status === 'failed');

  const base = tab === 'active' ? active : tab === 'completed' ? completed : failed;
  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return base;
    return base.filter((task) =>
      `${task.order?.orderCode ?? ''} ${task.order?.customer?.name ?? ''} ${task.addressSnapshot ?? ''}`
        .toLowerCase()
        .includes(term),
    );
  }, [base, query]);

  const selected = filtered.find((task) => task.id === selectedId) ?? filtered[0] ?? null;

  const updateStatus = async (task: DeliveryTask, status: 'accepted' | 'in_progress') => {
    setBusy(true);
    try {
      await api.patch(`/courier/tasks/${task.id}/status`, { status });
      toast(`Status tugas diperbarui: ${taskStatusLabel[status]}`);
      tasks.refetch();
    } catch (error) {
      toast(error instanceof ApiError ? error.message : 'Gagal memperbarui tugas', 'error');
    } finally {
      setBusy(false);
    }
  };

  if (tasks.loading) return <LoadingState label="Memuat tugas pengantaran..." />;
  if (tasks.error) return <ErrorState message={tasks.error} onRetry={tasks.refetch} />;

  const address = selected
    ? selected.addressSnapshot || selected.order?.address?.addressText || ''
    : '';
  const phone = selected ? selected.contactPhone || selected.order?.customer?.phone || '' : '';
  const mapsUrl = address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}` : null;

  return (
    <div>
      <PageHeader
        eyebrow="Logistik"
        title={`Tugas kurir, ${user?.name.split(' ')[0] ?? ''}`}
        description="Pilih tugas, lihat alamat dan jadwal, lalu perbarui perjalanan dari panel detail."
        actions={
          <Button variant="outline" onClick={tasks.refetch} icon={<RefreshCw className="h-4 w-4" />}>
            Muat ulang
          </Button>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Tugas aktif"
          value={active.length}
          hint="Ditugaskan atau dalam perjalanan"
          icon={<Truck className="h-5 w-5" />}
        />
        <StatCard
          label="Selesai"
          value={completed.length}
          hint="Serah terima terkonfirmasi"
          tone="teal"
          icon={<CheckCircle2 className="h-5 w-5" />}
        />
        <StatCard
          label="Gagal"
          value={failed.length}
          hint="Perlu ditinjau admin"
          tone="rose"
          icon={<XCircle className="h-5 w-5" />}
        />
      </div>

      <div
        className={
          filtered.length > 0
            ? 'grid grid-cols-1 gap-5 xl:items-start xl:grid-cols-[1.15fr_0.85fr]'
            : 'grid grid-cols-1 gap-5'
        }
      >
        <Card className="overflow-hidden">
          <div className="border-b border-ink-100 p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex gap-1 rounded-xl bg-sand-100 p-1" role="tablist" aria-label="Filter tugas">
                {tabs.map((option) => {
                  const count = option.key === 'active' ? active.length : option.key === 'completed' ? completed.length : failed.length;
                  return (
                    <button
                      key={option.key}
                      type="button"
                      role="tab"
                      aria-selected={tab === option.key}
                      onClick={() => {
                        setTab(option.key);
                        setSelectedId(null);
                      }}
                      className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                        tab === option.key ? 'bg-white text-brand-700 shadow-sm' : 'text-ink-500 hover:text-ink-800'
                      }`}
                    >
                      {option.label} <span className="ml-0.5 text-[10px] opacity-70">{count}</span>
                    </button>
                  );
                })}
              </div>
              <div className="relative w-full sm:w-56">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
                <Input
                  className="pl-9"
                  placeholder="Cari tugas..."
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  aria-label="Cari tugas pengantaran"
                />
              </div>
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="p-5">
              <EmptyState
                title={tab === 'active' ? 'Tidak ada tugas aktif' : tab === 'completed' ? 'Belum ada tugas selesai' : 'Tidak ada tugas gagal'}
                description={
                  tab === 'active'
                    ? 'Tugas pickup atau pengantaran baru akan muncul di sini setelah ditugaskan admin.'
                    : 'Riwayat tugas akan tampil sesuai statusnya.'
                }
                icon={<Truck className="h-6 w-6" />}
                action={
                  tab === 'active' && completed.length > 0 ? (
                    <Button size="sm" variant="outline" onClick={() => setTab('completed')}>
                      Lihat riwayat selesai
                    </Button>
                  ) : undefined
                }
              />
            </div>
          ) : (
            <ul className="divide-y divide-ink-50">
              {filtered.map((task) => (
                <li key={task.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(task.id)}
                    aria-pressed={selected?.id === task.id}
                    className={`w-full px-4 py-4 text-left transition sm:px-5 ${
                      selected?.id === task.id ? 'bg-brand-50/70' : 'hover:bg-sand-50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge tone={task.taskType === 'delivery' ? 'brand' : 'blue'}>
                            {taskTypeLabel[task.taskType]}
                          </Badge>
                          <StatusBadge
                            status={task.status}
                            label={taskStatusLabel[task.status] ?? task.status}
                          />
                        </div>
                        <p className="mt-2 font-mono text-xs font-bold text-brand-700">
                          {task.order?.orderCode ?? '-'}
                        </p>
                        <p className="text-sm font-bold text-ink-900">{task.order?.customer?.name ?? 'Pelanggan'}</p>
                        <p className="mt-1 line-clamp-1 text-xs text-ink-500">
                          <MapPin className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" />
                          {task.addressSnapshot || task.order?.address?.addressText || 'Alamat belum tersedia'}
                        </p>
                      </div>
                      <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-ink-300" aria-hidden="true" />
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-ink-400">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                        {formatDateTime(task.scheduledAt)}
                      </span>
                      {task.contactPhone || task.order?.customer?.phone ? (
                        <span className="inline-flex items-center gap-1">
                          <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                          {task.contactPhone || task.order?.customer?.phone}
                        </span>
                      ) : null}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {selected && (
        <div className="space-y-5 xl:sticky xl:top-[88px] xl:self-start">
            <>
              <Card className="overflow-hidden">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-ink-100 p-5">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-brand-600">
                      {taskTypeLabel[selected.taskType]}
                    </p>
                    <p className="mt-1 font-mono text-sm font-bold text-ink-950">{selected.order?.orderCode ?? '-'}</p>
                  </div>
                  <StatusBadge status={selected.status} label={taskStatusLabel[selected.status] ?? selected.status} />
                </div>

                <div className="p-5">
                  <div className="relative overflow-hidden rounded-2xl border border-brand-100 bg-brand-50">
                    <div className="absolute inset-0 bg-soft-grid bg-grid opacity-70" aria-hidden="true" />
                    <div className="relative flex min-h-[130px] flex-col items-center justify-center p-5 text-center">
                      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-brand-600 shadow-sm">
                        <MapPin className="h-5 w-5" aria-hidden="true" />
                      </span>
                      <p className="mt-2 max-w-xs text-xs font-semibold leading-relaxed text-ink-700">
                        {address || 'Alamat belum tersedia untuk tugas ini.'}
                      </p>
                      {mapsUrl && (
                        <a href={mapsUrl} target="_blank" rel="noreferrer" className="mt-2">
                          <Button size="sm" variant="outline" icon={<Navigation className="h-3.5 w-3.5" />}>
                            Buka di Google Maps
                          </Button>
                        </a>
                      )}
                    </div>
                  </div>
                  <p className="mt-2 text-[10px] leading-relaxed text-ink-400">
                    Peta interaktif belum terhubung. Alamat berasal dari snapshot pesanan; gunakan tautan peta untuk
                    navigasi.
                  </p>

                  <dl className="mt-4 space-y-3 text-sm">
                    <div className="flex items-start justify-between gap-3">
                      <dt className="text-ink-500">Pelanggan</dt>
                      <dd className="text-right font-semibold text-ink-900">
                        {selected.order?.customer?.name ?? 'Pelanggan'}
                      </dd>
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <dt className="text-ink-500">Jadwal</dt>
                      <dd className="text-right font-semibold text-ink-900">{formatDateTime(selected.scheduledAt)}</dd>
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <dt className="text-ink-500">Telepon</dt>
                      <dd className="text-right">
                        {phone ? (
                          <a href={`tel:${phone}`} className="font-semibold text-brand-700 hover:text-brand-900">
                            {phone}
                          </a>
                        ) : (
                          <span className="text-ink-400">-</span>
                        )}
                      </dd>
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <dt className="text-ink-500">Pembayaran</dt>
                      <dd className="text-right">
                        <Badge tone={selected.order?.paymentStatus === 'paid' ? 'green' : 'amber'}>
                          {paymentStatusLabel[selected.order?.paymentStatus ?? 'unpaid'] ?? selected.order?.paymentStatus}
                        </Badge>
                      </dd>
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <dt className="text-ink-500">Total</dt>
                      <dd className="text-right font-bold text-ink-900">
                        {formatCurrency(selected.order?.totalAmount ?? 0)}
                      </dd>
                    </div>
                  </dl>

                  {selected.notes && (
                    <p className="mt-4 rounded-xl bg-sand-50 px-4 py-3 text-xs leading-relaxed text-ink-600">
                      Catatan admin: {selected.notes}
                    </p>
                  )}

                  <div className="mt-5 space-y-2">
                    {selected.status === 'assigned' && (
                      <Button
                        className="w-full"
                        loading={busy}
                        icon={<CheckCircle2 className="h-4 w-4" />}
                        onClick={() => updateStatus(selected, 'accepted')}
                      >
                        Terima tugas
                      </Button>
                    )}
                    {selected.status === 'accepted' && (
                      <Button
                        className="w-full"
                        loading={busy}
                        icon={<Play className="h-4 w-4" />}
                        onClick={() => updateStatus(selected, 'in_progress')}
                      >
                        Mulai perjalanan
                      </Button>
                    )}
                    <Link to={`/courier/tugas/${selected.id}`} className="block">
                      <Button
                        className="w-full"
                        variant={selected.status === 'in_progress' ? 'primary' : 'outline'}
                        icon={<UserRound className="h-4 w-4" />}
                      >
                        {selected.status === 'in_progress' ? 'Selesaikan & serah terima' : 'Buka detail tugas'}
                      </Button>
                    </Link>
                  </div>
                </div>
              </Card>

              <Card className="p-4">
                <p className="text-xs font-bold text-ink-900">Alur status</p>
                <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px] font-semibold text-ink-500">
                  {['assigned', 'accepted', 'in_progress', 'completed'].map((status, index) => (
                    <span key={status} className="inline-flex items-center gap-1.5">
                      {index > 0 && <span className="text-ink-300">→</span>}
                      <span className={selected.status === status ? 'text-brand-700' : ''}>
                        {taskStatusLabel[status]}
                      </span>
                    </span>
                  ))}
                </div>
              </Card>
            </>
        </div>
        )}
      </div>
    </div>
  );
}

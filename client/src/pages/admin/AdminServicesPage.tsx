import { useState } from 'react';
import { ClipboardList, Pencil, Plus, PowerOff, Trash2 } from 'lucide-react';
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
  Textarea,
} from '../../components/ui';
import { DataTable, Td, Th } from '../../components/common';
import { useApi } from '../../lib/useApi';
import { api, ApiError } from '../../lib/api';
import { useToast } from '../../lib/toast';
import { formatCurrency, unitLabel } from '../../lib/format';
import type { Service } from '../../lib/types';

interface ServiceForm {
  name: string;
  description: string;
  price: string;
  pricingUnit: 'kg' | 'piece' | 'pair';
  estimatedHours: string;
  isActive: boolean;
}

const emptyForm: ServiceForm = {
  name: '',
  description: '',
  price: '',
  pricingUnit: 'kg',
  estimatedHours: '',
  isActive: true,
};

export function AdminServicesPage() {
  const { toast } = useToast();
  const [activeFilter, setActiveFilter] = useState('');
  const [search, setSearch] = useState('');
  const query = new URLSearchParams();
  if (activeFilter) query.set('isActive', activeFilter);
  if (search.trim()) query.set('search', search.trim());
  const services = useApi<Service[]>(`/admin/services?${query.toString()}`, [activeFilter, search]);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Service | null>(null);
  const [form, setForm] = useState<ServiceForm>(emptyForm);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Service | null>(null);

  const startCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setError(null);
    setOpen(true);
  };

  const startEdit = (service: Service) => {
    setEditing(service);
    setForm({
      name: service.name,
      description: service.description ?? '',
      price: String(service.price),
      pricingUnit: service.pricingUnit,
      estimatedHours: service.estimatedHours === null ? '' : String(service.estimatedHours),
      isActive: service.isActive,
    });
    setError(null);
    setOpen(true);
  };

  const patch = <K extends keyof ServiceForm>(key: K, value: ServiceForm[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const submit = async () => {
    setBusy(true);
    setError(null);
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      price: Number(form.price),
      pricingUnit: form.pricingUnit,
      estimatedHours: form.estimatedHours === '' ? null : Number(form.estimatedHours),
      isActive: form.isActive,
    };
    try {
      if (editing) {
        await api.patch(`/admin/services/${editing.id}`, payload);
        toast('Layanan diperbarui');
      } else {
        await api.post('/admin/services', payload);
        toast('Layanan ditambahkan');
      }
      setOpen(false);
      services.refetch();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal menyimpan layanan');
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (service: Service) => {
    try {
      await api.patch(`/admin/services/${service.id}`, { isActive: !service.isActive });
      toast(service.isActive ? 'Layanan dinonaktifkan' : 'Layanan diaktifkan');
      services.refetch();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Gagal mengubah status', 'error');
    }
  };

  const remove = async () => {
    if (!confirmDelete) return;
    setBusy(true);
    try {
      await api.delete(`/admin/services/${confirmDelete.id}`);
      toast('Layanan dihapus');
      setConfirmDelete(null);
      services.refetch();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Gagal menghapus layanan', 'error');
    } finally {
      setBusy(false);
    }
  };

  const renderActions = (service: Service) => (
    <div className="flex flex-wrap gap-1.5">
      <Button
        size="sm"
        variant="outline"
        icon={<Pencil className="h-3.5 w-3.5" />}
        onClick={() => startEdit(service)}
      >
        Ubah
      </Button>
      <Button
        size="sm"
        variant="ghost"
        icon={<PowerOff className="h-3.5 w-3.5" />}
        onClick={() => toggleActive(service)}
      >
        {service.isActive ? 'Nonaktifkan' : 'Aktifkan'}
      </Button>
      <Button
        size="sm"
        variant="ghost"
        className="text-red-600"
        icon={<Trash2 className="h-3.5 w-3.5" />}
        onClick={() => setConfirmDelete(service)}
      >
        Hapus
      </Button>
    </div>
  );

  return (
    <div>
      <PageHeader
        eyebrow="Katalog"
        title="Layanan laundry"
        description="Kelola harga, satuan, estimasi pengerjaan, dan ketersediaan layanan."
        actions={<Button icon={<Plus className="h-4 w-4" />} onClick={startCreate}>Tambah layanan</Button>}
      />

      <Card className="mb-5 flex flex-wrap items-end gap-3 p-4">
        <Field label="Cari layanan" className="w-full sm:w-72">
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nama layanan..." />
        </Field>
        <Field label="Status" className="w-full sm:w-48">
          <Select value={activeFilter} onChange={(event) => setActiveFilter(event.target.value)}>
            <option value="">Semua</option>
            <option value="true">Aktif</option>
            <option value="false">Nonaktif</option>
          </Select>
        </Field>
      </Card>

      {services.loading ? (
        <LoadingState label="Memuat layanan..." />
      ) : services.error ? (
        <ErrorState message={services.error} onRetry={services.refetch} />
      ) : (services.data ?? []).length === 0 ? (
        <EmptyState
          title="Belum ada layanan"
          description="Tambahkan layanan pertama agar pelanggan dapat membuat reservasi."
          icon={<ClipboardList className="h-6 w-6" />}
          action={<Button onClick={startCreate}>Tambah layanan</Button>}
        />
      ) : (
        <>
          <div className="space-y-3 md:hidden">
            {(services.data ?? []).map((service) => (
              <Card key={service.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold text-ink-900">{service.name}</p>
                    {service.description && (
                      <p className="mt-0.5 line-clamp-2 text-xs text-ink-500">{service.description}</p>
                    )}
                  </div>
                  <Badge tone={service.isActive ? 'green' : 'slate'}>
                    {service.isActive ? 'Aktif' : 'Nonaktif'}
                  </Badge>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3 border-t border-ink-50 pt-3 text-sm">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-ink-400">Harga</p>
                    <p className="font-bold text-ink-900">
                      {formatCurrency(service.price)}
                      <span className="text-xs font-normal text-ink-400">
                        {' '}
                        / {unitLabel[service.pricingUnit] ?? service.pricingUnit}
                      </span>
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-ink-400">Estimasi & pemakaian</p>
                    <p className="font-semibold text-ink-800">
                      {service.estimatedHours ? `${service.estimatedHours} jam` : '-'}
                    </p>
                    <p className="text-[11px] text-ink-400">{service.usageCount ?? 0} pesanan</p>
                  </div>
                </div>
                <div className="mt-3">{renderActions(service)}</div>
              </Card>
            ))}
          </div>

          <div className="hidden md:block">
            <DataTable>
              <thead>
                <tr>
                  <Th>Layanan</Th>
                  <Th>Harga</Th>
                  <Th>Estimasi</Th>
                  <Th>Pemakaian</Th>
                  <Th>Status</Th>
                  <Th>Aksi</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-50">
                {(services.data ?? []).map((service) => (
                  <tr key={service.id} className="hover:bg-sand-50/50">
                    <Td>
                      <p className="font-bold text-ink-900">{service.name}</p>
                      {service.description && (
                        <p className="mt-0.5 line-clamp-2 max-w-sm text-xs text-ink-500">{service.description}</p>
                      )}
                    </Td>
                    <Td>
                      <span className="font-semibold">{formatCurrency(service.price)}</span>
                      <span className="text-xs text-ink-400">
                        {' '}
                        / {unitLabel[service.pricingUnit] ?? service.pricingUnit}
                      </span>
                    </Td>
                    <Td>{service.estimatedHours ? `${service.estimatedHours} jam` : '-'}</Td>
                    <Td>{service.usageCount ?? 0} pesanan</Td>
                    <Td>
                      <Badge tone={service.isActive ? 'green' : 'slate'}>
                        {service.isActive ? 'Aktif' : 'Nonaktif'}
                      </Badge>
                    </Td>
                    <Td>{renderActions(service)}</Td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          </div>
        </>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Ubah layanan' : 'Tambah layanan'} size="md">
        <div className="space-y-4">
          {error && <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
          <Field label="Nama layanan" htmlFor="service-name" required>
            <Input id="service-name" value={form.name} onChange={(event) => patch('name', event.target.value)} placeholder="Cuci kering" />
          </Field>
          <Field label="Deskripsi">
            <Textarea value={form.description} onChange={(event) => patch('description', event.target.value)} maxLength={2000} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Harga (IDR)" htmlFor="service-price" required>
              <Input id="service-price" type="number" min="0" value={form.price} onChange={(event) => patch('price', event.target.value)} />
            </Field>
            <Field label="Satuan" htmlFor="service-unit" required>
              <Select id="service-unit" value={form.pricingUnit} onChange={(event) => patch('pricingUnit', event.target.value as ServiceForm['pricingUnit'])}>
                <option value="kg">Kilogram</option>
                <option value="piece">Potong</option>
                <option value="pair">Pasang</option>
              </Select>
            </Field>
            <Field label="Estimasi (jam)" htmlFor="service-hours">
              <Input id="service-hours" type="number" min="0" value={form.estimatedHours} onChange={(event) => patch('estimatedHours', event.target.value)} />
            </Field>
            <Field label="Status">
              <Select value={form.isActive ? 'true' : 'false'} onChange={(event) => patch('isActive', event.target.value === 'true')}>
                <option value="true">Aktif</option>
                <option value="false">Nonaktif</option>
              </Select>
            </Field>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Batal</Button>
            <Button onClick={submit} loading={busy} disabled={form.name.trim().length < 2 || form.price === ''}>Simpan</Button>
          </div>
        </div>
      </Modal>

      <Modal open={Boolean(confirmDelete)} onClose={() => setConfirmDelete(null)} title="Hapus layanan?" size="sm">
        <p className="text-sm text-ink-600">
          Layanan <strong>{confirmDelete?.name}</strong> akan dihapus. Layanan yang pernah dipakai pesanan tidak dapat dihapus;
          nonaktifkan sebagai gantinya.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setConfirmDelete(null)}>Batal</Button>
          <Button variant="danger" loading={busy} onClick={remove}>Hapus</Button>
        </div>
      </Modal>
    </div>
  );
}

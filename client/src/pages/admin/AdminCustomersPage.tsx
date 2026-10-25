import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Search, UserRound, Users } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  LoadingState,
  Modal,
  PageHeader,
  Pagination,
  Select,
} from '../../components/ui';
import { DataTable, Td, Th } from '../../components/common';
import { usePagedApi } from '../../lib/useApi';
import { api, ApiError } from '../../lib/api';
import { useToast } from '../../lib/toast';
import { formatCurrency, formatDate } from '../../lib/format';

interface CustomerRow {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  isActive: boolean;
  createdAt: string;
  counts: { orders: number; reservations: number; addresses: number };
  lifetimeValue: number;
}

export function AdminCustomersPage() {
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const [isActive, setIsActive] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  const query = new URLSearchParams({ page: String(page), limit: '10' });
  if (isActive) query.set('isActive', isActive);
  if (search) query.set('search', search);

  const customers = usePagedApi<CustomerRow>(`/admin/customers?${query.toString()}`, [page, isActive, search]);
  const [target, setTarget] = useState<CustomerRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = async () => {
    if (!target) return;
    setBusy(true);
    setError(null);
    try {
      await api.patch(`/admin/customers/${target.id}/status`, { isActive: !target.isActive });
      toast(target.isActive ? 'Akun pelanggan dinonaktifkan' : 'Akun pelanggan diaktifkan');
      setTarget(null);
      customers.refetch();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal memperbarui status');
    } finally {
      setBusy(false);
    }
  };

  const renderActions = (customer: CustomerRow) => (
    <div className="flex flex-wrap gap-1">
      <Link to={`/admin/pelanggan/${customer.id}`}>
        <Button size="sm" variant="ghost" icon={<ArrowRight className="h-3.5 w-3.5" />}>
          Detail
        </Button>
      </Link>
      <Button
        size="sm"
        variant="ghost"
        className={customer.isActive ? 'text-red-600' : 'text-emerald-700'}
        onClick={() => {
          setTarget(customer);
          setError(null);
        }}
      >
        {customer.isActive ? 'Nonaktifkan' : 'Aktifkan'}
      </Button>
    </div>
  );

  return (
    <div>
      <PageHeader
        eyebrow="CRM"
        title="Pelanggan"
        description="Cari pelanggan, tinjau nilai transaksi, dan kelola status akun."
      />

      <Card className="mb-5 p-4">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            setPage(1);
            setSearch(searchInput.trim());
          }}
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_180px_auto]"
        >
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
            <Input
              className="pl-10"
              placeholder="Cari nama, email, atau telepon..."
              aria-label="Cari pelanggan"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
            />
          </div>
          <Select aria-label="Filter status akun" value={isActive} onChange={(event) => { setIsActive(event.target.value); setPage(1); }}>
            <option value="">Semua status akun</option>
            <option value="true">Aktif</option>
            <option value="false">Nonaktif</option>
          </Select>
          <Button type="submit">Cari</Button>
        </form>
      </Card>

      {customers.loading ? (
        <LoadingState label="Memuat pelanggan..." />
      ) : customers.error ? (
        <ErrorState message={customers.error} onRetry={customers.refetch} />
      ) : customers.rows.length === 0 ? (
        <EmptyState title="Tidak ada pelanggan" description="Coba ubah kata kunci atau filter." icon={<Users className="h-6 w-6" />} />
      ) : (
        <>
          <div className="space-y-3 md:hidden">
            {customers.rows.map((customer) => (
              <Card key={customer.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700">
                      <UserRound className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-bold text-ink-900">{customer.name}</p>
                      <p className="truncate text-[11px] text-ink-400">{customer.email}</p>
                    </div>
                  </div>
                  <Badge tone={customer.isActive ? 'green' : 'red'}>
                    {customer.isActive ? 'Aktif' : 'Nonaktif'}
                  </Badge>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3 border-t border-ink-50 pt-3 text-sm">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-ink-400">Kontak</p>
                    <p className="font-semibold text-ink-800">{customer.phone ?? '-'}</p>
                    <p className="text-[11px] text-ink-400">Bergabung {formatDate(customer.createdAt)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-ink-400">Nilai transaksi</p>
                    <p className="font-bold text-ink-900">{formatCurrency(customer.lifetimeValue)}</p>
                    <p className="text-[11px] text-ink-400">
                      {customer.counts.orders} pesanan · {customer.counts.reservations} reservasi
                    </p>
                  </div>
                </div>
                <div className="mt-3">{renderActions(customer)}</div>
              </Card>
            ))}
          </div>

          <div className="hidden md:block">
            <DataTable>
              <thead>
                <tr>
                  <Th>Pelanggan</Th>
                  <Th>Kontak</Th>
                  <Th>Pesanan</Th>
                  <Th>Nilai transaksi</Th>
                  <Th>Status</Th>
                  <Th>Bergabung</Th>
                  <Th />
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-50">
                {customers.rows.map((customer) => (
                  <tr key={customer.id} className="hover:bg-sand-50/50">
                    <Td>
                      <div className="flex items-center gap-2">
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-50 text-brand-700">
                          <UserRound className="h-4 w-4" />
                        </span>
                        <div>
                          <p className="font-semibold text-ink-900">{customer.name}</p>
                          <p className="text-[11px] text-ink-400">{customer.email}</p>
                        </div>
                      </div>
                    </Td>
                    <Td className="text-sm">{customer.phone ?? '-'}</Td>
                    <Td>
                      <p className="text-sm font-semibold text-ink-800">{customer.counts.orders} pesanan</p>
                      <p className="text-[11px] text-ink-400">
                        {customer.counts.reservations} reservasi · {customer.counts.addresses} alamat
                      </p>
                    </Td>
                    <Td className="font-semibold text-ink-900">{formatCurrency(customer.lifetimeValue)}</Td>
                    <Td>
                      <Badge tone={customer.isActive ? 'green' : 'red'}>
                        {customer.isActive ? 'Aktif' : 'Nonaktif'}
                      </Badge>
                    </Td>
                    <Td className="text-xs text-ink-400">{formatDate(customer.createdAt)}</Td>
                    <Td>{renderActions(customer)}</Td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          </div>
          <div className="mt-4">
            <Pagination page={page} totalPages={customers.meta?.totalPages ?? 1} total={customers.meta?.total} onChange={setPage} />
          </div>
        </>
      )}

      <Modal open={Boolean(target)} onClose={() => setTarget(null)} title={target?.isActive ? 'Nonaktifkan pelanggan' : 'Aktifkan pelanggan'} size="sm">
        <div className="space-y-4">
          {error && <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
          <p className="text-sm leading-relaxed text-ink-600">
            {target?.isActive
              ? `Akun ${target?.name} tidak akan dapat masuk hingga diaktifkan kembali. Data pesanan tetap tersimpan.`
              : `Aktifkan kembali akun ${target?.name} agar dapat masuk dan membuat reservasi.`}
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setTarget(null)}>Batal</Button>
            <Button variant={target?.isActive ? 'danger' : 'primary'} onClick={toggle} loading={busy}>
              {target?.isActive ? 'Nonaktifkan' : 'Aktifkan'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

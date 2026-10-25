import { useState } from 'react';
import { Power, Search, ShieldCheck, Trash2, UserPlus, UserRound, Users } from 'lucide-react';
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
import { CreateAccountDialog, DeleteAccountDialog } from '../../components/account';
import { usePagedApi } from '../../lib/useApi';
import { api, ApiError } from '../../lib/api';
import { useToast } from '../../lib/toast';
import { useAuth } from '../../lib/auth';
import { formatDate, formatDateTime } from '../../lib/format';

interface AccountRow {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  isActive: boolean;
  isPrimaryAdmin: boolean;
  deletedAt: string | null;
  createdAt: string;
  roles: string[];
  counts: { orders: number; reservations: number; auditLogs: number };
}

const roleLabels: Record<string, string> = {
  customer: 'Pelanggan',
  admin: 'Administrator',
  staff: 'Staff',
  courier: 'Kurir',
  owner: 'Owner',
};

function AccountStatus({ account }: { account: AccountRow }) {
  if (account.deletedAt) return <Badge tone="red">Dihapus</Badge>;
  return <Badge tone={account.isActive ? 'green' : 'amber'}>{account.isActive ? 'Aktif' : 'Nonaktif'}</Badge>;
}

function RoleBadges({ account }: { account: AccountRow }) {
  return (
    <div className="flex flex-wrap gap-1">
      {account.isPrimaryAdmin && (
        <Badge tone="brand">
          <ShieldCheck className="h-3 w-3" aria-hidden="true" />
          Admin utama
        </Badge>
      )}
      {account.roles.map((role) => (
        <Badge key={role} tone={role === 'admin' ? 'blue' : 'slate'}>
          {roleLabels[role] ?? role}
        </Badge>
      ))}
    </div>
  );
}

export function AdminAccountsPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  const query = new URLSearchParams({ page: String(page), limit: '10' });
  if (role) query.set('role', role);
  if (status) query.set('status', status);
  if (search) query.set('search', search);

  const accounts = usePagedApi<AccountRow>(`/admin/accounts?${query.toString()}`, [page, role, status, search]);

  const [statusTarget, setStatusTarget] = useState<AccountRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AccountRow | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [statusBusy, setStatusBusy] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const openStatus = (account: AccountRow) => {
    setStatusTarget(account);
    setStatusError(null);
  };

  const openDelete = (account: AccountRow) => {
    setDeleteTarget(account);
    setDeleteError(null);
  };

  const toggleStatus = async () => {
    if (!statusTarget || statusBusy) return;
    setStatusBusy(true);
    setStatusError(null);
    try {
      await api.patch(`/admin/accounts/${statusTarget.id}/status`, { isActive: !statusTarget.isActive });
      toast(statusTarget.isActive ? 'Akun dinonaktifkan' : 'Akun diaktifkan');
      setStatusTarget(null);
      accounts.refetch();
    } catch (error) {
      setStatusError(error instanceof ApiError ? error.message : 'Gagal memperbarui status akun');
    } finally {
      setStatusBusy(false);
    }
  };

  const removeAccount = async () => {
    if (!deleteTarget || deleteBusy) return;
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      await api.delete(`/admin/accounts/${deleteTarget.id}`);
      toast('Akun berhasil dihapus. Riwayat bisnis tetap tersimpan.');
      setDeleteTarget(null);
      if (accounts.rows.length === 1 && page > 1) setPage(page - 1);
      else accounts.refetch();
    } catch (error) {
      setDeleteError(error instanceof ApiError ? error.message : 'Gagal menghapus akun');
    } finally {
      setDeleteBusy(false);
    }
  };

  const renderActions = (account: AccountRow) => {
    if (account.deletedAt) return <span className="text-xs text-ink-400">Tidak ada tindakan</span>;
    if (account.isPrimaryAdmin) {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-700">
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" /> Dilindungi
        </span>
      );
    }
    const isSelf = account.id === user?.id;
    const isAdmin = account.roles.includes('admin');
    return (
      <div className="flex flex-wrap gap-1">
        <Button
          size="sm"
          variant="ghost"
          icon={<Power className="h-3.5 w-3.5" />}
          className={account.isActive ? 'text-amber-700' : 'text-emerald-700'}
          onClick={() => openStatus(account)}
          disabled={isSelf && account.isActive}
          title={isSelf && account.isActive ? 'Anda tidak dapat menonaktifkan akun sendiri' : undefined}
        >
          {account.isActive ? 'Nonaktifkan' : 'Aktifkan'}
        </Button>
        {!isAdmin && (
          <Button
            size="sm"
            variant="ghost"
            className="text-red-600"
            icon={<Trash2 className="h-3.5 w-3.5" />}
            onClick={() => openDelete(account)}
            disabled={isSelf}
            title={isSelf ? 'Anda tidak dapat menghapus akun sendiri' : undefined}
          >
            Hapus
          </Button>
        )}
      </div>
    );
  };

  return (
    <div>
      <PageHeader
        eyebrow="Keamanan akun"
        title="Kelola akun"
        description="Kelola akses seluruh akun. Administrator utama dilindungi dan tidak dapat dihapus atau dinonaktifkan."
        actions={
          <Button icon={<UserPlus className="h-4 w-4" />} onClick={() => setCreateOpen(true)}>
            Tambah akun
          </Button>
        }
      />

      <Card className="mb-5 p-4">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            setPage(1);
            setSearch(searchInput.trim());
          }}
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_170px_170px_auto]"
        >
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
            <Input
              className="pl-10"
              placeholder="Cari nama, email, atau telepon..."
              aria-label="Cari akun"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
            />
          </div>
          <Select
            aria-label="Filter peran"
            value={role}
            onChange={(event) => {
              setRole(event.target.value);
              setPage(1);
            }}
          >
            <option value="">Semua peran</option>
            <option value="customer">Pelanggan</option>
            <option value="admin">Administrator</option>
            <option value="staff">Staff</option>
            <option value="courier">Kurir</option>
            <option value="owner">Owner</option>
          </Select>
          <Select
            aria-label="Filter status akun"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
          >
            <option value="">Semua status</option>
            <option value="active">Aktif</option>
            <option value="inactive">Nonaktif</option>
            <option value="deleted">Dihapus</option>
          </Select>
          <Button type="submit">Cari</Button>
        </form>
      </Card>

      {accounts.loading ? (
        <LoadingState label="Memuat akun..." />
      ) : accounts.error ? (
        <ErrorState message={accounts.error} onRetry={accounts.refetch} />
      ) : accounts.rows.length === 0 ? (
        <EmptyState
          title="Tidak ada akun"
          description="Coba ubah kata kunci atau filter peran/status."
          icon={<Users className="h-6 w-6" />}
        />
      ) : (
        <>
          <div className="space-y-3 md:hidden">
            {accounts.rows.map((account) => (
              <Card key={account.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700">
                      {account.isPrimaryAdmin ? (
                        <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                      ) : (
                        <UserRound className="h-4 w-4" aria-hidden="true" />
                      )}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-bold text-ink-900">{account.name}</p>
                      <p className="truncate text-[11px] text-ink-400">{account.email}</p>
                    </div>
                  </div>
                  <AccountStatus account={account} />
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <RoleBadges account={account} />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3 border-t border-ink-50 pt-3 text-sm">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-ink-400">Kontak</p>
                    <p className="font-semibold text-ink-800">{account.phone ?? '-'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-ink-400">Dibuat</p>
                    <p className="font-semibold text-ink-800">{formatDate(account.createdAt)}</p>
                  </div>
                </div>
                <div className="mt-3 border-t border-ink-50 pt-3">{renderActions(account)}</div>
              </Card>
            ))}
          </div>

          <div className="hidden md:block">
            <DataTable>
              <thead>
                <tr>
                  <Th>Akun</Th>
                  <Th>Peran</Th>
                  <Th>Status</Th>
                  <Th>Dibuat</Th>
                  <Th>Aktivitas</Th>
                  <Th>Tindakan</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-50">
                {accounts.rows.map((account) => (
                  <tr key={account.id} className="hover:bg-sand-50/60">
                    <Td>
                      <div className="flex items-center gap-2">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700">
                          {account.isPrimaryAdmin ? (
                            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                          ) : (
                            <UserRound className="h-4 w-4" aria-hidden="true" />
                          )}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-ink-900">{account.name}</p>
                          <p className="truncate text-[11px] text-ink-400">{account.email}</p>
                          <p className="text-[11px] text-ink-400">{account.phone ?? 'Tanpa telepon'}</p>
                        </div>
                      </div>
                    </Td>
                    <Td><RoleBadges account={account} /></Td>
                    <Td>
                      <AccountStatus account={account} />
                      {account.deletedAt && (
                        <p className="mt-1 text-[10px] text-ink-400">Sejak {formatDateTime(account.deletedAt)}</p>
                      )}
                    </Td>
                    <Td className="text-xs text-ink-500">{formatDate(account.createdAt)}</Td>
                    <Td className="text-xs text-ink-500">
                      {account.counts.orders} pesanan · {account.counts.reservations} reservasi
                    </Td>
                    <Td>{renderActions(account)}</Td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          </div>
          <div className="mt-4">
            <Pagination
              page={page}
              totalPages={accounts.meta?.totalPages ?? 1}
              total={accounts.meta?.total}
              onChange={setPage}
            />
          </div>
        </>
      )}

      <CreateAccountDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => {
          setRole('');
          setStatus('');
          setSearch('');
          setSearchInput('');
          setPage(1);
          accounts.refetch();
        }}
      />

      <DeleteAccountDialog
        open={Boolean(deleteTarget)}
        account={deleteTarget}
        busy={deleteBusy}
        error={deleteError}
        onCancel={() => {
          if (!deleteBusy) setDeleteTarget(null);
        }}
        onConfirm={removeAccount}
      />

      <Modal
        open={Boolean(statusTarget)}
        onClose={() => {
          if (!statusBusy) setStatusTarget(null);
        }}
        title={statusTarget?.isActive ? 'Nonaktifkan akun?' : 'Aktifkan akun?'}
        size="sm"
      >
        <div className="space-y-4">
          {statusError && (
            <div role="alert" className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
              {statusError}
            </div>
          )}
          <p className="text-sm leading-relaxed text-ink-600">
            {statusTarget?.isActive
              ? `Akun ${statusTarget?.name} tidak akan dapat masuk hingga diaktifkan kembali. Riwayat bisnis tetap tersimpan.`
              : `Aktifkan kembali akun ${statusTarget?.name} agar dapat menggunakan LRCMIS.`}
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setStatusTarget(null)} disabled={statusBusy}>
              Batal
            </Button>
            <Button
              variant={statusTarget?.isActive ? 'danger' : 'primary'}
              onClick={toggleStatus}
              loading={statusBusy}
            >
              {statusTarget?.isActive ? 'Nonaktifkan' : 'Aktifkan'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

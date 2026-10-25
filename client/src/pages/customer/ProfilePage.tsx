import { useEffect, useState } from 'react';
import { KeyRound, MapPin, Pencil, Plus, ShieldCheck, Trash2, UserRound } from 'lucide-react';
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
  Textarea,
} from '../../components/ui';
import { Note } from '../../components/common';
import { useAuth } from '../../lib/auth';
import { useApi } from '../../lib/useApi';
import { api, ApiError } from '../../lib/api';
import { useToast } from '../../lib/toast';
import { formatDate } from '../../lib/format';
import type { Address } from '../../lib/types';

const emptyAddress = { label: 'Rumah', recipientName: '', phone: '', addressText: '', isDefault: false };

export function ProfilePage() {
  const { user, refresh } = useAuth();
  const { toast } = useToast();
  const addresses = useApi<Address[]>('/users/me/addresses');

  const [profile, setProfile] = useState({ name: '', phone: '' });
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [password, setPassword] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const [addressOpen, setAddressOpen] = useState(false);
  const [editing, setEditing] = useState<Address | null>(null);
  const [addressForm, setAddressForm] = useState(emptyAddress);
  const [savingAddress, setSavingAddress] = useState(false);
  const [addressError, setAddressError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Address | null>(null);

  useEffect(() => {
    if (user) setProfile({ name: user.name, phone: user.phone ?? '' });
  }, [user]);

  const saveProfile = async () => {
    setSavingProfile(true);
    setProfileError(null);
    try {
      await api.patch('/users/me', {
        name: profile.name.trim(),
        ...(profile.phone.trim() ? { phone: profile.phone.trim() } : {}),
      });
      await refresh();
      toast('Profil berhasil diperbarui');
    } catch (error) {
      setProfileError(error instanceof ApiError ? error.message : 'Gagal memperbarui profil');
    } finally {
      setSavingProfile(false);
    }
  };

  const savePassword = async () => {
    setSavingPassword(true);
    setPasswordError(null);
    if (password.newPassword !== password.confirmPassword) {
      setPasswordError('Konfirmasi password tidak sama');
      setSavingPassword(false);
      return;
    }
    try {
      await api.patch('/users/me/password', {
        currentPassword: password.currentPassword,
        newPassword: password.newPassword,
      });
      toast('Password berhasil diubah');
      setPassword({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (error) {
      setPasswordError(error instanceof ApiError ? error.message : 'Gagal mengubah password');
    } finally {
      setSavingPassword(false);
    }
  };

  const openAddress = (address?: Address) => {
    setEditing(address ?? null);
    setAddressForm(
      address
        ? {
            label: address.label ?? '',
            recipientName: address.recipientName ?? '',
            phone: address.phone ?? '',
            addressText: address.addressText,
            isDefault: address.isDefault,
          }
        : emptyAddress,
    );
    setAddressError(null);
    setAddressOpen(true);
  };

  const saveAddress = async () => {
    setSavingAddress(true);
    setAddressError(null);
    const payload = {
      label: addressForm.label.trim() || undefined,
      recipientName: addressForm.recipientName.trim() || undefined,
      phone: addressForm.phone.trim() || undefined,
      addressText: addressForm.addressText.trim(),
      isDefault: addressForm.isDefault,
    };
    try {
      if (editing) await api.patch(`/users/me/addresses/${editing.id}`, payload);
      else await api.post('/users/me/addresses', payload);
      toast(editing ? 'Alamat diperbarui' : 'Alamat ditambahkan');
      setAddressOpen(false);
      addresses.refetch();
    } catch (error) {
      setAddressError(error instanceof ApiError ? error.message : 'Gagal menyimpan alamat');
    } finally {
      setSavingAddress(false);
    }
  };

  const removeAddress = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/users/me/addresses/${deleteTarget.id}`);
      toast('Alamat dihapus');
      setDeleteTarget(null);
      addresses.refetch();
    } catch (error) {
      toast(error instanceof ApiError ? error.message : 'Gagal menghapus alamat', 'error');
    }
  };

  if (!user) return null;

  return (
    <div>
      <PageHeader
        eyebrow="Akun"
        title="Profil & alamat"
        description="Kelola data kontak, keamanan akun, dan alamat pickup Anda."
      />

      <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-5">
          <Card className="p-5 sm:p-6">
            <div className="flex items-center gap-2">
              <UserRound className="h-5 w-5 text-brand-700" />
              <h2 className="text-base font-bold text-ink-950">Data profil</h2>
            </div>
            {profileError && <div className="mt-3 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{profileError}</div>}
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Nama lengkap" htmlFor="name" required>
                <Input id="name" value={profile.name} onChange={(event) => setProfile({ ...profile, name: event.target.value })} />
              </Field>
              <Field label="Email" htmlFor="email" hint="Email tidak dapat diubah">
                <Input id="email" value={user.email} disabled />
              </Field>
              <Field label="Nomor telepon" htmlFor="phone" hint="Format 08xx">
                <Input id="phone" type="tel" value={profile.phone} onChange={(event) => setProfile({ ...profile, phone: event.target.value })} />
              </Field>
              <Field label="Terdaftar sejak" htmlFor="created">
                <Input id="created" value={formatDate(user.createdAt)} disabled />
              </Field>
            </div>
            <div className="mt-4 flex justify-end">
              <Button onClick={saveProfile} loading={savingProfile} disabled={profile.name.trim().length < 2}>Simpan profil</Button>
            </div>
          </Card>

          <Card className="p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-brand-700" />
                <h2 className="text-base font-bold text-ink-950">Alamat pickup</h2>
              </div>
              <Button size="sm" variant="outline" onClick={() => openAddress()} icon={<Plus className="h-4 w-4" />}>Tambah</Button>
            </div>
            <p className="mt-1 text-xs text-ink-500">Alamat yang dapat dipilih saat membuat reservasi pickup.</p>
            {addresses.loading ? (
              <div className="mt-4"><LoadingState label="Memuat alamat..." /></div>
            ) : addresses.error ? (
              <div className="mt-4"><ErrorState message={addresses.error} onRetry={addresses.refetch} /></div>
            ) : (addresses.data ?? []).length === 0 ? (
              <div className="mt-4">
                <EmptyState title="Belum ada alamat" description="Tambahkan alamat agar dapat memakai layanan pickup." icon={<MapPin className="h-6 w-6" />} action={<Button size="sm" onClick={() => openAddress()}>Tambah alamat</Button>} />
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {(addresses.data ?? []).map((address) => (
                  <div key={address.id} className="rounded-xl border border-ink-100 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-bold text-ink-900">
                          {address.label || 'Alamat'}
                          {address.isDefault && <span className="ml-2 rounded bg-brand-100 px-1.5 py-0.5 text-[10px] font-bold text-brand-800">Utama</span>}
                        </p>
                        <p className="mt-1 text-sm leading-relaxed text-ink-600">{address.addressText}</p>
                        {(address.recipientName || address.phone) && (
                          <p className="mt-1 text-xs text-ink-400">{[address.recipientName, address.phone].filter(Boolean).join(' · ')}</p>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <button type="button" onClick={() => openAddress(address)} className="rounded-lg p-2 text-ink-400 hover:bg-ink-50 hover:text-brand-700" aria-label="Edit alamat">
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button type="button" onClick={() => setDeleteTarget(address)} className="rounded-lg p-2 text-ink-400 hover:bg-red-50 hover:text-red-600" aria-label="Hapus alamat">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-5">
          <Card className="p-5 sm:p-6">
            <div className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-brand-700" />
              <h2 className="text-base font-bold text-ink-950">Ubah password</h2>
            </div>
            {passwordError && <div className="mt-3 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{passwordError}</div>}
            <div className="mt-4 space-y-4">
              <Field label="Password saat ini" htmlFor="currentPassword" required>
                <Input id="currentPassword" type="password" autoComplete="current-password" value={password.currentPassword} onChange={(event) => setPassword({ ...password, currentPassword: event.target.value })} />
              </Field>
              <Field label="Password baru" htmlFor="newPassword" hint="Minimal 8 karakter, huruf dan angka" required>
                <Input id="newPassword" type="password" autoComplete="new-password" value={password.newPassword} onChange={(event) => setPassword({ ...password, newPassword: event.target.value })} />
              </Field>
              <Field label="Konfirmasi password baru" htmlFor="confirmPassword" required>
                <Input id="confirmPassword" type="password" autoComplete="new-password" value={password.confirmPassword} onChange={(event) => setPassword({ ...password, confirmPassword: event.target.value })} />
              </Field>
              <Button
                className="w-full"
                onClick={savePassword}
                loading={savingPassword}
                disabled={!password.currentPassword || password.newPassword.length < 8 || !/[0-9]/.test(password.newPassword) || !/[A-Za-z]/.test(password.newPassword)}
                icon={<ShieldCheck className="h-4 w-4" />}
              >
                Simpan password
              </Button>
            </div>
          </Card>
          <Card className="p-5">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-ink-400">Peran akun</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {user.roles.map((role) => (
                <Badge key={role} tone="brand">{role}</Badge>
              ))}
            </div>
            <div className="mt-4"><Note>Data profil dan alamat hanya dapat diakses oleh Anda. Alamat pelanggan hanya terlihat oleh admin melalui pesanan terkait.</Note></div>
          </Card>
        </div>
      </div>

      <Modal open={addressOpen} onClose={() => setAddressOpen(false)} title={editing ? 'Edit alamat' : 'Tambah alamat'} description="Alamat lengkap membantu kurir menemukan lokasi.">
        <div className="space-y-4">
          {addressError && <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{addressError}</div>}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Label" htmlFor="addressLabel">
              <Input id="addressLabel" value={addressForm.label} onChange={(event) => setAddressForm({ ...addressForm, label: event.target.value })} placeholder="Rumah / Kantor" />
            </Field>
            <Field label="Nama penerima" htmlFor="recipientName">
              <Input id="recipientName" value={addressForm.recipientName} onChange={(event) => setAddressForm({ ...addressForm, recipientName: event.target.value })} placeholder="Nama di lokasi" />
            </Field>
          </div>
          <Field label="Nomor telepon" htmlFor="addressPhone" hint="Format 08xx">
            <Input id="addressPhone" type="tel" value={addressForm.phone} onChange={(event) => setAddressForm({ ...addressForm, phone: event.target.value })} placeholder="081234567890" />
          </Field>
          <Field label="Alamat lengkap" htmlFor="addressText" required hint="Minimal 10 karakter">
            <Textarea id="addressText" value={addressForm.addressText} onChange={(event) => setAddressForm({ ...addressForm, addressText: event.target.value })} placeholder="Jalan, nomor, RT/RW, kelurahan, kecamatan, kota, kode pos" />
          </Field>
          <label className="flex items-center gap-2 text-sm text-ink-600">
            <input type="checkbox" checked={addressForm.isDefault} onChange={(event) => setAddressForm({ ...addressForm, isDefault: event.target.checked })} className="accent-brand-700" />
            Jadikan alamat utama
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setAddressOpen(false)}>Batal</Button>
            <Button onClick={saveAddress} loading={savingAddress} disabled={addressForm.addressText.trim().length < 10}>Simpan alamat</Button>
          </div>
        </div>
      </Modal>

      <Modal open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)} title="Hapus alamat" size="sm">
        <p className="text-sm leading-relaxed text-ink-600">
          Hapus alamat <span className="font-semibold text-ink-900">{deleteTarget?.label || deleteTarget?.addressText}</span>? Alamat yang dipakai pesanan lama tetap tersimpan pada snapshot pesanan.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setDeleteTarget(null)}>Batal</Button>
          <Button variant="danger" onClick={removeAddress}>Hapus</Button>
        </div>
      </Modal>
    </div>
  );
}

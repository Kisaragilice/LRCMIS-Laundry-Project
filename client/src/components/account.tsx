import { useEffect, useState, type FormEvent } from 'react';
import { AlertTriangle, Eye, EyeOff, ShieldCheck, UserPlus } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { useToast } from '../lib/toast';
import { Button, Field, Input, Modal, Select } from './ui';

export interface AccountTarget {
  id: string;
  name: string;
  email: string;
  isPrimaryAdmin: boolean;
}

export function DeleteAccountDialog({
  open,
  account,
  busy,
  error,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  account: AccountTarget | null;
  busy: boolean;
  error?: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal open={open} onClose={onCancel} title="Hapus akun?" size="sm">
      <div className="space-y-4">
        {error && (
          <div role="alert" className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}
        <div className="flex items-start gap-3 rounded-xl border border-amber-100 bg-amber-50 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" aria-hidden="true" />
          <div className="text-sm leading-relaxed text-amber-900">
            <p className="font-semibold">Anda akan menghapus akun berikut:</p>
            <p className="mt-1 font-bold">{account?.name}</p>
            <p className="break-all text-xs">{account?.email}</p>
          </div>
        </div>
        {account?.isPrimaryAdmin ? (
          <p className="flex items-center gap-2 rounded-xl border border-brand-100 bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-800">
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            Akun administrator utama dilindungi dan tidak dapat dihapus.
          </p>
        ) : (
          <p className="text-sm leading-relaxed text-ink-600">
            Apakah Anda yakin ingin menghapus akun ini? Pengguna tidak akan bisa masuk lagi. Riwayat pesanan,
            pembayaran, dan audit tetap tersimpan.
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel} disabled={busy}>
            Batal
          </Button>
          <Button
            variant="danger"
            onClick={onConfirm}
            loading={busy}
            disabled={Boolean(account?.isPrimaryAdmin)}
          >
            Hapus akun
          </Button>
        </div>
      </div>
    </Modal>
  );
}

type InternalRole = 'staff' | 'courier' | 'owner';

const emptyCreateForm = {
  name: '',
  email: '',
  phone: '',
  password: '',
  confirmPassword: '',
  role: 'staff' as InternalRole,
};

export function CreateAccountDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { toast } = useToast();
  const [form, setForm] = useState(emptyCreateForm);
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [details, setDetails] = useState<Array<{ field: string; message: string }>>([]);

  useEffect(() => {
    if (!open) return;
    setForm(emptyCreateForm);
    setShowPassword(false);
    setBusy(false);
    setError(null);
    setDetails([]);
  }, [open]);

  const update = (field: keyof typeof emptyCreateForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setError(null);
    setDetails((current) => current.filter((detail) => detail.field !== field));
  };

  const fieldError = (field: string) => details.find((detail) => detail.field === field)?.message;

  const close = () => {
    if (!busy) onClose();
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    if (form.password !== form.confirmPassword) {
      setError('Konfirmasi password tidak cocok.');
      return;
    }

    setBusy(true);
    setError(null);
    setDetails([]);
    try {
      await api.post('/admin/accounts', {
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || undefined,
        password: form.password,
        role: form.role,
      });
      const label = form.role === 'staff' ? 'Staff' : form.role === 'courier' ? 'Kurir' : 'Owner';
      toast(`Akun ${label} berhasil dibuat`);
      onCreated();
      onClose();
    } catch (caught) {
      if (caught instanceof ApiError) {
        setError(caught.message);
        setDetails(caught.details ?? []);
      } else {
        setError('Gagal membuat akun');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title="Tambah akun internal"
      description="Buat akun untuk staff, kurir, atau owner. Akun administrator dikelola secara terpisah."
      size="md"
    >
      <form className="space-y-4" onSubmit={submit}>
        {error && (
          <div role="alert" className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nama lengkap" htmlFor="create-account-name" error={fieldError('name')} required>
            <Input
              id="create-account-name"
              value={form.name}
              onChange={(event) => update('name', event.target.value)}
              placeholder="Nama pengguna"
              autoComplete="off"
              required
              minLength={2}
            />
          </Field>
          <Field label="Email" htmlFor="create-account-email" error={fieldError('email')} required>
            <Input
              id="create-account-email"
              type="email"
              value={form.email}
              onChange={(event) => update('email', event.target.value)}
              placeholder="nama@lrcmis.id"
              autoComplete="off"
              required
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nomor telepon" htmlFor="create-account-phone" error={fieldError('phone')} hint="Opsional, format 08xx">
            <Input
              id="create-account-phone"
              type="tel"
              value={form.phone}
              onChange={(event) => update('phone', event.target.value)}
              placeholder="081234567890"
              autoComplete="off"
              pattern="(\+?62|0)[0-9]{8,14}"
              title="Nomor telepon tidak valid (contoh: 081234567890)"
            />
          </Field>
          <Field label="Peran" htmlFor="create-account-role" error={fieldError('role')} required>
            <Select
              id="create-account-role"
              value={form.role}
              onChange={(event) => update('role', event.target.value)}
            >
              <option value="staff">Staff</option>
              <option value="courier">Kurir</option>
              <option value="owner">Owner</option>
            </Select>
          </Field>
        </div>

        <Field
          label="Password awal"
          htmlFor="create-account-password"
          error={fieldError('password')}
          hint="Minimal 8 karakter, mengandung huruf dan angka"
          required
        >
          <div className="relative">
            <Input
              id="create-account-password"
              type={showPassword ? 'text' : 'password'}
              value={form.password}
              onChange={(event) => update('password', event.target.value)}
              placeholder="Buat password awal"
              autoComplete="new-password"
              className="pr-11"
              required
              minLength={8}
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-ink-400 hover:bg-ink-50 hover:text-ink-700"
              aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </Field>

        <Field
          label="Konfirmasi password"
          htmlFor="create-account-confirm-password"
          required
        >
          <Input
            id="create-account-confirm-password"
            type={showPassword ? 'text' : 'password'}
            value={form.confirmPassword}
            onChange={(event) => update('confirmPassword', event.target.value)}
            placeholder="Ulangi password awal"
            autoComplete="new-password"
            required
            minLength={8}
          />
        </Field>

        <p className="rounded-xl border border-brand-100 bg-brand-50/70 px-4 py-3 text-xs leading-relaxed text-brand-800">
          Sampaikan email dan password awal kepada pengguna. Mereka dapat mengganti password melalui halaman Profil
          setelah masuk.
        </p>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={close} disabled={busy}>
            Batal
          </Button>
          <Button type="submit" loading={busy} icon={<UserPlus className="h-4 w-4" />}>
            Buat akun
          </Button>
        </div>
      </form>
    </Modal>
  );
}

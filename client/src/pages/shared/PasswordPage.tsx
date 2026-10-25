import { useState } from 'react';
import { KeyRound, LockKeyhole } from 'lucide-react';
import { Button, Card, Input, PageHeader } from '../../components/ui';
import { api, ApiError } from '../../lib/api';
import { useToast } from '../../lib/toast';

export function PasswordPage() {
  const { toast } = useToast();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (newPassword.length < 8 || !/[A-Za-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      setError('Password baru minimal 8 karakter dan harus mengandung huruf serta angka.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Konfirmasi password baru tidak sama.');
      return;
    }
    setBusy(true);
    try {
      await api.patch('/users/me/password', { currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast('Password berhasil diubah');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal mengubah password');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        eyebrow="Keamanan akun"
        title="Ubah password"
        description="Gunakan password yang kuat dan unik. Password lama tetap diperlukan sebagai verifikasi."
      />
      <Card className="p-5 sm:p-6">
        <div className="mb-5 flex items-start gap-3 rounded-xl border border-brand-100 bg-brand-50/70 p-4 text-sm text-brand-900">
          <KeyRound className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <p>
            Jika Anda baru menerima password awal dari administrator, segera ganti dengan password pribadi
            yang tidak dibagikan kepada siapa pun.
          </p>
        </div>
        <form onSubmit={submit} className="space-y-4">
          {error && (
            <div role="alert" className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}
          <div>
            <label htmlFor="current-password" className="mb-1.5 block text-sm font-semibold text-ink-800">
              Password saat ini
            </label>
            <Input
              id="current-password"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              required
            />
          </div>
          <div>
            <label htmlFor="new-password" className="mb-1.5 block text-sm font-semibold text-ink-800">
              Password baru
            </label>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              required
            />
            <p className="mt-1.5 text-xs text-ink-400">Minimal 8 karakter, mengandung huruf dan angka.</p>
          </div>
          <div>
            <label htmlFor="confirm-password" className="mb-1.5 block text-sm font-semibold text-ink-800">
              Ulangi password baru
            </label>
            <Input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
            />
          </div>
          <div className="flex justify-end">
            <Button type="submit" loading={busy} icon={<LockKeyhole className="h-4 w-4" />}>
              Simpan password
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

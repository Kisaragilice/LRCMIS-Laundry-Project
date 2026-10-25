import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { KeyRound, Mail } from 'lucide-react';
import { AuthShell } from './AuthShell';
import { Button, Field, Input } from '../../components/ui';
import { Note } from '../../components/common';
import { api, ApiError } from '../../lib/api';
import { fieldErrors, forgotPasswordSchema } from '../../lib/validation';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [result, setResult] = useState<{ message: string; token?: string | null } | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);
    setResult(null);
    const parsed = forgotPasswordSchema.safeParse({ email });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});
    setLoading(true);
    try {
      const response = await api.post<{ message: string; token: string | null }>('/auth/forgot-password', parsed.data);
      setResult(response);
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : 'Tidak dapat terhubung ke server.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Lupa password"
      description="Masukkan email akun Anda. Jika terdaftar, kami akan mengirim tautan untuk membuat password baru yang berlaku selama satu jam."
      footer={
        <span>
          Ingat password?{' '}
          <Link to="/login" className="font-bold text-brand-700 hover:text-brand-900">
            Kembali masuk
          </Link>
        </span>
      }
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        {formError && (
          <div role="alert" className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
            {formError}
          </div>
        )}
        <Field label="Email terdaftar" htmlFor="email" error={errors.email} required>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="nama@email.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </Field>
        <Button type="submit" className="w-full" size="lg" loading={loading} icon={<Mail className="h-4 w-4" />}>
          Kirim tautan reset
        </Button>
      </form>

      {result && (
        <div className="mt-6 space-y-3">
          <Note tone="success">{result.message}</Note>
          {result.token && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-amber-800">
                <KeyRound className="h-4 w-4" /> Mode pengembangan
              </p>
              <p className="mt-1 text-xs leading-relaxed text-amber-800/80">
                Token ditampilkan karena <code>EXPOSE_RESET_TOKEN</code> aktif di lingkungan development. Di produksi,
                token hanya dikirim melalui email dan tidak boleh ditampilkan di browser.
              </p>
              <p className="mt-2 break-all rounded-lg bg-white/70 px-3 py-2 font-mono text-[11px] text-amber-900">
                {result.token}
              </p>
              <Link to={`/reset-password?token=${encodeURIComponent(result.token)}`} className="mt-3 inline-block">
                <Button size="sm" variant="outline">
                  Lanjut reset password
                </Button>
              </Link>
            </div>
          )}
        </div>
      )}
    </AuthShell>
  );
}

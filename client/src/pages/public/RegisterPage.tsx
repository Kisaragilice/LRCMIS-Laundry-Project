import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, UserPlus } from 'lucide-react';
import { AuthShell } from './AuthShell';
import { Button, Field, Input } from '../../components/ui';
import { useAuth, dashboardPathFor } from '../../lib/auth';
import { ApiError } from '../../lib/api';
import { fieldErrors, registerSchema } from '../../lib/validation';

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', confirmPassword: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const update = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);
    const parsed = registerSchema.safeParse(form);
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});
    setLoading(true);
    try {
      const user = await register({
        name: parsed.data.name,
        email: parsed.data.email,
        password: parsed.data.password,
        phone: parsed.data.phone || undefined,
      });
      navigate(dashboardPathFor(user.roles), { replace: true });
    } catch (error) {
      if (error instanceof ApiError) {
        setFormError(error.message);
        if (error.details) {
          setErrors(Object.fromEntries(error.details.map((detail) => [detail.field, detail.message])));
        }
      } else {
        setFormError('Tidak dapat terhubung ke server. Pastikan backend berjalan.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Buat akun pelanggan"
      description="Daftar gratis untuk mulai membuat reservasi dan melacak pesanan."
      footer={
        <span>
          Sudah punya akun?{' '}
          <Link to="/login" className="font-bold text-brand-700 hover:text-brand-900">
            Masuk di sini
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
        <Field label="Nama lengkap" htmlFor="name" error={errors.name} required>
          <Input
            id="name"
            autoComplete="name"
            placeholder="Contoh: Budi Santoso"
            value={form.name}
            onChange={(event) => update('name', event.target.value)}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Email" htmlFor="email" error={errors.email} required>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="nama@email.com"
              value={form.email}
              onChange={(event) => update('email', event.target.value)}
            />
          </Field>
          <Field label="Nomor telepon" htmlFor="phone" error={errors.phone} hint="Opsional, format 08xx">
            <Input
              id="phone"
              type="tel"
              autoComplete="tel"
              placeholder="081234567890"
              value={form.phone}
              onChange={(event) => update('phone', event.target.value)}
            />
          </Field>
        </div>
        <Field
          label="Password"
          htmlFor="password"
          error={errors.password}
          hint="Minimal 8 karakter, mengandung huruf dan angka"
          required
        >
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="Buat password"
              value={form.password}
              onChange={(event) => update('password', event.target.value)}
              className="pr-11"
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
        <Field label="Konfirmasi password" htmlFor="confirmPassword" error={errors.confirmPassword} required>
          <Input
            id="confirmPassword"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            placeholder="Ulangi password"
            value={form.confirmPassword}
            onChange={(event) => update('confirmPassword', event.target.value)}
          />
        </Field>
        <Button type="submit" className="w-full" size="lg" loading={loading} icon={<UserPlus className="h-4 w-4" />}>
          Daftar
        </Button>
        <p className="text-center text-xs leading-relaxed text-ink-400">
          Dengan mendaftar, Anda menyetujui kebijakan operasional dan pemrosesan data yang diperlukan untuk layanan
          laundry.
        </p>
      </form>
    </AuthShell>
  );
}

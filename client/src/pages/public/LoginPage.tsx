import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, LogIn } from 'lucide-react';
import { AuthShell } from './AuthShell';
import { Button, Field, Input } from '../../components/ui';
import { useAuth, dashboardPathFor } from '../../lib/auth';
import { ApiError } from '../../lib/api';
import { fieldErrors, loginSchema } from '../../lib/validation';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);
    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});
    setLoading(true);
    try {
      const user = await login(parsed.data.email, parsed.data.password);
      navigate(from || dashboardPathFor(user.roles), { replace: true });
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
      title="Masuk ke akun Anda"
      description="Gunakan email dan password yang terdaftar untuk melanjutkan."
      footer={
        <span>
          Belum punya akun?{' '}
          <Link to="/register" className="font-bold text-brand-700 hover:text-brand-900">
            Daftar gratis
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
        <Field label="Email" htmlFor="email" error={errors.email} required>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="nama@email.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </Field>
        <Field label="Password" htmlFor="password" error={errors.password} required>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="Masukkan password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
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
        <div className="flex items-center justify-between text-sm">
          <span />
          <Link to="/lupa-password" className="font-semibold text-brand-700 hover:text-brand-900">
            Lupa password?
          </Link>
        </div>
        <Button type="submit" className="w-full" size="lg" loading={loading} icon={<LogIn className="h-4 w-4" />}>
          Masuk
        </Button>
      </form>
    </AuthShell>
  );
}

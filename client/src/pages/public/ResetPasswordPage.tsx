import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { AuthShell } from './AuthShell';
import { Button, Field, Input } from '../../components/ui';
import { api, ApiError } from '../../lib/api';
import { useToast } from '../../lib/toast';
import { fieldErrors, resetPasswordSchema } from '../../lib/validation';

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [token, setToken] = useState(params.get('token') ?? '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);
    const parsed = resetPasswordSchema.safeParse({ token, password, confirmPassword });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});
    setLoading(true);
    try {
      const result = await api.post<{ message: string }>('/auth/reset-password', {
        token: parsed.data.token,
        password: parsed.data.password,
      });
      toast(result.message);
      navigate('/login', { replace: true });
    } catch (error) {
      if (error instanceof ApiError) {
        setFormError(error.message);
        if (error.details) {
          setErrors(Object.fromEntries(error.details.map((detail) => [detail.field, detail.message])));
        }
      } else {
        setFormError('Tidak dapat terhubung ke server.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Atur password baru"
      description="Tautan dari email akan mengisi token secara otomatis. Anda juga dapat menempelkannya secara manual."
      footer={
        <span>
          Butuh token baru?{' '}
          <Link to="/lupa-password" className="font-bold text-brand-700 hover:text-brand-900">
            Minta reset ulang
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
        <Field label="Token reset" htmlFor="token" error={errors.token} required>
          <Input
            id="token"
            value={token}
            onChange={(event) => setToken(event.target.value)}
            placeholder="Tempel token di sini"
            autoComplete="off"
          />
        </Field>
        <Field
          label="Password baru"
          htmlFor="password"
          error={errors.password}
          hint="Minimal 8 karakter, mengandung huruf dan angka"
          required
        >
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </Field>
        <Field label="Konfirmasi password baru" htmlFor="confirmPassword" error={errors.confirmPassword} required>
          <Input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
          />
        </Field>
        <Button type="submit" className="w-full" size="lg" loading={loading} icon={<ShieldCheck className="h-4 w-4" />}>
          Simpan password baru
        </Button>
      </form>
    </AuthShell>
  );
}

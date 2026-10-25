import {
  useEffect,
  useId,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Check, ChevronLeft, ChevronRight, Inbox, Loader2, X } from 'lucide-react';
import { badgeToneForStatus } from '../lib/format';

export function cn(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ');
}

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'soft' | 'light' | 'ghostLight';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  className,
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60',
        variant === 'primary' && 'bg-brand-600 text-white shadow-sm shadow-brand-600/20 hover:bg-brand-700 active:bg-brand-800',
        variant === 'secondary' && 'bg-sand-100 text-ink-800 hover:bg-sand-200',
        variant === 'outline' && 'border border-ink-200 bg-white text-ink-800 hover:border-brand-300 hover:bg-brand-50/60 hover:text-brand-800',
        variant === 'ghost' && 'text-ink-600 hover:bg-ink-100 hover:text-ink-900',
        variant === 'danger' && 'bg-red-600 text-white hover:bg-red-700',
        variant === 'soft' && 'bg-brand-50 text-brand-700 hover:bg-brand-100',
        variant === 'light' && 'bg-white text-brand-700 shadow-sm hover:bg-brand-50',
        variant === 'ghostLight' && 'border border-white/30 bg-white/5 text-white hover:bg-white/15',
        size === 'sm' && 'px-3 py-1.5 text-xs',
        size === 'md' && 'px-4 py-2.5 text-sm',
        size === 'lg' && 'px-6 py-3 text-base',
        className,
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      {children}
    </button>
  );
}

export function Card({ className, children, ...props }: { className?: string; children: ReactNode; onClick?: () => void }) {
  const hasCustomBackground = className?.split(/\s+/).some((value) => value.startsWith('bg-'));
  return (
    <div
      className={cn('min-w-0 rounded-2xl border border-ink-100 shadow-card', !hasCustomBackground && 'bg-white', className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function SectionTitle({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-wrap items-end justify-between gap-3', className)}>
      <div>
        <h2 className="text-lg font-bold text-ink-950">{title}</h2>
        {description && <p className="mt-1 text-sm text-ink-500">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div>
        {eyebrow && <p className="mb-1 text-xs font-bold uppercase tracking-[0.16em] text-brand-700">{eyebrow}</p>}
        <h1 className="text-2xl font-extrabold tracking-tight text-ink-950 sm:text-3xl">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-500">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

type Tone = 'green' | 'red' | 'amber' | 'blue' | 'slate' | 'brand';
export function Badge({ tone = 'slate', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide',
        tone === 'green' && 'bg-emerald-50 text-emerald-700',
        tone === 'red' && 'bg-red-50 text-red-700',
        tone === 'amber' && 'bg-amber-50 text-amber-700',
        tone === 'blue' && 'bg-sky-50 text-sky-700',
        tone === 'slate' && 'bg-ink-100 text-ink-600',
        tone === 'brand' && 'bg-brand-50 text-brand-800',
        className,
      )}
    >
      {children}
    </span>
  );
}

export function StatusBadge({ status, label }: { status: string; label: string }) {
  const tone = badgeToneForStatus(status) as Tone;
  const dotTone: Record<string, string> = {
    green: 'bg-emerald-500',
    red: 'bg-red-500',
    amber: 'bg-amber-500',
    blue: 'bg-sky-500',
    slate: 'bg-ink-400',
    brand: 'bg-brand-500',
  };
  return (
    <Badge tone={tone}>
      <span className={cn('h-1.5 w-1.5 rounded-full', dotTone[tone])} aria-hidden="true" />
      {label}
    </Badge>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = 'brand',
  to,
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  tone?: 'brand' | 'sand' | 'blue' | 'rose' | 'dark' | 'teal';
  to?: string;
  className?: string;
}) {
  const dark = tone === 'dark';
  const content = (
    <div
      className={cn(
        'relative flex h-full items-start justify-between gap-3 overflow-hidden rounded-2xl border p-5 shadow-card transition',
        dark
          ? 'border-brand-800 bg-gradient-to-br from-brand-700 via-brand-800 to-brand-950 text-white'
          : 'border-ink-100 bg-white hover:border-brand-200 hover:shadow-soft',
        to && 'group',
        className,
      )}
    >
      {dark && <div className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full bg-white/10 blur-2xl" />}
      <div className="relative min-w-0">
        <p className={cn('text-[11px] font-bold uppercase tracking-[0.14em]', dark ? 'text-brand-100/80' : 'text-ink-400')}>
          {label}
        </p>
        <p className={cn('mt-2 text-2xl font-extrabold tracking-tight', dark ? 'text-white' : 'text-ink-950')}>{value}</p>
        {hint && <p className={cn('mt-1.5 text-xs leading-relaxed', dark ? 'text-brand-100/75' : 'text-ink-500')}>{hint}</p>}
      </div>
      {icon && (
        <div
          className={cn(
            'relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
            tone === 'brand' && 'bg-brand-50 text-brand-700',
            tone === 'teal' && 'bg-accent-50 text-accent-700',
            tone === 'sand' && 'bg-sand-100 text-sand-700',
            tone === 'blue' && 'bg-sky-50 text-sky-700',
            tone === 'rose' && 'bg-rose-50 text-rose-600',
            dark && 'bg-white/10 text-white',
          )}
        >
          {icon}
        </div>
      )}
      {to && (
        <span className="absolute bottom-4 right-4 text-ink-300 transition group-hover:translate-x-0.5 group-hover:text-brand-500" aria-hidden="true">
          →
        </span>
      )}
    </div>
  );

  return to ? (
    <Link to={to} className="block h-full rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2">
      {content}
    </Link>
  ) : (
    content
  );
}

export function Field({
  label,
  htmlFor,
  error,
  hint,
  required,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  error?: string | null;
  hint?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={htmlFor} className="block text-sm font-semibold text-ink-800">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-ink-400">{hint}</p>}
      {error && <p className="text-xs font-medium text-red-600">{error}</p>}
    </div>
  );
}

const controlClass =
  'block w-full rounded-xl border border-ink-200 bg-white px-3.5 py-2.5 text-sm text-ink-900 placeholder:text-ink-300 shadow-sm transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100 disabled:bg-ink-50 disabled:text-ink-400';

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(controlClass, className)} {...props} />;
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(controlClass, 'min-h-24 resize-y', className)} {...props} />;
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(controlClass, 'pr-8', className)} {...props}>
      {children}
    </select>
  );
}

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  size = 'md',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}) {
  const titleId = useId();
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-ink-950/45 p-0 backdrop-blur-sm sm:items-center sm:p-6">
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Tutup dialog" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(
          'relative z-10 max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white p-6 shadow-2xl sm:rounded-3xl',
          size === 'sm' && 'sm:max-w-md',
          size === 'md' && 'sm:max-w-2xl',
          size === 'lg' && 'sm:max-w-4xl',
        )}
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 id={titleId} className="text-xl font-bold text-ink-950">
              {title}
            </h2>
            {description && <p className="mt-1 text-sm text-ink-500">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="rounded-lg p-2 text-ink-400 transition hover:bg-ink-100 hover:text-ink-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('h-5 w-5 animate-spin text-brand-600', className)} />;
}

export function LoadingState({ label = 'Memuat data...' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-ink-200 bg-white/60 py-16 text-sm text-ink-500">
      <Spinner className="h-8 w-8" />
      {label}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-red-100 bg-red-50/50 px-6 py-12 text-center">
      <AlertTriangle className="h-8 w-8 text-red-400" />
      <div>
        <p className="font-semibold text-red-800">Gagal memuat data</p>
        <p className="mt-1 max-w-md text-sm text-red-700/80">{message}</p>
      </div>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          Coba lagi
        </Button>
      )}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-ink-200 bg-white px-6 py-14 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-ink-50 text-ink-400">
        {icon ?? <Inbox className="h-6 w-6" />}
      </div>
      <p className="font-semibold text-ink-900">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-ink-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Pagination({
  page,
  totalPages,
  total,
  onChange,
}: {
  page: number;
  totalPages: number;
  total?: number;
  onChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink-100 pt-4 text-sm text-ink-500">
      <p>
        Halaman {page} dari {totalPages}
        {typeof total === 'number' ? ` · ` + total + ` data` : ''}
      </p>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onChange(page - 1)} icon={<ChevronLeft className="h-4 w-4" />}>
          Sebelumnya
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onChange(page + 1)}
          icon={<ChevronRight className="h-4 w-4" />}
        >
          Berikutnya
        </Button>
      </div>
    </div>
  );
}

export function Avatar({ name, className }: { name: string; className?: string }) {
  const initials = name
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
  return (
    <div className={cn('flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-800', className)}>
      {initials}
    </div>
  );
}

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: Array<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex gap-1 overflow-x-auto rounded-xl bg-ink-100 p-1" role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.value}
          type="button"
          role="tab"
          aria-selected={value === tab.value}
          onClick={() => onChange(tab.value)}
          className={cn(
            'whitespace-nowrap rounded-lg px-3.5 py-2 text-sm font-semibold transition',
            value === tab.value ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-500 hover:text-ink-800',
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export function ProgressSteps({ steps, current }: { steps: string[]; current: number }) {
  return (
    <div>
      <div className="sm:hidden">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-bold text-ink-900">{steps[current]}</p>
          <p className="text-xs font-semibold text-brand-700">
            {current + 1} dari {steps.length}
          </p>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink-100">
          <div
            className="h-full rounded-full bg-gradient-to-r from-brand-500 to-accent-500 transition-all"
            style={{ width: `${Math.round(((current + 1) / steps.length) * 100)}%` }}
          />
        </div>
        <div className="mt-1.5 flex justify-between text-[10px] font-semibold text-ink-400">
          <span>{steps[0]}</span>
          <span>{steps[steps.length - 1]}</span>
        </div>
      </div>
      <ol className="hidden items-center gap-0 sm:flex">
      {steps.map((step, index) => {
        const state = index < current ? 'done' : index === current ? 'active' : 'upcoming';
        return (
          <li key={step} className="flex items-center gap-2 sm:flex-1 sm:gap-3">
            <span
              className={cn(
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold transition',
                state === 'done' && 'bg-brand-600 text-white',
                state === 'active' && 'bg-brand-600 text-white ring-4 ring-brand-100',
                state === 'upcoming' && 'bg-sand-100 text-ink-400',
              )}
              aria-current={state === 'active' ? 'step' : undefined}
            >
              {state === 'done' ? <Check className="h-4 w-4" aria-hidden="true" /> : index + 1}
            </span>
            <span
              className={cn(
                'whitespace-nowrap text-xs font-semibold sm:whitespace-normal',
                state === 'upcoming' ? 'text-ink-400' : 'text-ink-800',
              )}
            >
              {step}
            </span>
            {index < steps.length - 1 && (
              <span
                className={cn('mx-1 hidden h-px flex-1 sm:block', index < current ? 'bg-brand-400' : 'bg-ink-200')}
                aria-hidden="true"
              />
            )}
          </li>
        );
      })}
      </ol>
    </div>
  );
}

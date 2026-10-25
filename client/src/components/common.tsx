import { Link } from 'react-router-dom';
import { Check, Star } from 'lucide-react';
import { cn } from './ui';
import { formatDateTime, orderStatusLabel } from '../lib/format';
import type { TimelineEntry } from '../lib/types';

export function Brand({ compact = false, inverted = false }: { compact?: boolean; inverted?: boolean }) {
  return (
    <Link to="/" className="group inline-flex items-center gap-2.5" aria-label="LRCMIS beranda">
      <span
        className={cn(
          'flex h-10 w-10 items-center justify-center rounded-[14px] text-base font-black shadow-sm transition group-hover:-rotate-3',
          inverted ? 'bg-white text-brand-700' : 'bg-gradient-to-br from-brand-500 to-accent-500 text-white',
        )}
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true" fill="none">
          <path d="M5 8.5c0-2.5 1.9-4.5 4.2-4.5 1.6 0 3 1 3.7 2.4C13.6 5 15 4 16.6 4 19 4 21 6 21 8.5c0 4.3-4.6 7.1-8.1 10.2L12 19.5l-.9-.8C7.6 15.6 3 12.8 3 8.5c0-.7.2-1.3.5-1.9" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M8.3 16.8c1.2-1.1 2.3-2.3 3.3-3.5M10.2 9.4c.5.9.7 1.9.7 2.9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity=".5" />
        </svg>
      </span>
      {!compact && (
        <span className="leading-tight">
          <span className={cn('block text-[19px] font-extrabold tracking-tight', inverted ? 'text-white' : 'text-ink-950')}>
            LRCMIS
          </span>
          <span className={cn('block text-[9px] font-bold uppercase tracking-[0.2em]', inverted ? 'text-brand-100/70' : 'text-ink-400')}>
           Tiara Laundry
          </span>
        </span>
      )}
    </Link>
  );
}

export function Stars({
  value,
  onChange,
  size = 'md',
  className,
}: {
  value: number;
  onChange?: (value: number) => void;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const dimension = size === 'sm' ? 'h-3.5 w-3.5' : size === 'lg' ? 'h-7 w-7' : 'h-5 w-5';
  return (
    <div className={cn('inline-flex items-center gap-0.5', className)} aria-label={`Rating ${value} dari 5`}>
      {[1, 2, 3, 4, 5].map((star) =>
        onChange ? (
          <button
            key={star}
            type="button"
            onClick={() => onChange(star)}
            className="rounded p-0.5 transition hover:scale-110"
            aria-label={`Beri ${star} bintang`}
          >
            <Star
              className={cn(dimension, star <= value ? 'fill-amber-400 text-amber-400' : 'text-ink-200')}
            />
          </button>
        ) : (
          <Star key={star} className={cn(dimension, star <= value ? 'fill-amber-400 text-amber-400' : 'text-ink-200')} />
        ),
      )}
    </div>
  );
}

export function Timeline({ entries }: { entries: TimelineEntry[] }) {
  if (entries.length === 0) {
    return <p className="text-sm text-ink-500">Belum ada riwayat status.</p>;
  }
  return (
    <ol className="relative space-y-5 border-l border-ink-200 pl-6">
      {entries.map((entry, index) => (
        <li key={entry.id} className="relative">
          <span
            className={cn(
              'absolute -left-[31px] top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full border-2 border-white',
              index === entries.length - 1 ? 'bg-brand-600 ring-4 ring-brand-100' : 'bg-ink-300',
            )}
          />
          <p className="text-sm font-semibold text-ink-900">
            {entry.oldStatus
              ? `${orderStatusLabel[entry.oldStatus] ?? entry.oldStatus} → ${orderStatusLabel[entry.newStatus] ?? entry.newStatus}`
              : orderStatusLabel[entry.newStatus] ?? entry.newStatus}
          </p>
          <p className="mt-0.5 text-xs text-ink-500">
            {formatDateTime(entry.createdAt)}
            {entry.changedBy ? ` · oleh ${entry.changedBy.name}` : ''}
          </p>
          {entry.notes && <p className="mt-1 rounded-lg bg-ink-50 px-3 py-2 text-xs text-ink-600">{entry.notes}</p>}
        </li>
      ))}
    </ol>
  );
}

export function OrderProgress({ status }: { status: string }) {
  const steps = [
    { key: 'received', label: 'Diterima' },
    { key: 'washing', label: 'Dicuci' },
    { key: 'drying', label: 'Dikeringkan' },
    { key: 'ironing', label: 'Disetrika' },
    { key: 'packaging', label: 'Dikemas' },
    { key: 'ready', label: status === 'delivering' ? 'Diantar' : 'Siap' },
    { key: 'completed', label: 'Selesai' },
  ];
  const order = ['pending', 'received', 'washing', 'drying', 'ironing', 'packaging', 'ready', 'delivering', 'completed', 'on_hold'];
  const normalized = status === 'delivering' ? 'ready' : status;
  const pending = status === 'pending';
  const current = Math.max(0, steps.findIndex((step) => step.key === normalized));
  const cancelled = status === 'cancelled';

  const percent = Math.round(((current + (cancelled || pending ? 0 : 1)) / steps.length) * 100);

  return (
    <div>
      <div className="sm:hidden">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-ink-400">Tahap saat ini</p>
          <p className={cn('text-sm font-bold', cancelled ? 'text-red-600' : 'text-brand-700')}>
            {cancelled ? 'Dibatalkan' : pending ? 'Menunggu diterima' : steps[current]?.label ?? status}
          </p>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-ink-100">
          <div
            className={cn(
              'h-full rounded-full transition-all',
              cancelled ? 'bg-red-400' : 'bg-gradient-to-r from-brand-500 to-accent-500',
            )}
            style={{ width: `${cancelled ? 100 : pending ? 0 : Math.max(8, percent)}%` }}
          />
        </div>
        <div className="mt-1.5 flex justify-between text-[10px] font-semibold text-ink-400">
          <span>Diterima</span>
          <span>
            {cancelled ? 'Dibatalkan' : pending ? 'Belum diproses' : `Tahap ${Math.min(current + 1, steps.length)} dari ${steps.length}`}
          </span>
          <span>Selesai</span>
        </div>
      </div>

      <ol
        className="hidden w-full items-start gap-0 sm:flex"
        aria-label={`Tahap pesanan: ${
          cancelled ? 'Dibatalkan' : pending ? 'Menunggu diterima' : steps[current]?.label ?? status
        }`}
      >
        {steps.map((step, index) => {
          const done = !cancelled && !pending && index < current;
          const active = !cancelled && !pending && index === current;
          return (
            <li key={step.key} className="flex min-w-[74px] flex-1 flex-col items-center text-center sm:min-w-0">
              <div className="flex w-full items-center">
                <span className={cn('h-0.5 flex-1', index === 0 ? 'bg-transparent' : done || active ? 'bg-brand-400' : 'bg-ink-200')} aria-hidden="true" />
                <span
                  className={cn(
                    'mx-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-[10px] font-bold transition',
                    done && 'border-brand-500 bg-brand-500 text-white',
                    active && 'border-brand-500 bg-white text-brand-700 ring-4 ring-brand-100',
                    !done && !active && 'border-ink-200 bg-white text-ink-400',
                    cancelled && 'border-red-200 bg-red-50 text-red-500',
                  )}
                  aria-current={active ? 'step' : undefined}
                >
                  {done ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : index + 1}
                </span>
                <span className={cn('h-0.5 flex-1', index === steps.length - 1 ? 'bg-transparent' : done ? 'bg-brand-400' : 'bg-ink-200')} aria-hidden="true" />
              </div>
              <span className={cn('mt-2 text-[10px] font-semibold leading-tight sm:text-[11px]', active || done ? 'text-ink-800' : 'text-ink-400')}>
                {step.label}
              </span>
            </li>
          );
        })}
      </ol>
      {order.includes(status) && status !== 'pending' && (
        <p className="mt-3 text-xs text-ink-500">
          {cancelled
            ? 'Pesanan dibatalkan. Hubungi admin bila membutuhkan informasi lebih lanjut.'
            : status === 'on_hold'
              ? 'Pesanan sedang ditunda oleh tim operasional.'
              : 'Status diperbarui oleh tim operasional dan tercatat pada timeline pesanan.'}
        </p>
      )}
    </div>
  );
}

export function DataTable({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('min-w-0 max-w-full overflow-x-auto rounded-2xl border border-ink-100 bg-white', className)}>
      <table className="min-w-full divide-y divide-ink-100 text-left text-sm">{children}</table>
    </div>
  );
}

export function Th({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <th className={cn('whitespace-nowrap px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-ink-500', className)}>
      {children}
    </th>
  );
}

export function Td({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <td className={cn('px-4 py-3.5 align-middle text-ink-700', className)}>{children}</td>;
}

export function KeyValue({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-ink-100 py-2.5 last:border-0">
      <dt className="text-sm text-ink-500">{label}</dt>
      <dd className="text-right text-sm font-semibold text-ink-900">{value}</dd>
    </div>
  );
}

export function Note({ children, tone = 'info' }: { children: React.ReactNode; tone?: 'info' | 'warning' | 'success' }) {
  return (
    <div
      className={cn(
        'rounded-xl border px-4 py-3 text-sm leading-relaxed',
        tone === 'info' && 'border-sky-100 bg-sky-50 text-sky-800',
        tone === 'warning' && 'border-amber-100 bg-amber-50 text-amber-800',
        tone === 'success' && 'border-emerald-100 bg-emerald-50 text-emerald-800',
      )}
    >
      {children}
    </div>
  );
}

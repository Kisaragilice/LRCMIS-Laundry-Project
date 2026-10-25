import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { Brand } from '../../components/common';

export function AuthShell({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="mx-auto grid max-w-7xl gap-10 px-4 py-10 sm:px-6 lg:min-h-[calc(100vh-68px)] lg:grid-cols-[1fr_0.95fr] lg:items-center lg:px-8">
      <div className="hidden lg:block">
        <div className="relative overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-brand-700 via-brand-800 to-brand-950 p-10 text-white shadow-soft">
          <div className="pointer-events-none absolute inset-0 bg-soft-grid bg-grid opacity-[0.12]" aria-hidden="true" />
          <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-accent-400/20 blur-3xl" />
          <div className="absolute -bottom-20 left-10 h-56 w-56 rounded-full bg-brand-400/20 blur-3xl" />
          <div className="relative">
            <Brand inverted />
            <h2 className="mt-10 text-4xl font-extrabold leading-tight tracking-tight">
              Satu akun untuk semua kebutuhan laundry Anda.
            </h2>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-brand-100/75">
              Reservasi slot, pantau status produksi, kelola pembayaran, dan beri ulasan dari satu dashboard.
            </p>
            <ul className="mt-8 space-y-3 text-sm text-brand-100/85">
              {[
                'Jadwal antar/jemput yang dapat dipilih',
                'Timeline status pesanan transparan',
                'Riwayat pembayaran dan invoice',
                'Ulasan hanya dari pesanan selesai',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent-300" aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
            <div className="mt-10 rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-brand-200">Catatan</p>
              <p className="mt-1 text-sm leading-relaxed text-brand-100/70">
                Akun admin, staf, kurir, dan owner dikelola secara internal. Pendaftaran publik hanya membuat akun
                pelanggan.
              </p>
            </div>
          </div>
        </div>
      </div>
      <div className="mx-auto w-full max-w-md">
        <h1 className="text-3xl font-extrabold tracking-tight text-ink-950">{title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-500">{description}</p>
        <div className="mt-6">{children}</div>
        {footer && <div className="mt-6 text-sm text-ink-500">{footer}</div>}
        <p className="mt-8 text-center text-xs text-ink-400">
          <Link to="/" className="font-semibold text-ink-600 hover:text-brand-700">
            ← Kembali ke beranda
          </Link>
        </p>
      </div>
    </div>
  );
}

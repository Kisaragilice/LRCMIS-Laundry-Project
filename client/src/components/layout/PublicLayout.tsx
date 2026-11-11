import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowRight, CalendarCheck, Menu, X } from 'lucide-react';
import { Brand } from '../common';
import { Button, cn } from '../ui';
import { useAuth } from '../../lib/auth';
import { PageTransition } from '../motion/PageTransition';
import { smoothEase, springSnappy } from '../../lib/motion';

const navItems = [
  { to: '/', label: 'Beranda' },
  { to: '/layanan', label: 'Layanan' },
  { to: '/cara-kerja', label: 'Cara kerja' },
  { to: '/kontak', label: 'Kontak' },
];

export function PublicLayout() {
  const [open, setOpen] = useState(false);
  const { user, loading } = useAuth();
  const location = useLocation();

  useEffect(() => {
    setOpen(false);
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="sticky top-0 z-40 border-b border-ink-100/80 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex h-[68px] max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Brand />
          <nav className="hidden items-center gap-1 md:flex" aria-label="Navigasi utama">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  cn(
                    'relative rounded-lg px-3.5 py-2 text-sm font-semibold transition',
                    isActive ? 'text-brand-700' : 'text-ink-600 hover:text-ink-950',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    {item.label}
                    {isActive && (
                      <motion.span
                        layoutId="public-nav-underline"
                        className="absolute inset-x-3.5 -bottom-[23px] h-0.5 rounded-full bg-brand-600"
                        transition={springSnappy}
                      />
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </nav>
          <div className="hidden items-center gap-2 md:flex">
            {!loading && user ? (
              <Link to="/dashboard-redirect">
                <Button size="sm" icon={<ArrowRight className="h-4 w-4" />}>
                  Buka dashboard
                </Button>
              </Link>
            ) : (
              <>
                <Link to="/login" className="rounded-xl px-3.5 py-2 text-sm font-semibold text-ink-600 transition hover:bg-sand-50 hover:text-ink-950">
                  Masuk
                </Link>
                <Link to="/register">
                  <Button size="sm" icon={<CalendarCheck className="h-4 w-4" />}>
                    Reservasi sekarang
                  </Button>
                </Link>
              </>
            )}
          </div>
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="relative rounded-xl border border-ink-200 bg-white p-2 text-ink-700 transition-colors duration-200 hover:bg-sand-50 md:hidden"
            aria-label={open ? 'Tutup menu' : 'Buka menu'}
            aria-expanded={open}
            aria-controls="public-mobile-menu"
          >
            <span className="relative block h-5 w-5" aria-hidden="true">
              <motion.span
                initial={false}
                animate={{ opacity: open ? 0 : 1, rotate: open ? 90 : 0, scale: open ? 0.75 : 1 }}
                transition={{ duration: 0.2, ease: smoothEase }}
                className="absolute inset-0 flex items-center justify-center"
              >
                <Menu className="h-5 w-5" />
              </motion.span>
              <motion.span
                initial={false}
                animate={{ opacity: open ? 1 : 0, rotate: open ? 0 : -90, scale: open ? 1 : 0.75 }}
                transition={{ duration: 0.2, ease: smoothEase }}
                className="absolute inset-0 flex items-center justify-center"
              >
                <X className="h-5 w-5" />
              </motion.span>
            </span>
          </button>
        </div>
        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              key="public-mobile-menu"
              id="public-mobile-menu"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{
                height: { duration: 0.32, ease: smoothEase },
                opacity: { duration: 0.22, ease: smoothEase },
              }}
              className="overflow-hidden md:hidden"
            >
              <motion.div
                initial={{ y: -8, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -6, opacity: 0 }}
                transition={{ duration: 0.28, ease: smoothEase }}
                className="border-t border-ink-100 bg-white px-4 pb-5 pt-3"
              >
                <nav className="flex flex-col gap-1">
                  {navItems.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.to === '/'}
                      className={({ isActive }) =>
                        cn(
                          'rounded-xl px-3 py-2.5 text-sm font-semibold',
                          isActive ? 'bg-brand-50 text-brand-700' : 'text-ink-700 hover:bg-sand-50',
                        )
                      }
                    >
                      {item.label}
                    </NavLink>
                  ))}
                </nav>
                <div className="mt-4 flex gap-2">
                  {user ? (
                    <Link to="/dashboard-redirect" className="flex-1">
                      <Button className="w-full">Buka dashboard</Button>
                    </Link>
                  ) : (
                    <>
                      <Link to="/login" className="flex-1">
                        <Button variant="outline" className="w-full">
                          Masuk
                        </Button>
                      </Link>
                      <Link to="/register" className="flex-1">
                        <Button className="w-full">Daftar</Button>
                      </Link>
                    </>
                  )}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      <main className="flex-1">
        <PageTransition>
          <Outlet />
        </PageTransition>
      </main>

      <footer className="border-t border-ink-100 bg-sand-50">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1.2fr] lg:px-8">
          <div>
            <Brand />
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-ink-500">
              Pemesanan terjadwal dengan pelacakan status, pickup & delivery, serta pembayaran yang tercatat
              rapi untuk pelanggan dan tim operasional.
            </p>
            <p className="mt-4 text-xs font-semibold text-accent-700">Melayani setiap hari · 07.00–21.00 WIB · Bandar Lampung</p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.15em] text-ink-400">Menu</p>
            <ul className="mt-4 space-y-2 text-sm text-ink-600">
              {navItems.slice(1).map((item) => (
                <li key={item.to}>
                  <Link to={item.to} className="transition hover:text-brand-700">
                    {item.label}
                  </Link>
                </li>
              ))}
              <li>
                <Link to="/register" className="transition hover:text-brand-700">
                  Registrasi pelanggan
                </Link>
              </li>
              <li>
                <Link to="https://github.com/Kisaragilice" className="transition hover:text-brand-700">
                  Portfolio pengembang
                </Link>
              </li>
              <li>
                <Link to="https://raw.githubusercontent.com/Kisaragilice/LRCMIS-Laundry-Project/refs/heads/main/LICENSE" className="transition hover:text-brand-700">
                  Lisensi MIT
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.15em] text-ink-400">Akun</p>
            <ul className="mt-4 space-y-2 text-sm text-ink-600">
              <li><Link to="/login" className="transition hover:text-brand-700">Masuk</Link></li>
              <li><Link to="/dashboard-redirect" className="transition hover:text-brand-700">Dashboard</Link></li>
              <li><Link to="/lupa-password" className="transition hover:text-brand-700">Lupa password</Link></li>
              <li><Link to="/layanan" className="transition hover:text-brand-700">Harga layanan</Link></li>
            </ul>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.15em] text-ink-400">Kontak</p>
            <ul className="mt-4 space-y-2 text-sm text-ink-600">
              <li>Jl. Untung Suropati No.67, Kota Bandar Lampung</li>
              <li><a href="tel:+6289834204779" className="transition hover:text-brand-700">+62 896 3420 4779</a></li>
              <li><a href="mailto:tiaralaundry@lrcmis.my.id" className="transition hover:text-brand-700">tiaralaundry@lrcmis.my.id</a></li>
              <li className="text-xs text-ink-400">Senin–Minggu, 07.00–21.00 WIB</li>
            </ul>
          </div>
        </div>
        <div className="border-t border-ink-100 px-4 py-5 text-center text-xs text-ink-400">
          © {new Date().getFullYear()} LRCMIS MIT License. Laundry Reservation & Customer Management Information System.
        </div>
      </footer>
    </div>
  );
}

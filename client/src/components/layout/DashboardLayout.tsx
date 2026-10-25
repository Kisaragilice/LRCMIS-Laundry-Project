import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  BarChart3,
  Bell,
  CalendarCheck,
  CalendarDays,
  ChevronDown,
  ClipboardList,
  Clock,
  LayoutDashboard,
  LockKeyhole,
  LogOut,
  Menu,
  MessageCircle,
  MessageSquare,
  Package,
  Receipt,
  ScrollText,
  ShieldCheck,
  ShoppingBag,
  Star,
  Tag,
  Ticket,
  Trash2,
  Truck,
  User,
  Users,
  Wallet,
  X,
  type LucideIcon,
} from 'lucide-react';
import { Avatar, Badge, cn } from '../ui';
import { Brand } from '../common';
import { useAuth } from '../../lib/auth';
import { api } from '../../lib/api';
import { formatDateTime } from '../../lib/format';
import type { Notification } from '../../lib/types';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
}

const customerNav: NavItem[] = [
  { to: '/dashboard', label: 'Ringkasan', icon: LayoutDashboard, end: true },
  { to: '/reservasi/baru', label: 'Buat reservasi', icon: CalendarCheck },
  { to: '/reservasi', label: 'Reservasi saya', icon: CalendarDays },
  { to: '/pesanan', label: 'Pesanan', icon: ShoppingBag },
  { to: '/pembayaran', label: 'Pembayaran', icon: Wallet },
  { to: '/voucher', label: 'Voucher', icon: Ticket },
  { to: '/ulasan', label: 'Ulasan', icon: Star },
  { to: '/keluhan', label: 'Keluhan', icon: MessageSquare },
  { to: '/chat', label: 'Chat', icon: MessageCircle },
  { to: '/notifikasi', label: 'Notifikasi', icon: Bell },
  { to: '/profil', label: 'Profil & alamat', icon: User },
];

const adminNav: NavItem[] = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/chat', label: 'Chat', icon: MessageCircle },
  { to: '/admin/reservasi', label: 'Reservasi', icon: CalendarCheck },
  { to: '/admin/pesanan', label: 'Pesanan', icon: Package },
  { to: '/admin/pembayaran', label: 'Pembayaran', icon: Wallet },
  { to: '/admin/tugas', label: 'Tugas antar', icon: Truck },
  { to: '/admin/pelanggan', label: 'Pelanggan', icon: Users },
  { to: '/admin/akun', label: 'Kelola akun', icon: ShieldCheck },
  { to: '/admin/layanan', label: 'Layanan', icon: ClipboardList },
  { to: '/admin/slot', label: 'Slot waktu', icon: Clock },
  { to: '/admin/promo', label: 'Promosi', icon: Tag },
  { to: '/admin/keluhan', label: 'Keluhan', icon: MessageSquare },
  { to: '/admin/ulasan', label: 'Ulasan', icon: Star },
  { to: '/admin/laporan', label: 'Laporan', icon: BarChart3 },
  { to: '/admin/audit', label: 'Audit log', icon: ScrollText },
  { to: '/admin/reset-riwayat', label: 'Reset riwayat', icon: Trash2 },
  { to: '/profil', label: 'Profil & alamat', icon: User },
];

const ownerNav: NavItem[] = [
  { to: '/owner', label: 'Ringkasan bisnis', icon: LayoutDashboard, end: true },
  { to: '/owner/laporan', label: 'Laporan & ekspor', icon: BarChart3 },
];

const staffNav: NavItem[] = [
  { to: '/staff', label: 'Tugas produksi', icon: ClipboardList, end: true },
  { to: '/chat', label: 'Chat admin', icon: MessageCircle },
];

const courierNav: NavItem[] = [
  { to: '/courier', label: 'Tugas pengantaran', icon: Truck, end: true },
  { to: '/chat', label: 'Chat', icon: MessageCircle },
];

function navFor(roles: string[]): NavItem[] {
  if (roles.includes('admin')) return adminNav;
  if (roles.includes('owner')) return ownerNav;
  if (roles.includes('staff')) return staffNav;
  if (roles.includes('courier')) return courierNav;
  return customerNav;
}

function roleLabel(roles: string[]): string {
  if (roles.includes('admin')) return 'Administrator';
  if (roles.includes('owner')) return 'Owner';
  if (roles.includes('staff')) return 'Staff produksi';
  if (roles.includes('courier')) return 'Kurir';
  return 'Pelanggan';
}

export function DashboardLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [drawer, setDrawer] = useState(false);
  const [bell, setBell] = useState(false);
  const [menu, setMenu] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);
  const bellRef = useRef<HTMLDivElement>(null);

  const nav = navFor(user?.roles ?? []);
  const activeItem = [...nav]
    .sort((a, b) => b.to.length - a.to.length)
    .find((item) => (item.end ? location.pathname === item.to : location.pathname.startsWith(item.to)));

  useEffect(() => {
    setDrawer(false);
    setBell(false);
    setMenu(false);
  }, [location.pathname]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const result = await api.get<{ unread: number }>('/notifications/me/unread-count');
        if (active) setUnread(result.unread);
      } catch {
        /* silent */
      }
    };
    void load();
    const interval = window.setInterval(load, 60_000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (!bell) return;
    void api
      .get<{ rows: Notification[] }>('/notifications/me?limit=5')
      .then((result) => setNotifications(result.rows))
      .catch(() => setNotifications([]));
  }, [bell]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMenu(false);
      if (bellRef.current && !bellRef.current.contains(event.target as Node)) setBell(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  if (!user) return null;

  const sidebar = (
    <div className="flex h-full flex-col bg-[linear-gradient(180deg,#071226_0%,#0c1d3b_52%,#0d2b45_100%)]">
      <div className="flex h-[68px] items-center justify-between border-b border-white/10 px-5">
        <Brand inverted />
        <button
          type="button"
          onClick={() => setDrawer(false)}
          className="rounded-lg p-1.5 text-brand-100/70 hover:bg-white/10 lg:hidden"
          aria-label="Tutup menu"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-5 scrollbar-thin" aria-label="Navigasi dashboard">
        <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-white/35">Menu</p>
        {nav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              cn(
                'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-semibold transition',
                isActive
                  ? 'bg-brand-600 text-white shadow-[0_8px_20px_-12px_rgba(47,134,246,0.9)]'
                  : 'text-slate-300/80 hover:bg-white/[0.07] hover:text-white',
              )
            }
          >
            {({ isActive }) => (
              <>
                <item.icon className={cn('h-[18px] w-[18px] shrink-0', isActive ? 'text-white' : 'text-slate-400 group-hover:text-brand-200')} aria-hidden="true" />
                <span className="truncate">{item.label}</span>
                {item.to === '/notifikasi' && unread > 0 && (
                  <span className="ml-auto rounded-full bg-white/20 px-1.5 py-0.5 text-[10px] font-bold text-white">{unread}</span>
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-white/10 p-3">
        <div className="flex items-center gap-3 rounded-xl bg-white/[0.06] p-3">
          <Avatar name={user.name} className="bg-white/15 text-white" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white">{user.name}</p>
            <p className="truncate text-[11px] text-slate-400">{roleLabel(user.roles)}</p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white"
            aria-label="Keluar"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-sand-50">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[264px] lg:block">{sidebar}</aside>

      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-ink-950/55 backdrop-blur-sm"
            aria-label="Tutup menu"
            onClick={() => setDrawer(false)}
          />
          <aside className="relative h-full w-[286px] shadow-2xl animate-fade-in">{sidebar}</aside>
        </div>
      )}

      <div className="lg:pl-[264px]">
        <header className="sticky top-0 z-30 flex h-[68px] items-center gap-3 border-b border-ink-100 bg-white/85 px-4 backdrop-blur-xl sm:px-6">
          <button
            type="button"
            onClick={() => setDrawer(true)}
            className="rounded-xl border border-ink-200 bg-white p-2 text-ink-700 lg:hidden"
            aria-label="Buka menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-ink-900">{activeItem?.label ?? 'Dashboard'}</p>
            <p className="hidden truncate text-[11px] text-ink-400 sm:block">
              Selamat datang, {user.name.split(' ')[0]} · {roleLabel(user.roles)}
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Link to="/" className="hidden rounded-xl px-3 py-2 text-xs font-semibold text-ink-500 transition hover:bg-sand-50 hover:text-ink-900 sm:block">
              Lihat situs
            </Link>
            <div className="relative" ref={bellRef}>
              <button
                type="button"
                onClick={() => setBell((value) => !value)}
                className="relative rounded-xl border border-ink-200 bg-white p-2 text-ink-600 transition hover:border-brand-200 hover:text-brand-700"
                aria-label={`Notifikasi${unread ? `, ${unread} belum dibaca` : ''}`}
              >
                <Bell className="h-5 w-5" />
                {unread > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                    {unread > 9 ? '9+' : unread}
                  </span>
                )}
              </button>
              {bell && (
                <div className="absolute right-0 mt-2 w-[min(20rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-soft animate-fade-in">
                  <div className="flex items-center justify-between border-b border-ink-100 px-4 py-3">
                    <p className="text-sm font-bold text-ink-900">Notifikasi</p>
                    <Badge tone={unread ? 'amber' : 'slate'}>{unread} baru</Badge>
                  </div>
                  <div className="max-h-80 divide-y divide-ink-50 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <p className="px-4 py-8 text-center text-sm text-ink-400">Belum ada notifikasi.</p>
                    ) : (
                      notifications.map((item) => (
                        <div key={item.id} className="px-4 py-3">
                          <p className="text-sm font-semibold text-ink-900">{item.title}</p>
                          <p className="mt-0.5 line-clamp-2 text-xs text-ink-500">{item.message}</p>
                          <p className="mt-1 text-[10px] text-ink-400">{formatDateTime(item.createdAt)}</p>
                        </div>
                      ))
                    )}
                  </div>
                  <Link
                    to="/notifikasi"
                    onClick={() => setBell(false)}
                    className="block border-t border-ink-100 px-4 py-3 text-center text-xs font-bold text-brand-700 hover:bg-brand-50"
                  >
                    Lihat semua notifikasi
                  </Link>
                </div>
              )}
            </div>
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenu((value) => !value)}
                className="flex items-center gap-2 rounded-xl border border-ink-200 bg-white py-1.5 pl-1.5 pr-2.5 transition hover:border-brand-200"
                aria-expanded={menu}
              >
                <Avatar name={user.name} className="h-8 w-8" />
                <span className="hidden max-w-[120px] truncate text-xs font-semibold text-ink-800 sm:block">{user.name}</span>
                <ChevronDown className="hidden h-3.5 w-3.5 text-ink-400 sm:block" aria-hidden="true" />
              </button>
              {menu && (
                <div className="absolute right-0 mt-2 w-60 overflow-hidden rounded-2xl border border-ink-100 bg-white p-1.5 shadow-soft animate-fade-in">
                  <div className="px-3 py-2">
                    <p className="truncate text-sm font-semibold text-ink-900">{user.name}</p>
                    <p className="truncate text-xs text-ink-400">{user.email}</p>
                    <p className="mt-1.5 text-[10px] font-bold uppercase tracking-wider text-brand-600">{roleLabel(user.roles)}</p>
                  </div>
                  {(user.roles.includes('customer') || user.roles.includes('admin')) && (
                    <Link to="/profil" className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-ink-600 hover:bg-ink-50">
                      <User className="h-4 w-4" /> Profil saya
                    </Link>
                  )}
                  <Link to="/" className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-ink-600 hover:bg-ink-50">
                    <Receipt className="h-4 w-4" /> Situs publik
                  </Link>
                  <Link to="/ubah-password" className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-ink-600 hover:bg-ink-50">
                    <LockKeyhole className="h-4 w-4" /> Ubah password
                  </Link>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                  >
                    <LogOut className="h-4 w-4" /> Keluar
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

import { Link } from 'react-router-dom';
import { Home } from 'lucide-react';
import { Brand } from '../components/common';
import { Button } from '../components/ui';

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-sand-50 px-4 text-center">
      <Brand />
      <p className="font-display text-7xl font-semibold text-brand-900">404</p>
      <div>
        <h1 className="text-xl font-bold text-ink-950">Halaman tidak ditemukan</h1>
        <p className="mt-2 max-w-md text-sm text-ink-500">
          Tautan yang Anda buka mungkin sudah dipindahkan atau tidak pernah ada.
        </p>
      </div>
      <Link to="/">
        <Button icon={<Home className="h-4 w-4" />}>Kembali ke beranda</Button>
      </Link>
    </div>
  );
}

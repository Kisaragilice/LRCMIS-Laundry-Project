import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Brand } from '../common';
import { Spinner } from '../ui';
import { dashboardPathFor, useAuth } from '../../lib/auth';

export function FullPageLoader() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-sand-50">
      <Brand />
      <div className="flex items-center gap-2 text-sm text-ink-500">
        <Spinner /> Menyiapkan sesi...
      </div>
    </div>
  );
}

export function ProtectedRoute({ children, roles }: { children: ReactNode; roles?: string[] }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <FullPageLoader />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (roles && !roles.some((role) => user.roles.includes(role))) {
    return <Navigate to={dashboardPathFor(user.roles)} replace />;
  }
  return <>{children}</>;
}

export function DashboardRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <FullPageLoader />;
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={dashboardPathFor(user.roles)} replace />;
}

export function GuestOnly({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <FullPageLoader />;
  if (user) {
    const from = (location.state as { from?: string } | null)?.from;
    return <Navigate to={from || dashboardPathFor(user.roles)} replace />;
  }
  return <>{children}</>;
}

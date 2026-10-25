import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, ApiError } from './api';
import type { User } from './types';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (payload: { name: string; email: string; password: string; phone?: string }) => Promise<User>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  hasRole: (...roles: string[]) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function dashboardPathFor(roles: string[]): string {
  if (roles.includes('admin')) return '/admin';
  if (roles.includes('owner')) return '/owner';
  if (roles.includes('staff')) return '/staff';
  if (roles.includes('courier')) return '/courier';
  return '/dashboard';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await api.get<User>('/users/me');
      setUser(data);
    } catch (error) {
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
        setUser(null);
      } else {
        setUser(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = useCallback(async (email: string, password: string) => {
    const data = await api.post<{ user: User }>('/auth/login', { email, password });
    setUser(data.user);
    return data.user;
  }, []);

  const register = useCallback(
    async (payload: { name: string; email: string; password: string; phone?: string }) => {
      const data = await api.post<{ user: User }>('/auth/register', payload);
      setUser(data.user);
      return data.user;
    },
    [],
  );

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      setUser(null);
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      login,
      register,
      logout,
      refresh,
      hasRole: (...roles: string[]) => Boolean(user && user.roles.some((role) => roles.includes(role))),
    }),
    [user, loading, login, register, logout, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth harus dipakai di dalam AuthProvider');
  return context;
}

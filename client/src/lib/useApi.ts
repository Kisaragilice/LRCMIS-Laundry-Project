import { useCallback, useEffect, useState } from 'react';
import { api, ApiError, type ApiMeta } from './api';

export interface QueryState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  status: number | null;
  refetch: () => void;
  setData: (data: T | null) => void;
}

/** Minimal data-fetching hook with abort handling and manual refetch. */
export function useApi<T>(path: string | null, deps: unknown[] = []): QueryState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(Boolean(path));
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<number | null>(null);
  const [tick, setTick] = useState(0);

  const refetch = useCallback(() => setTick((value) => value + 1), []);

  useEffect(() => {
    if (!path) {
      setData(null);
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    setError(null);
    api
      .get<T>(path)
      .then((result) => {
        if (active) setData(result);
      })
      .catch((err: unknown) => {
        if (!active) return;
        if (err instanceof ApiError) {
          setError(err.message);
          setStatus(err.status);
        } else {
          setError('Tidak dapat terhubung ke server');
          setStatus(0);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, tick, ...deps]);

  return { data, loading, error, status, refetch, setData };
}

export function useAction() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = useCallback(async <T,>(action: () => Promise<T>): Promise<T | null> => {
    setLoading(true);
    setError(null);
    try {
      return await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);
  return { run, loading, error, setError };
}

export interface PagedState<T> {
  rows: T[];
  meta: ApiMeta | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

/** Data-fetching hook for paginated endpoints that return `{ data, meta }`. */
export function usePagedApi<T>(path: string | null, deps: unknown[] = []): PagedState<T> {
  const [rows, setRows] = useState<T[]>([]);
  const [meta, setMeta] = useState<ApiMeta | null>(null);
  const [loading, setLoading] = useState(Boolean(path));
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const refetch = useCallback(() => setTick((value) => value + 1), []);

  useEffect(() => {
    if (!path) {
      setRows([]);
      setMeta(null);
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    setError(null);
    api
      .getWithMeta<T[]>(path)
      .then((result) => {
        if (!active) return;
        setRows(result.data);
        setMeta(result.meta ?? null);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setError(err instanceof ApiError ? err.message : 'Tidak dapat terhubung ke server');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, tick, ...deps]);

  return { rows, meta, loading, error, refetch };
}

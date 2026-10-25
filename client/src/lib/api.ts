const API_BASE = import.meta.env.VITE_API_URL || '/api/v1';

export class ApiError extends Error {
  status: number;
  code: string;
  details?: Array<{ field: string; message: string }>;

  constructor(status: number, code: string, message: string, details?: Array<{ field: string; message: string }>) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function readCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

const RETRY_DELAYS_MS = [300, 900];
const RETRYABLE_STATUSES = new Set([500, 502, 503, 504]);

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

/**
 * Reads are safe to retry when the dev server or proxy is briefly restarting.
 * Mutations are never retried automatically to avoid duplicate writes.
 */
async function fetchWithRetry(input: string, init: RequestInit): Promise<Response> {
  const method = (init.method ?? 'GET').toUpperCase();
  const canRetry = method === 'GET' || method === 'HEAD';
  const attempts = canRetry ? RETRY_DELAYS_MS.length + 1 : 1;
  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(input, init);
      if (canRetry && RETRYABLE_STATUSES.has(response.status) && attempt < attempts - 1) {
        await delay(RETRY_DELAYS_MS[attempt]);
        continue;
      }
      return response;
    } catch (error) {
      lastError = error;
      if (!canRetry || attempt === attempts - 1) throw error;
      await delay(RETRY_DELAYS_MS[attempt]);
    }
  }

  throw lastError;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const csrf = readCookie('lrcmis_csrf');
  if (csrf) headers.set('X-CSRF-Token', csrf);

  const response = await fetchWithRetry(`${API_BASE}${path}`, {
    ...options,
    headers,
    credentials: 'include',
  });

  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await response.json() : null;

  if (!response.ok) {
    const error = payload?.error;
    throw new ApiError(
      response.status,
      error?.code ?? 'REQUEST_FAILED',
      error?.message ?? `Permintaan gagal (${response.status})`,
      error?.details,
    );
  }

  return (payload?.data ?? payload) as T;
}

export interface ApiMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

async function requestWithMeta<T>(path: string): Promise<{ data: T; meta?: ApiMeta }> {
  const headers = new Headers();
  const csrf = readCookie('lrcmis_csrf');
  if (csrf) headers.set('X-CSRF-Token', csrf);
  const response = await fetchWithRetry(`${API_BASE}${path}`, { headers, credentials: 'include' });
  const payload = await response.json();
  if (!response.ok) {
    throw new ApiError(response.status, payload?.error?.code ?? 'REQUEST_FAILED', payload?.error?.message ?? 'Permintaan gagal');
  }
  return { data: payload.data as T, meta: payload.meta as ApiMeta | undefined };
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  getWithMeta: <T>(path: string) => requestWithMeta<T>(path),
  post: <T>(path: string, body?: unknown, extraHeaders?: Record<string, string>) =>
    request<T>(path, {
      method: 'POST',
      body: body === undefined ? undefined : JSON.stringify(body),
      headers: extraHeaders,
    }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body: body === undefined ? undefined : JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
  download: async (path: string, filename: string) => {
    const headers = new Headers();
    const csrf = readCookie('lrcmis_csrf');
    if (csrf) headers.set('X-CSRF-Token', csrf);
    const response = await fetchWithRetry(`${API_BASE}${path}`, { headers, credentials: 'include' });
    if (!response.ok) throw new ApiError(response.status, 'DOWNLOAD_FAILED', 'Gagal mengunduh laporan');
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  },
};

export { API_BASE };

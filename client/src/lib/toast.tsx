import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { cn } from '../components/ui';

type ToastType = 'success' | 'error' | 'info';
interface Toast {
  id: number;
  type: ToastType;
  message: string;
}

const ToastContext = createContext<{ toast: (message: string, type?: ToastType) => void } | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((message: string, type: ToastType = 'success') => {
    const id = Date.now() + Math.random();
    setToasts((current) => [...current, { id, type, message }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== id));
    }, 4500);
  }, []);

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex flex-col items-center gap-2 px-4 sm:items-end sm:pr-6">
        {toasts.map((item) => (
          <div
            key={item.id}
            role="status"
            className={cn(
              'pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-2xl border px-4 py-3 text-sm shadow-soft backdrop-blur',
              item.type === 'success' && 'border-brand-200 bg-brand-50/95 text-brand-900',
              item.type === 'error' && 'border-red-200 bg-red-50/95 text-red-900',
              item.type === 'info' && 'border-ink-200 bg-white/95 text-ink-800',
            )}
          >
            {item.type === 'success' && <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" />}
            {item.type === 'error' && <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />}
            {item.type === 'info' && <Info className="mt-0.5 h-5 w-5 shrink-0 text-ink-500" />}
            <p className="flex-1 leading-relaxed">{item.message}</p>
            <button
              type="button"
              aria-label="Tutup notifikasi"
              className="rounded-full p-1 text-current/60 hover:bg-black/5"
              onClick={() => setToasts((current) => current.filter((toastItem) => toastItem.id !== item.id))}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast harus dipakai di dalam ToastProvider');
  return context;
}

import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';

type ToastType = 'success' | 'error' | 'info';
interface Toast {
  id: string;
  message: string;
  type?: ToastType;
  durationMs?: number; // auto-hide
}

interface ToastContextValue {
  showToast: (msg: string, opts?: { type?: ToastType; durationMs?: number }) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const remove = useCallback((id: string) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((message: string, opts?: { type?: ToastType; durationMs?: number }) => {
    const id = Math.random().toString(36).slice(2);
    const toast: Toast = { id, message, type: opts?.type || 'success', durationMs: opts?.durationMs ?? 2500 };
    setToasts((list) => [...list, toast]);
    if (toast.durationMs && toast.durationMs > 0) {
      setTimeout(() => remove(id), toast.durationMs);
    }
  }, [remove]);

  const value = useMemo(() => ({ showToast }), [showToast]);
  const toastLayer = (
    <div className="fixed right-4 z-[1000] space-y-2 pointer-events-none bottom-24 md:bottom-4">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto rounded-lg shadow-lg px-4 py-2 text-white text-sm animate-[toast-in_0.2s_ease-out] ${
            t.type === 'error' ? 'bg-red-600' : t.type === 'info' ? 'bg-gray-700' : 'bg-viridian'
          }`}
          role="status"
          aria-live="polite"
        >
          {t.message}
        </div>
      ))}
    </div>
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      {typeof document !== 'undefined' ? createPortal(toastLayer, document.body) : toastLayer}
      <style>{`
@keyframes toast-in { from { transform: translateY(8px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      `}</style>
    </ToastContext.Provider>
  );
}

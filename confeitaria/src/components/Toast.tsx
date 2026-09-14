import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Icon } from './Icon';

type ToastKind = 'sucesso' | 'erro' | 'aviso' | 'info';

interface ToastItem {
  id: number;
  kind: ToastKind;
  title: string;
  message?: string;
}

interface ToastValue {
  notify: (kind: ToastKind, title: string, message?: string) => void;
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  warn: (title: string, message?: string) => void;
}

const ToastContext = createContext<ToastValue | null>(null);

const ICONS: Record<ToastKind, 'check' | 'alert' | 'bell'> = {
  sucesso: 'check',
  erro: 'alert',
  aviso: 'alert',
  info: 'bell',
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const seq = useRef(0);

  const notify = useCallback((kind: ToastKind, title: string, message?: string) => {
    seq.current += 1;
    const id = seq.current;
    setToasts((prev) => [...prev.slice(-3), { id, kind, title, message }]);
    window.setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4200);
  }, []);

  const value = useMemo<ToastValue>(() => ({
    notify,
    success: (title, message) => notify('sucesso', title, message),
    error: (title, message) => notify('erro', title, message),
    warn: (title, message) => notify('aviso', title, message),
  }), [notify]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-stack" role="status" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast--${toast.kind}`}>
            <span className="toast__icon"><Icon name={ICONS[toast.kind]} size={18} /></span>
            <div className="toast__body">
              <strong>{toast.title}</strong>
              {toast.message && <span>{toast.message}</span>}
            </div>
            <button type="button" className="toast__close" aria-label="Fechar aviso" onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}>
              <Icon name="close" size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast precisa estar dentro de ToastProvider');
  return ctx;
}

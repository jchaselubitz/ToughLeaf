import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

type ToastTone = 'success' | 'error';
type ToastInput = { message: string; tone?: ToastTone };
type ToastItem = ToastInput & { id: number };

const ToastContext = createContext<((input: ToastInput) => void) | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const showToast = useCallback((input: ToastInput) => {
    const id = Date.now() + Math.random();
    setItems((current) => [...current, { id, ...input }]);
    window.setTimeout(() => setItems((current) => current.filter((item) => item.id !== id)), 4_500);
  }, []);
  const value = useMemo(() => showToast, [showToast]);

  return <ToastContext.Provider value={value}>
    {children}
    <div className="fixed right-4 top-4 z-50 flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2" aria-live="polite" aria-atomic="true">
      {items.map((item) => <div
        key={item.id}
        role={item.tone === 'error' ? 'alert' : 'status'}
        className={`rounded-lg border px-4 py-3 text-sm shadow-lg ${item.tone === 'error' ? 'border-red-200 bg-red-50 text-red-900' : 'border-emerald-200 bg-emerald-50 text-emerald-900'}`}
      >
        {item.message}
      </div>)}
    </div>
  </ToastContext.Provider>;
}

export function useToast() {
  const showToast = useContext(ToastContext);
  if (!showToast) throw new Error('useToast must be used inside ToastProvider');
  return showToast;
}

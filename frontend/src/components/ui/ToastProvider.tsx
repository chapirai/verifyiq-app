'use client';

import { createContext, ReactNode, useContext } from 'react';

type ToastVariant = 'success' | 'error' | 'info';

interface ToastContextValue {
  addToast: (message: string, variant?: ToastVariant, onRetry?: () => void) => void;
  removeToast: (id: string) => void;
  toasts: Array<{ id: string; message: string; variant: ToastVariant; onRetry?: () => void }>;
}

const ToastContext = createContext<ToastContextValue>({
  addToast: () => undefined,
  removeToast: () => undefined,
  toasts: [],
});

export function ToastProvider({ children }: { children: ReactNode }) {
  return <ToastContext.Provider value={{ addToast: () => undefined, removeToast: () => undefined, toasts: [] }}>{children}</ToastContext.Provider>;
}

export function useToast() {
  return useContext(ToastContext);
}

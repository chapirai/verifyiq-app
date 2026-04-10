'use client';

import React, { createContext, useContext, ReactNode } from 'react';
import { useToastState, ToastState } from '@/hooks/use-toast';

const ToastContext = createContext<ToastState | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const state = useToastState();

  return (
    <ToastContext.Provider value={state}>
      {children}
      <ToastContainer />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastState {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
}

function ToastContainer() {
  const ctx = useContext(ToastContext);
  const toasts = ctx?.toasts ?? [];
  const removeToast = ctx?.removeToast ?? (() => undefined);

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      aria-label="Notifications"
      className="fixed right-4 top-4 z-50 flex flex-col gap-2"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={() => removeToast(toast.id)} />
      ))}
    </div>
  );
}

const variantStyles: Record<string, string> = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  error: 'border-red-200 bg-red-50 text-red-900',
  info: 'border-blue-200 bg-blue-50 text-blue-900',
};

const variantIcons: Record<string, string> = {
  success: '✓',
  error: '✗',
  info: 'ℹ',
};

interface ToastItemProps {
  toast: import('@/hooks/use-toast').Toast;
  onDismiss: () => void;
}

function ToastItem({ toast, onDismiss }: ToastItemProps) {
  const colorClass = variantStyles[toast.variant] ?? variantStyles.info;
  const icon = variantIcons[toast.variant] ?? variantIcons.info;

  return (
    <div
      role="alert"
      className={`flex min-w-[260px] max-w-xs items-start gap-3 rounded-xl border px-4 py-3 text-sm shadow-card ${colorClass}`}
    >
      <span className="mt-0.5 shrink-0 font-bold opacity-80">{icon}</span>
      <span className="flex-1 leading-snug">{toast.message}</span>
      <div className="flex shrink-0 flex-col gap-1">
        {toast.onRetry && (
          <button
            onClick={() => {
              onDismiss();
              toast.onRetry?.();
            }}
            className="rounded-lg px-2 py-0.5 text-xs font-semibold text-primary hover:underline"
            type="button"
          >
            Retry
          </button>
        )}
        <button
          onClick={onDismiss}
          aria-label="Dismiss notification"
          className="rounded px-2 py-0.5 text-xs opacity-60 hover:opacity-100"
          type="button"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

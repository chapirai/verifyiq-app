'use client';

import { useState, useCallback } from 'react';

export type ToastVariant = 'success' | 'error' | 'info';

export interface Toast {
  id: string;
  message: string;
  variant: ToastVariant;
  /** If provided, a retry button is shown. */
  onRetry?: () => void;
}

let _counter = 0;
function nextId(): string {
  return `toast-${++_counter}`;
}

export interface ToastState {
  toasts: Toast[];
  addToast: (message: string, variant: ToastVariant, onRetry?: () => void) => string;
  removeToast: (id: string) => void;
}

export function useToastState(): ToastState {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback(
    (message: string, variant: ToastVariant, onRetry?: () => void): string => {
      const id = nextId();
      setToasts((prev) => [...prev, { id, message, variant, onRetry }]);

      // Auto-dismiss success and info toasts after 3 seconds
      if (variant !== 'error') {
        setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== id));
        }, 3000);
      }

      return id;
    },
    [],
  );

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { toasts, addToast, removeToast };
}

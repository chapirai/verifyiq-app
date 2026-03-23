'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/lib/stores/auth.store';

export function useAuth() {
  const store = useAuthStore();

  useEffect(() => {
    store.hydrate();
  }, [store]);

  return store;
}

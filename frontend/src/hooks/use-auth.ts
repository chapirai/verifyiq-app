'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/lib/stores/auth.store';

export function useAuth() {
  const store = useAuthStore();
  const hydrate = useAuthStore((state) => state.hydrate);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  return store;
}

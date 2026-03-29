'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, CompanyChangeEvent } from '@/lib/api';

interface ApiError {
  response?: {
    status?: number;
    data?: { message?: string };
  };
  message?: string;
}

function isApiError(err: unknown): err is ApiError {
  return typeof err === 'object' && err !== null;
}

export interface ChangeEventsState {
  data: CompanyChangeEvent[];
  loading: boolean;
  error: string | null;
  retry: () => void;
}

export function useChangeEvents(orgNumber: string, limit: number, enabled: boolean): ChangeEventsState {
  const [data, setData] = useState<CompanyChangeEvent[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  const doFetch = useCallback(async () => {
    if (!orgNumber || !enabled) {
      setLoading(false);
      setData([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await api.getChangeEventsByOrgNumber(orgNumber, limit);
      setData(result);
    } catch (err: unknown) {
      const apiErr = isApiError(err) ? err : null;
      const status = apiErr?.response?.status;
      if (status === 404) {
        setData([]);
      } else if (status === 403) {
        setError('Change summary access is restricted to audit roles.');
      } else if (status != null && status >= 500) {
        setError('Service is temporarily unavailable. Please try again later.');
      } else if (err instanceof Error && err.message.toLowerCase().includes('timeout')) {
        setError('Request timed out. Please try again.');
      } else if (err instanceof Error && err.message.toLowerCase().includes('network')) {
        setError('Network error. Check your connection.');
      } else {
        const msg = apiErr?.response?.data?.message ?? (err instanceof Error ? err.message : null);
        setError(typeof msg === 'string' ? msg : 'An unexpected error occurred.');
      }
    } finally {
      setLoading(false);
    }
  }, [orgNumber, limit, enabled]);

  useEffect(() => {
    doFetch();
  }, [doFetch]);

  return { data, loading, error, retry: doFetch };
}

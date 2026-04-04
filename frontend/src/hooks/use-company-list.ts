'use client';

import { useState, useEffect, useCallback } from 'react';
import { api, CompanyListItem } from '@/lib/api';

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

export interface CompanyListState {
  data: CompanyListItem[];
  loading: boolean;
  error: string | null;
  retry: () => void;
}

export function useCompanyList(): CompanyListState {
  const [data, setData] = useState<CompanyListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const doFetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.listCompanies();
      setData(result.data);
    } catch (err: unknown) {
      const apiErr = isApiError(err) ? err : null;
      const status = apiErr?.response?.status;
      if (status != null && status >= 500) {
        setError('Service is temporarily unavailable. Please try again later.');
      } else if (err instanceof Error && err.message.toLowerCase().includes('timeout')) {
        setError('Request timed out. Please try again.');
      } else if (err instanceof Error && err.message.toLowerCase().includes('network')) {
        setError('Network error. Please check your connection and try again.');
      } else {
        const msg = apiErr?.response?.data?.message ?? (err instanceof Error ? err.message : null);
        setError(typeof msg === 'string' ? msg : 'An unexpected error occurred.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    doFetch();
  }, [doFetch]);

  return { data, loading, error, retry: doFetch };
}

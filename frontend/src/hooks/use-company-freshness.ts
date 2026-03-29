'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, CompanyFreshnessMetadata } from '@/lib/api';

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

export interface CompanyFreshnessState {
  data: CompanyFreshnessMetadata | null;
  loading: boolean;
  error: string | null;
  retry: () => void;
}

export function useCompanyFreshness(orgNumber: string): CompanyFreshnessState {
  const [data, setData] = useState<CompanyFreshnessMetadata | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const doFetch = useCallback(async () => {
    if (!orgNumber) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await api.getCompanyFreshness(orgNumber);
      setData(result);
    } catch (err: unknown) {
      const apiErr = isApiError(err) ? err : null;
      const status = apiErr?.response?.status;
      if (status === 404) {
        setData(null);
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
  }, [orgNumber]);

  useEffect(() => {
    doFetch();
  }, [doFetch]);

  return { data, loading, error, retry: doFetch };
}

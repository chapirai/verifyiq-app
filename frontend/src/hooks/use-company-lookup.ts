'use client';

import { useState, useEffect, useCallback } from 'react';
import { api, CompanyLookupResponse } from '@/lib/api';

const RECENTLY_VIEWED_KEY = 'verifyiq:recently-viewed-companies';
const MAX_RECENTLY_VIEWED = 10;

function saveRecentlyViewed(orgNumber: string) {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(RECENTLY_VIEWED_KEY);
    const existing: string[] = raw ? (JSON.parse(raw) as unknown[]).filter((v): v is string => typeof v === 'string') : [];
    const updated = [orgNumber, ...existing.filter((n) => n !== orgNumber)].slice(0, MAX_RECENTLY_VIEWED);
    localStorage.setItem(RECENTLY_VIEWED_KEY, JSON.stringify(updated));
  } catch {
    // Ignore storage errors
  }
}

export type CompanyLookupState = {
  data: CompanyLookupResponse | null;
  loading: boolean;
  error: string | null;
  refreshing: boolean;
  fetch: () => Promise<void>;
  refresh: () => Promise<void>;
};

export function useCompanyLookup(orgNumber: string): CompanyLookupState {
  const [data, setData] = useState<CompanyLookupResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const doFetch = useCallback(
    async (forceRefresh: boolean) => {
      if (!orgNumber) return;
      const isRefresh = forceRefresh;
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
        setError(null);
      }

      try {
        const result = await api.lookupCompanyByOrgNumber({
          orgNumber,
          force_refresh: forceRefresh,
        });
        setData(result);
        setError(null);
        saveRecentlyViewed(orgNumber);
      } catch (err: unknown) {
        const axiosErr = err as { response?: { status?: number; data?: { message?: string } }; message?: string };
        const status = axiosErr?.response?.status;
        if (status === 404) {
          setError('Company not found. Please check the organisation number and try again.');
        } else if (status === 400) {
          setError('Invalid organisation number format. Please use a 10-digit or 12-digit number.');
        } else if (status != null && status >= 500) {
          setError('Service is temporarily unavailable. Please try again later.');
        } else if (err instanceof Error && err.message.toLowerCase().includes('timeout')) {
          setError('Request timed out. Please try again.');
        } else if (err instanceof Error && err.message.toLowerCase().includes('network')) {
          setError('Network error. Please check your connection and try again.');
        } else {
          const msg = axiosErr?.response?.data?.message ?? (err instanceof Error ? err.message : 'An unexpected error occurred.');
          setError(typeof msg === 'string' ? msg : 'An unexpected error occurred.');
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [orgNumber],
  );

  const fetch = useCallback(() => doFetch(false), [doFetch]);
  const refresh = useCallback(() => doFetch(true), [doFetch]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { data, loading, error, refreshing, fetch, refresh };
}

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { api, CompanyLookupResponse } from '@/lib/api';
import { formatApiMessage } from '@/lib/api-errors';
import { useToast } from '@/components/ui/ToastProvider';

const RECENTLY_VIEWED_KEY = 'verifyiq:recently-viewed-companies';
const MAX_RECENTLY_VIEWED = 10;
const REFRESH_COOLDOWN_MS = 5000;

interface ApiError {
  response?: {
    status?: number;
    data?: { message?: string | string[] };
  };
  message?: string;
}

function isApiError(err: unknown): err is ApiError {
  return typeof err === 'object' && err !== null;
}

function saveRecentlyViewed(orgNumber: string) {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(RECENTLY_VIEWED_KEY);
    const existing: string[] = (() => {
      try {
        const parsed: unknown = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
      } catch {
        return [];
      }
    })();
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
  /** Seconds remaining in the post-refresh cooldown (0 when not in cooldown). */
  cooldownRemaining: number;
  fetch: () => Promise<void>;
  refresh: () => Promise<void>;
};

export function useCompanyLookup(orgNumber: string): CompanyLookupState {
  const [data, setData] = useState<CompanyLookupResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);

  /** Absolute timestamp (ms) when the cooldown expires. */
  const cooldownUntilRef = useRef<number>(0);
  const cooldownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { addToast } = useToast();

  const startCooldown = useCallback(() => {
    cooldownUntilRef.current = Date.now() + REFRESH_COOLDOWN_MS;
    setCooldownRemaining(Math.ceil(REFRESH_COOLDOWN_MS / 1000));

    if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);

    cooldownTimerRef.current = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((cooldownUntilRef.current - Date.now()) / 1000));
      setCooldownRemaining(remaining);
      if (remaining === 0 && cooldownTimerRef.current) {
        clearInterval(cooldownTimerRef.current);
        cooldownTimerRef.current = null;
      }
    }, 1000);
  }, []);

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);
    };
  }, []);

  const doFetch = useCallback(
    async (forceRefresh: boolean) => {
      if (!orgNumber) return;
      const isRefresh = forceRefresh;

      if (isRefresh) {
        // Enforce client-side rate limit
        if (Date.now() < cooldownUntilRef.current) {
          const secsLeft = Math.ceil((cooldownUntilRef.current - Date.now()) / 1000);
          addToast(`Please wait ${secsLeft} second${secsLeft === 1 ? '' : 's'} before refreshing again`, 'info');
          return;
        }
        setRefreshing(true);
        addToast('Refreshing data…', 'info');
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

        if (isRefresh) {
          addToast('Data refreshed successfully', 'success');
          startCooldown();
        }
      } catch (err: unknown) {
        const apiErr = isApiError(err) ? err : null;
        const status = apiErr?.response?.status;
        const resolvedApiMessage = formatApiMessage(apiErr?.response?.data?.message);

        let userMessage: string;
        if (status === 404) {
          userMessage = 'Company not found. Please check the organisation number and try again.';
        } else if (status === 400) {
          userMessage = 'Invalid organisation number format. Please use a 10-digit or 12-digit number.';
        } else if (status != null && status >= 500) {
          const fallback = isRefresh
            ? 'Service error. Please try again later.'
            : 'Service is temporarily unavailable. Please try again later.';
          userMessage = resolvedApiMessage ?? fallback;
        } else if (err instanceof Error && err.message.toLowerCase().includes('timeout')) {
          userMessage = isRefresh ? 'Refresh timed out. Please try again.' : 'Request timed out. Please try again.';
        } else if (err instanceof Error && err.message.toLowerCase().includes('network')) {
          userMessage = 'Network error. Check your connection.';
        } else {
          const msg = resolvedApiMessage ?? (err instanceof Error ? err.message : null);
          userMessage = typeof msg === 'string' ? msg : isRefresh ? 'Refresh failed. Please try again.' : 'An unexpected error occurred.';
        }

        if (isRefresh) {
          addToast(`Refresh failed: ${userMessage}`, 'error', () => doFetch(true));
        } else {
          setError(userMessage);
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [orgNumber, addToast, startCooldown],
  );

  const fetch = useCallback(() => doFetch(false), [doFetch]);
  const refresh = useCallback(() => doFetch(true), [doFetch]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { data, loading, error, refreshing, cooldownRemaining, fetch, refresh };
}

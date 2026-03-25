'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import SearchForm from '@/components/SearchForm';
import { api } from '@/lib/api';

interface ApiError {
  response?: { status?: number; data?: { message?: string } };
  message?: string;
}

function isApiError(err: unknown): err is ApiError {
  return typeof err === 'object' && err !== null;
}

function getErrorMessage(err: unknown): string {
  const apiErr = isApiError(err) ? err : null;
  const status = apiErr?.response?.status;
  if (status != null && status >= 500) return 'Service is temporarily unavailable. Please try again.';
  if (err instanceof Error && err.message.toLowerCase().includes('timeout'))
    return 'Request timed out. Please try again.';
  if (err instanceof Error && err.message.toLowerCase().includes('network'))
    return 'Network error. Please check your connection and try again.';
  const msg = apiErr?.response?.data?.message ?? (err instanceof Error ? err.message : null);
  return typeof msg === 'string' ? msg : 'An unexpected error occurred.';
}

export default function SearchPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = useCallback(
    async (orgNumber: string) => {
      setLoading(true);
      setError(null);
      try {
        const result = await api.lookupCompanyByOrgNumber({ orgNumber });
        const foundOrgNumber = result.company?.organisationNumber ?? orgNumber;
        router.push(`/companies/${encodeURIComponent(foundOrgNumber)}`);
      } catch (err: unknown) {
        const apiErr = isApiError(err) ? err : null;
        if (apiErr?.response?.status === 404) {
          router.push(`/search/results?q=${encodeURIComponent(orgNumber)}`);
        } else {
          setError(getErrorMessage(err));
          setLoading(false);
        }
      }
    },
    [router],
  );

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div>
        <p className="text-sm text-slate-400">Company Lookup</p>
        <h1 className="mt-1 text-3xl font-semibold">Company Search</h1>
        <p className="mt-2 text-sm text-slate-400">
          Search for a Swedish company by its 12-digit organisation number to initiate a KYC lookup.
        </p>
      </div>

      {/* Search form */}
      <SearchForm onSearch={handleSearch} loading={loading} />

      {/* Error state */}
      {error && (
        <div className="rounded-xl border border-red-700 bg-red-900/30 p-4">
          <p className="text-sm text-red-300">{error}</p>
          <button
            type="button"
            onClick={() => setError(null)}
            className="mt-3 rounded-lg bg-red-700/40 px-4 py-2 text-xs text-red-200 transition hover:bg-red-700/60"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}

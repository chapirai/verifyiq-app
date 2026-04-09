'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import SearchForm from '@/components/SearchForm';
import { SectionHeader } from '@/components/section-header';
import { api } from '@/lib/api';
import { useRecentSearches } from '@/hooks/use-recent-searches';
import { formatApiMessage } from '@/lib/api-errors';

interface ApiError {
  response?: { status?: number; data?: { message?: string | string[] } };
  message?: string;
}

function isApiError(err: unknown): err is ApiError {
  return typeof err === 'object' && err !== null;
}

function getErrorMessage(err: unknown): string {
  const apiErr = isApiError(err) ? err : null;
  const status = apiErr?.response?.status;
  const resolvedApiMessage = formatApiMessage(apiErr?.response?.data?.message);
  if (status != null && status >= 500) {
    return resolvedApiMessage ?? 'Service is temporarily unavailable. Please try again.';
  }
  if (err instanceof Error && err.message.toLowerCase().includes('timeout'))
    return 'Request timed out. Please try again.';
  if (err instanceof Error && err.message.toLowerCase().includes('network'))
    return 'Network error. Please check your connection and try again.';
  const msg = resolvedApiMessage ?? (err instanceof Error ? err.message : null);
  return typeof msg === 'string' ? msg : 'An unexpected error occurred.';
}

export default function SearchPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { updateSearchMetadata } = useRecentSearches();

  const handleSearch = useCallback(
    async (orgNumber: string) => {
      setLoading(true);
      setError(null);
      try {
        const result = await api.lookupCompanyByOrgNumber({ orgNumber });
        // Persist backend-provided source/freshness metadata in recent searches
        updateSearchMetadata(orgNumber, {
          source: result.metadata.source,
          freshness: result.metadata.freshness,
          fetched_at: result.metadata.fetched_at,
          age_days: result.metadata.age_days,
          degraded: result.metadata.degraded,
        });
        const foundOrgNumber = result.company?.organisationNumber ?? orgNumber;
        router.push(`/companies/${encodeURIComponent(String(foundOrgNumber))}`);
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
    [router, updateSearchMetadata],
  );

  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow="Company Lookup"
        title="Company Search"
        description="Search by organisation number to retrieve profile, source metadata, and freshness indicators."
      />

      {/* Search form */}
      <SearchForm onSearch={handleSearch} loading={loading} />

      {/* Error state */}
      {error && (
        <div className="rounded-xl border border-red-300 bg-red-50 p-4">
          <p className="text-sm text-red-700">{error}</p>
          <button
            type="button"
            onClick={() => setError(null)}
            className="mt-3 rounded-lg bg-red-100 px-4 py-2 text-xs text-red-700 transition hover:bg-red-200"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}

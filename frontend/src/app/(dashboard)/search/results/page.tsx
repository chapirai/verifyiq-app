'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { SectionHeader } from '@/components/section-header';
import { useSearchResults } from '@/hooks/use-search-results';

export default function SearchResultsPage() {
  const query = useMemo(() => {
    if (typeof window === 'undefined') return '';
    return new URLSearchParams(window.location.search).get('q') ?? '';
  }, []);
  const { data, loading, error } = useSearchResults({ query, page: 1, limit: 20 });

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Results"
        title={`Search results for ${query || '...'}`}
        description="Matching entities from the current tenant dataset."
      />
      <section className="panel p-6">
        {loading ? <p className="text-sm text-muted-foreground">Loading results...</p> : null}
        {error ? <p className="text-sm text-red-700">{error}</p> : null}
        {!loading && !error && (
          <div className="space-y-2">
            {data?.results.map((company) => (
              <Link
                key={company.orgNumber}
                className="interactive-row block px-4 py-3"
                href={`/companies/${encodeURIComponent(company.orgNumber)}`}
              >
                <p className="font-medium">{company.legalName || company.orgNumber}</p>
                <p className="text-xs text-muted-foreground">{company.orgNumber}</p>
              </Link>
            ))}
            {!data?.results.length ? <p className="text-sm text-muted-foreground">No matches found.</p> : null}
          </div>
        )}
      </section>
    </div>
  );
}

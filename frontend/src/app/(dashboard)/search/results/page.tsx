'use client';

import { Suspense, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import type { Route } from 'next';
import { useSearchResults } from '@/hooks/use-search-results';
import type { CompanySearchResult } from '@/lib/api';

// ─── Helpers ────────────────────────────────────────────────────────────────

function relativeTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const then = new Date(dateStr).getTime();
  if (isNaN(then)) return '—';
  const diffSecs = Math.floor((Date.now() - then) / 1000);
  if (diffSecs < 60) return 'just now';
  const diffMins = Math.floor(diffSecs / 60);
  if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
}

function statusBadge(status: string | null | undefined): React.ReactNode {
  const s = (status ?? '').toLowerCase();
  if (s === 'active') {
    return (
      <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
        Active
      </span>
    );
  }
  if (s === 'inactive' || s === 'dissolved') {
    return (
      <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700">
        {status}
      </span>
    );
  }
  if (s === 'pending') {
    return (
      <span className="inline-flex items-center rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-700">
        Pending
      </span>
    );
  }
  if (!status) {
    return <span className="text-muted-foreground">—</span>;
  }
  return (
    <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
      {status}
    </span>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <tr className="border-t border-border">
      {[1, 2, 3, 4, 5].map((i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 animate-pulse rounded bg-muted" />
        </td>
      ))}
    </tr>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-8 w-64 animate-pulse rounded-lg bg-muted" />
      <div className="panel overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-muted text-sm text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Org Number</th>
              <th className="px-4 py-3">Company Name</th>
              <th className="hidden px-4 py-3 sm:table-cell">Status</th>
              <th className="hidden px-4 py-3 lg:table-cell">Last Fetched</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 5 }).map((_, i) => (
              <SkeletonRow key={i} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

interface ResultsHeaderProps {
  query: string;
  total: number;
}

function ResultsHeader({ query, total }: ResultsHeaderProps) {
  return (
    <div>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/search" className="transition hover:text-foreground">
          Company Search
        </Link>
        <span>/</span>
        <span className="text-foreground">Results</span>
      </div>
      <h1 className="mt-3 text-3xl font-semibold">Search Results</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        <span className="font-medium text-foreground">{total}</span>{' '}
        {total === 1 ? 'result' : 'results'} for{' '}
        <span className="font-mono font-medium text-foreground">{query}</span>
      </p>
    </div>
  );
}

interface SearchResultsTableProps {
  results: CompanySearchResult[];
}

function SearchResultsTable({ results }: SearchResultsTableProps) {
  const router = useRouter();

  return (
    <div className="panel overflow-hidden">
      <table className="w-full text-left">
        <thead className="bg-muted text-sm text-muted-foreground">
          <tr>
            <th className="px-4 py-3">Org Number</th>
            <th className="px-4 py-3">Company Name</th>
            <th className="hidden px-4 py-3 sm:table-cell">Status</th>
            <th className="hidden px-4 py-3 lg:table-cell">Last Fetched</th>
            <th className="px-4 py-3">Actions</th>
          </tr>
        </thead>
        <tbody>
          {results.map((row) => (
            <tr
              key={row.orgNumber}
              className="cursor-pointer border-t border-border transition hover:bg-muted/60"
              onClick={() => router.push(`/companies/${encodeURIComponent(row.orgNumber)}`)}
            >
              <td className="px-4 py-3 font-mono text-sm text-accent">{row.orgNumber}</td>
              <td className="px-4 py-3 text-sm">{row.legalName ?? '—'}</td>
              <td className="hidden px-4 py-3 sm:table-cell">{statusBadge(row.status)}</td>
              <td className="hidden px-4 py-3 text-sm text-muted-foreground lg:table-cell">
                {relativeTime(row.fetchedAt)}
              </td>
              <td className="px-4 py-3">
                <Link
                  href={`/companies/${encodeURIComponent(row.orgNumber)}`}
                  onClick={(e) => e.stopPropagation()}
                  className="text-xs text-accent transition hover:underline"
                >
                  View profile →
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface PaginationControlsProps {
  page: number;
  totalPages: number;
  query: string;
  limit: number;
}

function PaginationControls({ page, totalPages, query, limit }: PaginationControlsProps) {
  function buildHref(p: number) {
    return {
      pathname: '/search/results' as Route,
      query: { q: query, page: String(p), limit: String(limit) },
    };
  }

  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between text-sm">
      {page > 1 ? (
        <Link
          href={buildHref(page - 1)}
          className="secondary-btn"
        >
          ← Previous
        </Link>
      ) : (
        <button
          disabled
          className="rounded-xl bg-muted px-4 py-2 text-muted-foreground cursor-not-allowed"
          aria-disabled="true"
        >
          ← Previous
        </button>
      )}

      <span className="text-muted-foreground">
        Page <span className="font-medium text-foreground">{page}</span> of{' '}
        <span className="font-medium text-foreground">{totalPages}</span>
      </span>

      {page < totalPages ? (
        <Link
          href={buildHref(page + 1)}
          className="secondary-btn"
        >
          Next →
        </Link>
      ) : (
        <button
          disabled
          className="rounded-xl bg-muted px-4 py-2 text-muted-foreground cursor-not-allowed"
          aria-disabled="true"
        >
          Next →
        </button>
      )}
    </div>
  );
}

interface NoResultsStateProps {
  query: string;
}

function NoResultsState({ query }: NoResultsStateProps) {
  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/search" className="transition hover:text-foreground">
            Company Search
          </Link>
          <span>/</span>
          <span className="text-foreground">Results</span>
        </div>
        <h1 className="mt-3 text-3xl font-semibold">No Results Found</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          No companies matched your search for{' '}
          <span className="font-mono font-medium text-foreground">{query}</span>.
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          Search Again
        </h2>
        <RefinementForm defaultQuery={query} />
        <div className="border-t border-border pt-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Suggestions
          </p>
          <ul className="space-y-1 text-sm text-muted-foreground">
            <li>• Try a different organisation number</li>
            <li>• Ensure the format is 12 consecutive digits (e.g. 202100123456)</li>
            <li>• Remove any hyphens or spaces and try again</li>
          </ul>
        </div>
        <Link
          href="/search"
          className="primary-btn inline-flex text-sm"
        >
          ← Back to Search
        </Link>
      </div>
    </div>
  );
}

interface RefinementFormProps {
  defaultQuery: string;
}

function RefinementForm({ defaultQuery }: RefinementFormProps) {
  const router = useRouter();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const q = (data.get('q') as string | null)?.trim() ?? '';
    if (!q) return;
    router.push(`/search/results?q=${encodeURIComponent(q)}&page=1`);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="flex-1">
        <label
          htmlFor="refinement-input"
          className="mb-1 block text-xs uppercase tracking-widest text-muted-foreground"
        >
          Organisation Number
        </label>
        <input
          id="refinement-input"
          name="q"
          type="text"
          defaultValue={defaultQuery}
          placeholder="e.g. 202100123456"
          autoComplete="off"
          spellCheck={false}
          className="input-ui"
        />
      </div>
      <button
        type="submit"
        className="primary-btn text-sm"
      >
        Search
      </button>
    </form>
  );
}

interface ErrorStateProps {
  message: string;
  onRetry: () => void;
}

function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div className="rounded-xl border border-red-300 bg-red-50 p-5">
      <p className="font-medium text-red-700">{message}</p>
      <div className="mt-3 flex gap-3">
        <button
          onClick={onRetry}
          className="rounded-lg bg-red-100 px-4 py-2 text-sm text-red-700 transition hover:bg-red-200"
        >
          Retry
        </button>
        <Link
          href="/search"
          className="secondary-btn text-sm"
        >
          Back to Search
        </Link>
      </div>
    </div>
  );
}

// ─── Inner page (reads search params) ───────────────────────────────────────

function SearchResultsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const q = searchParams.get('q') ?? '';
  const page = Math.max(1, Number(searchParams.get('page') ?? '1'));
  const limit = Math.max(1, Number(searchParams.get('limit') ?? '10'));
  const status = searchParams.get('status') ?? '';
  const sortBy = (searchParams.get('sortBy') as 'updatedAt' | 'legalName' | 'createdAt' | null) ?? 'updatedAt';
  const sortDir = (searchParams.get('sortDir') as 'asc' | 'desc' | null) ?? 'desc';

  const { data, loading, error, retry } = useSearchResults({
    query: q,
    page,
    limit,
    status: status || undefined,
    sortBy,
    sortDir,
  });

  const results = data?.results ?? [];
  const total = data?.metadata.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  // Auto-redirect when exactly one result is found
  useEffect(() => {
    const singleResult = !loading && !error && data?.results?.length === 1 ? data.results[0] : null;
    if (singleResult) {
      router.replace(`/companies/${encodeURIComponent(singleResult.orgNumber)}`);
    }
  }, [loading, error, data, router]);

  if (!q) {
    return (
      <div className="space-y-4">
        <p className="text-muted-foreground">No search query provided.</p>
        <Link
          href="/search"
          className="primary-btn inline-flex text-sm"
        >
          ← Back to Search
        </Link>
      </div>
    );
  }

  if (loading) return <LoadingSkeleton />;

  if (error) return <ErrorState message={error} onRetry={retry} />;

  if (results.length === 0) return <NoResultsState query={q} />;

  // Single result is being redirected; show skeleton while effect fires
  if (results.length === 1) return <LoadingSkeleton />;

  return (
    <div className="space-y-6">
      <ResultsHeader query={q} total={total} />
      <div className="panel p-4">
        <form className="grid gap-3 md:grid-cols-4" onSubmit={(e) => {
          e.preventDefault();
          const form = new FormData(e.currentTarget);
          const nextStatus = String(form.get('status') ?? '');
          const nextSortBy = String(form.get('sortBy') ?? 'updatedAt');
          const nextSortDir = String(form.get('sortDir') ?? 'desc');
          router.push(`/search/results?q=${encodeURIComponent(q)}&page=1&limit=${limit}&status=${encodeURIComponent(nextStatus)}&sortBy=${encodeURIComponent(nextSortBy)}&sortDir=${encodeURIComponent(nextSortDir)}`);
        }}>
          <select name="status" defaultValue={status} className="input-ui h-10 px-3 py-2">
            <option value="">All statuses</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="INACTIVE">INACTIVE</option>
            <option value="LIQUIDATION">LIQUIDATION</option>
            <option value="BANKRUPT">BANKRUPT</option>
            <option value="DISSOLVED">DISSOLVED</option>
          </select>
          <select name="sortBy" defaultValue={sortBy} className="input-ui h-10 px-3 py-2">
            <option value="updatedAt">Last updated</option>
            <option value="legalName">Legal name</option>
            <option value="createdAt">Created</option>
          </select>
          <select name="sortDir" defaultValue={sortDir} className="input-ui h-10 px-3 py-2">
            <option value="desc">Descending</option>
            <option value="asc">Ascending</option>
          </select>
          <button type="submit" className="primary-btn text-sm">Apply filters</button>
        </form>
      </div>
      <SearchResultsTable results={results} />
      <PaginationControls page={page} totalPages={totalPages} query={q} limit={limit} />
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function SearchResultsPage() {
  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <SearchResultsContent />
    </Suspense>
  );
}

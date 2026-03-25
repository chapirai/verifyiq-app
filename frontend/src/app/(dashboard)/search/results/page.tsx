'use client';

import { Suspense, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
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
      <span className="inline-flex items-center rounded-full bg-emerald-900/50 px-2.5 py-0.5 text-xs font-medium text-emerald-300">
        Active
      </span>
    );
  }
  if (s === 'inactive' || s === 'dissolved') {
    return (
      <span className="inline-flex items-center rounded-full bg-red-900/50 px-2.5 py-0.5 text-xs font-medium text-red-300">
        {status}
      </span>
    );
  }
  if (s === 'pending') {
    return (
      <span className="inline-flex items-center rounded-full bg-yellow-900/50 px-2.5 py-0.5 text-xs font-medium text-yellow-300">
        Pending
      </span>
    );
  }
  if (!status) {
    return <span className="text-slate-500">—</span>;
  }
  return (
    <span className="inline-flex items-center rounded-full bg-slate-700/50 px-2.5 py-0.5 text-xs font-medium text-slate-300">
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
          <div className="h-4 animate-pulse rounded bg-slate-800" />
        </td>
      ))}
    </tr>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-8 w-64 animate-pulse rounded-lg bg-slate-800" />
      <div className="panel overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-900/70 text-sm text-slate-400">
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
      <div className="flex items-center gap-2 text-sm text-slate-400">
        <Link href="/search" className="transition hover:text-white">
          Company Search
        </Link>
        <span>/</span>
        <span className="text-slate-200">Results</span>
      </div>
      <h1 className="mt-3 text-3xl font-semibold">Search Results</h1>
      <p className="mt-1 text-sm text-slate-400">
        <span className="font-medium text-white">{total}</span>{' '}
        {total === 1 ? 'result' : 'results'} for{' '}
        <span className="font-mono font-medium text-white">{query}</span>
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
        <thead className="bg-slate-900/70 text-sm text-slate-400">
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
              className="cursor-pointer border-t border-border transition hover:bg-slate-900/40"
              onClick={() => router.push(`/companies/${encodeURIComponent(row.orgNumber)}`)}
            >
              <td className="px-4 py-3 font-mono text-sm text-accent">{row.orgNumber}</td>
              <td className="px-4 py-3 text-sm">{row.legalName ?? '—'}</td>
              <td className="hidden px-4 py-3 sm:table-cell">{statusBadge(row.status)}</td>
              <td className="hidden px-4 py-3 text-sm text-slate-400 lg:table-cell">
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
  function buildUrl(p: number) {
    const params = new URLSearchParams({ q: query, page: String(p), limit: String(limit) });
    return `/search/results?${params.toString()}`;
  }

  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between text-sm">
      {page > 1 ? (
        <Link
          href={buildUrl(page - 1)}
          className="rounded-xl bg-slate-700 px-4 py-2 text-white transition hover:bg-slate-600"
        >
          ← Previous
        </Link>
      ) : (
        <button
          disabled
          className="rounded-xl bg-slate-800/50 px-4 py-2 text-slate-500 cursor-not-allowed"
          aria-disabled="true"
        >
          ← Previous
        </button>
      )}

      <span className="text-slate-400">
        Page <span className="font-medium text-white">{page}</span> of{' '}
        <span className="font-medium text-white">{totalPages}</span>
      </span>

      {page < totalPages ? (
        <Link
          href={buildUrl(page + 1)}
          className="rounded-xl bg-slate-700 px-4 py-2 text-white transition hover:bg-slate-600"
        >
          Next →
        </Link>
      ) : (
        <button
          disabled
          className="rounded-xl bg-slate-800/50 px-4 py-2 text-slate-500 cursor-not-allowed"
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
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Link href="/search" className="transition hover:text-white">
            Company Search
          </Link>
          <span>/</span>
          <span className="text-slate-200">Results</span>
        </div>
        <h1 className="mt-3 text-3xl font-semibold">No Results Found</h1>
        <p className="mt-1 text-sm text-slate-400">
          No companies matched your search for{' '}
          <span className="font-mono font-medium text-white">{query}</span>.
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-400">
          Search Again
        </h2>
        <RefinementForm defaultQuery={query} />
        <div className="border-t border-border pt-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-500">
            Suggestions
          </p>
          <ul className="space-y-1 text-sm text-slate-400">
            <li>• Try a different organisation number</li>
            <li>• Ensure the format is 12 consecutive digits (e.g. 202100123456)</li>
            <li>• Remove any hyphens or spaces and try again</li>
          </ul>
        </div>
        <Link
          href="/search"
          className="inline-block rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-500"
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
          className="mb-1 block text-xs uppercase tracking-widest text-slate-400"
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
          className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-white placeholder-slate-500 transition focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>
      <button
        type="submit"
        className="rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-500"
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
    <div className="rounded-xl border border-red-700 bg-red-900/30 p-5">
      <p className="font-medium text-red-300">{message}</p>
      <div className="mt-3 flex gap-3">
        <button
          onClick={onRetry}
          className="rounded-lg bg-red-700/40 px-4 py-2 text-sm text-red-200 transition hover:bg-red-700/60"
        >
          Retry
        </button>
        <Link
          href="/search"
          className="rounded-lg bg-slate-700/40 px-4 py-2 text-sm text-slate-300 transition hover:bg-slate-700/60"
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

  const { data, loading, error, retry } = useSearchResults({ query: q, page, limit });

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
        <p className="text-slate-400">No search query provided.</p>
        <Link
          href="/search"
          className="inline-block rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-500"
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

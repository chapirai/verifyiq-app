'use client';

import Link from 'next/link';
import { useCompanyList } from '@/hooks/use-company-list';
import type { CompanyListItem } from '@/lib/api';

// ─── Sub-components ──────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <tr className="border-t border-border">
      {[1, 2, 3].map((i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 animate-pulse rounded bg-slate-800" />
        </td>
      ))}
    </tr>
  );
}

function LoadingSkeleton() {
  return (
    <div className="panel overflow-hidden">
      <table className="w-full text-left">
        <thead className="bg-slate-900/70 text-sm text-slate-400">
          <tr>
            <th className="px-4 py-3">Org no.</th>
            <th className="px-4 py-3">Name</th>
            <th className="px-4 py-3">Status</th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 5 }).map((_, i) => (
            <SkeletonRow key={i} />
          ))}
        </tbody>
      </table>
    </div>
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

function EmptyState() {
  return (
    <div className="panel p-8 text-center">
      <p className="text-slate-400">No companies found.</p>
      <Link
        href="/search"
        className="mt-4 inline-block rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-500"
      >
        Search for a company
      </Link>
    </div>
  );
}

interface CompaniesTableProps {
  companies: CompanyListItem[];
}

function CompaniesTable({ companies }: CompaniesTableProps) {
  return (
    <div className="panel overflow-hidden">
      <table className="w-full text-left">
        <thead className="bg-slate-900/70 text-sm text-slate-400">
          <tr>
            <th className="px-4 py-3">Org no.</th>
            <th className="px-4 py-3">Name</th>
            <th className="px-4 py-3">Status</th>
          </tr>
        </thead>
        <tbody>
          {companies.map((company) => (
            <tr
              key={company.organisationNumber}
              className="border-t border-border transition hover:bg-slate-900/40"
            >
              <td className="px-4 py-3">
                <Link
                  href={`/companies/${company.organisationNumber}`}
                  className="text-accent hover:underline"
                >
                  {company.organisationNumber}
                </Link>
              </td>
              <td className="px-4 py-3">
                <Link
                  href={`/companies/${company.organisationNumber}`}
                  className="hover:underline"
                >
                  {company.legalName ?? '—'}
                </Link>
              </td>
              <td className="px-4 py-3">{company.status ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function CompaniesPage() {
  const { data, loading, error, retry } = useCompanyList();

  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm text-slate-400">Registry</p>
        <h1 className="text-3xl font-semibold">Company profiles</h1>
      </div>

      {loading && <LoadingSkeleton />}
      {!loading && error && <ErrorState message={error} onRetry={retry} />}
      {!loading && !error && data.length === 0 && <EmptyState />}
      {!loading && !error && data.length > 0 && <CompaniesTable companies={data} />}
    </section>
  );
}


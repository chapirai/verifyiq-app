'use client';

import Link from 'next/link';
import { useCompanyList } from '@/hooks/use-company-list';
import type { CompanyListItem } from '@/lib/api';
import { SectionHeader } from '@/components/section-header';

// ─── Sub-components ──────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <tr className="border-t border-border">
      {[1, 2, 3].map((i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 animate-pulse rounded bg-muted" />
        </td>
      ))}
    </tr>
  );
}

function LoadingSkeleton() {
  return (
    <div className="panel overflow-hidden">
      <table className="w-full text-left">
        <thead className="bg-muted text-sm text-muted-foreground">
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

function EmptyState() {
  return (
    <div className="panel p-8 text-center">
      <p className="text-muted-foreground">No companies found.</p>
      <Link
        href="/search"
        className="primary-btn mt-4 inline-flex text-sm"
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
        <thead className="bg-muted text-sm text-muted-foreground">
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
              className="border-t border-border transition hover:bg-muted/60"
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
      <SectionHeader
        eyebrow="Registry"
        title="Company profiles"
        description="Browse indexed organisations and open profile-level intelligence views."
      />

      {loading && <LoadingSkeleton />}
      {!loading && error && <ErrorState message={error} onRetry={retry} />}
      {!loading && !error && data.length === 0 && <EmptyState />}
      {!loading && !error && data.length > 0 && <CompaniesTable companies={data} />}
    </section>
  );
}


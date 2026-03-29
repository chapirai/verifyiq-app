'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { useCompanyFreshness } from '@/hooks/use-company-freshness';
import { useSnapshotHistory } from '@/hooks/use-snapshot-history';
import { useChangeEvents } from '@/hooks/use-change-events';
import { useCompanyLookup } from '@/hooks/use-company-lookup';
import { CompanyHeader } from '@/components/company/CompanyHeader';
import { CompanyDetailsGrid } from '@/components/company/CompanyDetailsGrid';
import { FreshnessIndicator } from '@/components/company/FreshnessIndicator';
import { DataSourceBadge } from '@/components/company/DataSourceBadge';
import { TabNavigation } from '@/components/company/TabNavigation';
import { FreshnessPanel } from '@/components/company/FreshnessPanel';
import { SourcePanel } from '@/components/company/SourcePanel';
import { SnapshotHistoryPanel } from '@/components/company/SnapshotHistoryPanel';
import { ChangeSummaryPanel } from '@/components/company/ChangeSummaryPanel';

function SkeletonBlock({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-slate-800 ${className ?? ''}`} />;
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="flex items-start gap-4">
          <SkeletonBlock className="h-14 w-14 shrink-0 rounded-xl" />
          <div className="flex-1 space-y-2">
            <SkeletonBlock className="h-7 w-48" />
            <SkeletonBlock className="h-4 w-32" />
          </div>
        </div>
      </div>
      {/* Tabs skeleton */}
      <SkeletonBlock className="h-10 w-full" />
      {/* Details skeleton */}
      <div className="rounded-2xl border border-border bg-card p-6">
        <SkeletonBlock className="mb-4 h-4 w-28" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* Static skeleton blocks - index key is stable since this list never reorders */}
        {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <SkeletonBlock className="h-3 w-20" />
              <SkeletonBlock className="h-4 w-32" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function CompanyProfilePage() {
  const params = useParams();
  const orgNumber = typeof params.orgNumber === 'string' ? params.orgNumber : '';

  const { user } = useAuth();
  const canViewSensitive = ['admin', 'audit', 'evidence', 'compliance'].includes(user?.role ?? '');
  const [snapshotLimit, setSnapshotLimit] = useState(10);

  const { data, loading, error, refreshing, cooldownRemaining, refresh } = useCompanyLookup(orgNumber);
  const {
    data: freshnessData,
    loading: freshnessLoading,
    error: freshnessError,
    retry: retryFreshness,
  } = useCompanyFreshness(orgNumber);
  const {
    data: snapshotHistory,
    loading: snapshotLoading,
    error: snapshotError,
    retry: retrySnapshots,
  } = useSnapshotHistory(orgNumber, snapshotLimit);
  const {
    data: changeEvents,
    loading: changeLoading,
    error: changeError,
    retry: retryChanges,
  } = useChangeEvents(orgNumber, 6, canViewSensitive);

  const company = data?.company;
  const metadata = data?.metadata;

  return (
    <div className="space-y-6">
      {/* Breadcrumb / back nav */}
      <div className="flex items-center gap-2 text-sm text-slate-400">
        <Link href="/companies" className="transition hover:text-white">
          Companies
        </Link>
        <span>/</span>
        <span className="text-slate-200">{orgNumber}</span>
      </div>

      {/* Error state */}
      {error && !loading && (
        <div className="rounded-xl border border-red-700 bg-red-900/30 p-5">
          <p className="font-medium text-red-300">{error}</p>
          <div className="mt-3 flex gap-3">
            <button
              onClick={() => refresh()}
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
      )}

      {/* Loading skeleton */}
      {loading && <LoadingSkeleton />}

      {/* Company profile */}
      {!loading && !error && company && metadata && (
        <>
          {/* Header */}
          <CompanyHeader
            legalName={company.legalName}
            orgNumber={company.organisationNumber ?? orgNumber}
            status={company.status}
            countryCode={company.countryCode}
          />

          {/* Metadata row */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <DataSourceBadge
                source={metadata.source}
                degraded={metadata.degraded}
                failureState={metadata.failure_state}
              />
              <FreshnessIndicator
                fetchedAt={metadata.fetched_at}
                ageDays={metadata.age_days}
                freshness={metadata.freshness}
              />
            </div>
            <button
              onClick={() => refresh()}
              disabled={refreshing || cooldownRemaining > 0}
              title={cooldownRemaining > 0 ? `Please wait ${cooldownRemaining}s before refreshing again` : 'Fetch fresh data from API (bypasses cache)'}
              aria-label="Refresh company data"
              className="flex items-center gap-2 rounded-xl bg-slate-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {refreshing ? (
                <>
                  <svg
                    className="h-4 w-4 animate-spin"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Refreshing…
                </>
              ) : cooldownRemaining > 0 ? (
                <>
                  <svg
                    className="h-4 w-4"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                  Refresh ({cooldownRemaining}s)
                </>
              ) : (
                <>
                  <svg
                    className="h-4 w-4"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                  Refresh
                </>
              )}
            </button>
          </div>

          {/* Tab navigation */}
          <TabNavigation />

          {/* Details grid */}
          <CompanyDetailsGrid
            orgNumber={company.organisationNumber ?? orgNumber}
            registeredAt={company.registeredAt}
            companyForm={company.companyForm}
            countryCode={company.countryCode}
            businessDescription={company.businessDescription}
          />

          <div className="grid gap-6 lg:grid-cols-3">
            <FreshnessPanel
              data={freshnessData}
              loading={freshnessLoading}
              error={freshnessError}
              onRetry={retryFreshness}
            />
            <SourcePanel
              data={freshnessData}
              loading={freshnessLoading}
              error={freshnessError}
              onRetry={retryFreshness}
            />
            <ChangeSummaryPanel
              events={changeEvents}
              loading={changeLoading}
              error={changeError}
              onRetry={retryChanges}
              canViewSensitive={canViewSensitive}
            />
          </div>

          <SnapshotHistoryPanel
            snapshots={snapshotHistory}
            loading={snapshotLoading}
            error={snapshotError}
            onRetry={retrySnapshots}
            pageSize={snapshotLimit}
            onPageSizeChange={setSnapshotLimit}
            canViewSensitive={canViewSensitive}
          />
        </>
      )}
    </div>
  );
}

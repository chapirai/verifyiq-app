'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { LoadingSkeleton, ErrorState } from '@/components/ui/StateBlocks';

export default function DashboardPage() {
  const [data, setData] = useState<{ companies: number; apiKeys: number; bulkJobs: number } | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([api.getCompanies('page=1&pageSize=1'), api.listApiKeys(), api.listBulkJobs()])
      .then(([companies, keys, jobs]) => {
        setData({
          companies: companies.total ?? 0,
          apiKeys: keys.data.length,
          bulkJobs: jobs.data.length,
        });
      })
      .catch((err: { message?: string }) => setError(err?.message ?? 'Could not load dashboard.'));
  }, []);

  if (error) return <ErrorState title="Dashboard unavailable" message={error} />;
  if (!data) return <LoadingSkeleton lines={6} />;

  return (
    <section className="space-y-6">
      <h1 className="font-display text-5xl">Operational overview</h1>
      <div className="grid gap-4 md:grid-cols-3">
        <article className="border-2 border-foreground p-6"><p className="mono-label text-[10px]">Companies</p><p className="mt-2 text-4xl">{data.companies}</p></article>
        <article className="border-2 border-foreground p-6"><p className="mono-label text-[10px]">API Keys</p><p className="mt-2 text-4xl">{data.apiKeys}</p></article>
        <article className="border-2 border-foreground p-6"><p className="mono-label text-[10px]">Bulk Jobs</p><p className="mt-2 text-4xl">{data.bulkJobs}</p></article>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <article className="border-2 border-foreground p-6">
          <p className="mono-label text-[10px]">Compliance Queue</p>
          <ul className="mt-3 space-y-2 text-sm">
            <li>- Run forced refresh for high-risk counterparties</li>
            <li>- Review stale fallback responses with degraded metadata</li>
            <li>- Export bulk failures for remediation handoff</li>
          </ul>
        </article>
        <article className="border-2 border-foreground p-6">
          <p className="mono-label text-[10px]">Quick Actions</p>
          <ul className="mt-3 space-y-2 text-sm">
            <li><a href="/search" className="underline underline-offset-4">Lookup company by org number</a></li>
            <li><a href="/lists" className="underline underline-offset-4">Build and maintain target lists</a></li>
            <li><a href="/compare" className="underline underline-offset-4">Compare shortlisted companies</a></li>
            <li><a href="/alerts" className="underline underline-offset-4">Set up monitoring alerts</a></li>
            <li><a href="/bulk" className="underline underline-offset-4">Create bulk enrichment batch</a></li>
            <li><a href="/billing" className="underline underline-offset-4">Review subscription access</a></li>
          </ul>
        </article>
      </div>
    </section>
  );
}

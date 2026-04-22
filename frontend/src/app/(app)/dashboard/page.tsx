'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { LoadingSkeleton, ErrorState } from '@/components/ui/StateBlocks';

export default function DashboardPage() {
  const [data, setData] = useState<{
    companies: number;
    apiKeys: number;
    bulkJobs: number;
    ops: Awaited<ReturnType<typeof api.getBulkOpsDashboard>> | null;
    adminOpsAccess: boolean;
  } | null>(null);
  const [error, setError] = useState('');
  const [runFileLinks, setRunFileLinks] = useState<Awaited<ReturnType<typeof api.getBulkRunFiles>> | null>(null);
  const [runFileError, setRunFileError] = useState('');

  useEffect(() => {
    Promise.all([
      api.getCompanies('page=1&pageSize=1'),
      api.listApiKeys(),
      api.listBulkJobs(),
      api.getBulkOpsDashboard().catch((e) => {
        if (e instanceof Error && /restricted|forbidden|403/i.test(e.message)) return null;
        return null;
      }),
    ])
      .then(([companies, keys, jobs, ops]) => {
        setData({
          companies: companies.total ?? 0,
          apiKeys: keys.data.length,
          bulkJobs: jobs.data.length,
          ops,
          adminOpsAccess: !!ops,
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
      {data.adminOpsAccess && data.ops ? (
        <section className="space-y-4 border-2 border-foreground p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-2xl">Platform ops dashboard</h2>
            <p className="text-xs text-muted-foreground">
              Weekly status: <span className="font-mono">{data.ops.weekly_run.this_week_status}</span> · parser:{' '}
              <span className="font-mono">{data.ops.weekly_run.parser_profile_used}</span>
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-4">
            <article className="border border-border-light p-3">
              <p className="mono-label text-[10px] text-muted-foreground">This week runs</p>
              <p className="mt-1 text-2xl">{data.ops.weekly_run.this_week_runs}</p>
            </article>
            <article className="border border-border-light p-3">
              <p className="mono-label text-[10px] text-muted-foreground">Deltas (new/updated/removed)</p>
              <p className="mt-1 text-sm font-mono">
                {data.ops.weekly_run.row_deltas.new}/{data.ops.weekly_run.row_deltas.updated}/{data.ops.weekly_run.row_deltas.removed}
              </p>
            </article>
            <article className="border border-border-light p-3">
              <p className="mono-label text-[10px] text-muted-foreground">Failed lines</p>
              <p className="mt-1 text-2xl">{data.ops.weekly_run.failed_lines}</p>
            </article>
            <article className="border border-border-light p-3">
              <p className="mono-label text-[10px] text-muted-foreground">Checkpoint progress</p>
              <p className="mt-1 text-sm font-mono">
                {data.ops.weekly_run.checkpoint_progress.completedCheckpoints} cp / {data.ops.weekly_run.checkpoint_progress.lastLineNumber} lines
              </p>
            </article>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <article className="border border-border-light p-4">
              <p className="mono-label text-[10px] text-muted-foreground">Weekly runs</p>
              <div className="mt-2 space-y-2">
                {data.ops.weekly_runs_recent.map((r) => (
                  <div key={r.id} className="flex items-center justify-between border-b border-border-light pb-2 text-sm">
                    <span className="font-mono">{new Date(r.downloadedAt).toLocaleString()}</span>
                    <span>{r.rowCount} rows</span>
                    <span className="uppercase">{r.status}</span>
                    <button
                      className="underline underline-offset-4"
                      onClick={() => {
                        setRunFileError('');
                        void api
                          .getBulkRunFiles(r.id)
                          .then((x) => setRunFileLinks(x))
                          .catch((e) => setRunFileError(e instanceof Error ? e.message : 'Failed to load file links'));
                      }}
                    >
                      Files
                    </button>
                  </div>
                ))}
              </div>
              {runFileError ? <p className="mt-2 text-xs text-destructive">{runFileError}</p> : null}
              {runFileLinks ? (
                <div className="mt-3 space-y-1 text-xs">
                  <a href={runFileLinks.zip.url} target="_blank" rel="noreferrer" className="underline underline-offset-4">
                    Download ZIP
                  </a>
                  <a href={runFileLinks.txt.url} target="_blank" rel="noreferrer" className="ml-3 underline underline-offset-4">
                    Download TXT
                  </a>
                </div>
              ) : null}
            </article>

            <article className="border border-border-light p-4">
              <p className="mono-label text-[10px] text-muted-foreground">Customer package utilization (30d API usage)</p>
              <div className="mt-2 space-y-2">
                {data.ops.customer_usage.by_tenant.slice(0, 8).map((t) => (
                  <div key={t.tenantId} className="border-b border-border-light pb-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span>{t.tenantName}</span>
                      <span className="font-mono">{t.planCode}</span>
                    </div>
                    <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                      <span>{t.apiCalls30d} calls / {t.includedCallsPerDay} daily tier</span>
                      <span>{t.packageUtilizationPct}%</span>
                    </div>
                    <div className="mt-1 h-2 w-full border border-border-light">
                      <div
                        className={`h-full ${t.packageUtilizationPct >= 100 ? 'bg-destructive' : t.packageUtilizationPct >= 80 ? 'bg-amber-500' : 'bg-emerald-600'}`}
                        style={{ width: `${Math.min(100, Math.max(0, t.packageUtilizationPct))}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </article>
          </div>
        </section>
      ) : (
        <article className="border border-border-light p-4 text-sm text-muted-foreground">
          Platform operations dashboard is visible to platform admin only.
        </article>
      )}
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

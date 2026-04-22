'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { LoadingSkeleton, ErrorState } from '@/components/ui/StateBlocks';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';

function weekToIsoDate(weekVal: string): string | undefined {
  if (!weekVal || !/^\d{4}-W\d{2}$/.test(weekVal)) return undefined;
  const [year, week] = weekVal.split('-W').map(Number);
  if (!year || !week) return undefined;
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = jan4.getUTCDay() || 7;
  const mondayWeek1 = new Date(jan4);
  mondayWeek1.setUTCDate(jan4.getUTCDate() - (jan4Day - 1));
  const d = new Date(mondayWeek1);
  d.setUTCDate(mondayWeek1.getUTCDate() + (week - 1) * 7);
  return d.toISOString().slice(0, 10);
}

function defaultWeekInput(): string {
  const now = new Date();
  const day = now.getDay() || 7;
  const thursday = new Date(now);
  thursday.setDate(now.getDate() + (4 - day));
  const yearStart = new Date(thursday.getFullYear(), 0, 1);
  const week = Math.ceil((((thursday.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${thursday.getFullYear()}-W${String(week).padStart(2, '0')}`;
}

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
  const [week, setWeek] = useState(defaultWeekInput());
  const [tenantFilter, setTenantFilter] = useState('');
  const [planFilter, setPlanFilter] = useState('');
  const [tenantPage, setTenantPage] = useState(1);
  const [tenantLimit, setTenantLimit] = useState(10);
  const [opsLoading, setOpsLoading] = useState(false);
  const [forceSourceUrl, setForceSourceUrl] = useState('');
  const [opsActionMsg, setOpsActionMsg] = useState('');

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

  const reloadOps = () => {
    if (!data?.adminOpsAccess) return;
    setOpsLoading(true);
    void api
      .getBulkOpsDashboard({
        weekStart: weekToIsoDate(week),
        tenantId: tenantFilter || undefined,
        planCode: planFilter || undefined,
        tenantPage,
        tenantLimit,
      })
      .then((ops) => setData((prev) => (prev ? { ...prev, ops } : prev)))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed loading ops dashboard'))
      .finally(() => setOpsLoading(false));
  };

  const reloadOpsForPage = (nextPage: number) => {
    if (!data?.adminOpsAccess) return;
    setOpsLoading(true);
    void api
      .getBulkOpsDashboard({
        weekStart: weekToIsoDate(week),
        tenantId: tenantFilter || undefined,
        planCode: planFilter || undefined,
        tenantPage: nextPage,
        tenantLimit,
      })
      .then((ops) => {
        setTenantPage(nextPage);
        setData((prev) => (prev ? { ...prev, ops } : prev));
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed loading ops dashboard'))
      .finally(() => setOpsLoading(false));
  };

  const downloadCsv = (type: 'tenant_usage' | 'run_deltas') => {
    if (!data?.adminOpsAccess) return;
    void api
      .exportBulkOpsCsv(type, {
        weekStart: weekToIsoDate(week),
        tenantId: tenantFilter || undefined,
        planCode: planFilter || undefined,
      })
      .then((csv) => {
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `verifyiq-${type}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'CSV export failed'));
  };

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
          <div className="grid gap-2 md:grid-cols-[170px_1fr_160px_auto_auto_auto]">
            <Input type="week" value={week} onChange={(e) => setWeek(e.target.value)} />
            <Select value={tenantFilter} onChange={(e) => setTenantFilter(e.target.value)}>
              <option value="">All tenants</option>
              {data.ops.customer_usage.by_tenant.map((t) => (
                <option key={t.tenantId} value={t.tenantId}>{t.tenantName}</option>
              ))}
            </Select>
            <Select value={planFilter} onChange={(e) => setPlanFilter(e.target.value)}>
              <option value="">All plans</option>
              <option value="free">free</option>
              <option value="basic">basic</option>
              <option value="pro">pro</option>
            </Select>
            <Select value={String(tenantLimit)} onChange={(e) => setTenantLimit(Number(e.target.value))}>
              <option value="10">10 per page</option>
              <option value="25">25 per page</option>
              <option value="50">50 per page</option>
            </Select>
            <Button type="button" variant="secondary" onClick={reloadOps} disabled={opsLoading}>
              {opsLoading ? 'Loading…' : 'Apply filters'}
            </Button>
            <Button type="button" variant="secondary" onClick={() => downloadCsv('tenant_usage')}>
              Export tenant CSV
            </Button>
            <Button type="button" variant="secondary" onClick={() => downloadCsv('run_deltas')}>
              Export run CSV
            </Button>
          </div>
          <div className="grid gap-2 md:grid-cols-[1fr_auto_auto]">
            <Input
              value={forceSourceUrl}
              onChange={(e) => setForceSourceUrl(e.target.value)}
              placeholder="Optional override ZIP URL for forced ingestion"
            />
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setOpsActionMsg('');
                void api
                  .forceBulkRunNow(forceSourceUrl.trim() || undefined)
                  .then(() => {
                    setOpsActionMsg('Forced ingestion started.');
                    reloadOps();
                  })
                  .catch((e) => setOpsActionMsg(e instanceof Error ? e.message : 'Force run failed'));
              }}
            >
              Force download + full ingest
            </Button>
            {opsActionMsg ? <p className="text-xs text-muted-foreground">{opsActionMsg}</p> : null}
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
            <article className="border border-border-light p-3">
              <p className="mono-label text-[10px] text-muted-foreground">Run health score</p>
              <p
                className={`mt-1 text-2xl ${
                  data.ops.weekly_run.health_score.color === 'green'
                    ? 'text-emerald-700'
                    : data.ops.weekly_run.health_score.color === 'yellow'
                      ? 'text-amber-700'
                      : 'text-destructive'
                }`}
              >
                {data.ops.weekly_run.health_score.score}
              </p>
              <p className="text-[10px] uppercase text-muted-foreground">{data.ops.weekly_run.health_score.color}</p>
            </article>
          </div>
          {data.ops.weekly_run.health_score.reasons.length > 0 ? (
            <ul className="list-inside list-disc text-xs text-muted-foreground">
              {data.ops.weekly_run.health_score.reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-2">
            <article className="border border-border-light p-4">
              <p className="mono-label text-[10px] text-muted-foreground">Weekly runs</p>
              <div className="mt-2 space-y-2">
                {data.ops.weekly_runs_recent.map((r) => (
                  <div key={r.id} className="flex items-center justify-between border-b border-border-light pb-2 text-sm">
                    <span className="font-mono">{new Date(r.downloadedAt).toLocaleString()}</span>
                    <span>{r.rowCount} rows</span>
                    <span className="uppercase">{r.status}</span>
                    <div className="flex items-center gap-2">
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
                      <button
                        className="underline underline-offset-4"
                        onClick={() => {
                          setOpsActionMsg('');
                          void api
                            .replayBulkRun(r.id)
                            .then(() => {
                              setOpsActionMsg(`Replay queued for run ${r.id}.`);
                              reloadOps();
                            })
                            .catch((e) => setOpsActionMsg(e instanceof Error ? e.message : 'Replay failed'));
                        }}
                      >
                        Replay
                      </button>
                    </div>
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
                {data.ops.customer_usage.by_tenant.map((t) => (
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
              <div className="mt-3 flex items-center justify-between text-xs">
                <p className="text-muted-foreground">
                  Page {data.ops.customer_usage.page} · showing {data.ops.customer_usage.by_tenant.length} / {data.ops.customer_usage.tenants_total}
                </p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    className="min-h-8 px-3 py-1 text-[10px]"
                    disabled={tenantPage <= 1}
                    onClick={() => {
                      const next = Math.max(1, tenantPage - 1);
                      reloadOpsForPage(next);
                    }}
                  >
                    Prev
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    className="min-h-8 px-3 py-1 text-[10px]"
                    disabled={!data.ops.customer_usage.has_next}
                    onClick={() => {
                      const next = tenantPage + 1;
                      reloadOpsForPage(next);
                    }}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </article>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <article className="border border-border-light p-4">
              <p className="mono-label text-[10px] text-muted-foreground">Run health trend</p>
              <svg viewBox="0 0 600 180" className="mt-2 w-full border border-border-light bg-muted/20">
                {data.ops.charts.run_health_series.map((p, i, arr) => {
                  const x = arr.length <= 1 ? 20 : 20 + (i * 560) / (arr.length - 1);
                  const y = 160 - (Math.max(0, Math.min(100, p.score)) * 1.4);
                  const next = arr[i + 1];
                  if (!next) return null;
                  const nx = 20 + ((i + 1) * 560) / (arr.length - 1);
                  const ny = 160 - (Math.max(0, Math.min(100, next.score)) * 1.4);
                  return <line key={`${p.runId}-l`} x1={x} y1={y} x2={nx} y2={ny} stroke="currentColor" strokeOpacity="0.6" />;
                })}
                {data.ops.charts.run_health_series.map((p, i, arr) => {
                  const x = arr.length <= 1 ? 20 : 20 + (i * 560) / (arr.length - 1);
                  const y = 160 - (Math.max(0, Math.min(100, p.score)) * 1.4);
                  const fill = p.score >= 80 ? '#047857' : p.score >= 50 ? '#b45309' : '#b91c1c';
                  return <circle key={p.runId} cx={x} cy={y} r={4} fill={fill} />;
                })}
              </svg>
            </article>
            <article className="border border-border-light p-4">
              <p className="mono-label text-[10px] text-muted-foreground">API calls daily (30d)</p>
              <svg viewBox="0 0 600 180" className="mt-2 w-full border border-border-light bg-muted/20">
                {(() => {
                  const arr = data.ops.charts.api_calls_30d_daily;
                  const max = Math.max(1, ...arr.map((d) => d.apiCalls));
                  return arr.map((d, i) => {
                    const x = arr.length <= 1 ? 20 : 20 + (i * 560) / (arr.length - 1);
                    const y = 160 - (d.apiCalls / max) * 140;
                    const next = arr[i + 1];
                    if (!next) return <circle key={`${d.day}-p`} cx={x} cy={y} r={2} fill="currentColor" />;
                    const nx = 20 + ((i + 1) * 560) / (arr.length - 1);
                    const ny = 160 - (next.apiCalls / max) * 140;
                    return (
                      <g key={`${d.day}-g`}>
                        <line x1={x} y1={y} x2={nx} y2={ny} stroke="currentColor" strokeOpacity="0.6" />
                        <circle cx={x} cy={y} r={2} fill="currentColor" />
                      </g>
                    );
                  });
                })()}
              </svg>
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

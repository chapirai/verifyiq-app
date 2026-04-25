'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

type LogEntry = { at: string; kind: 'ok' | 'err'; label: string; text: string };

function formatApiError(e: unknown): string {
  if (e instanceof ApiError) {
    const detail =
      e.details !== undefined && e.details !== null
        ? typeof e.details === 'string'
          ? e.details
          : JSON.stringify(e.details, null, 2)
        : '';
    return `${e.message} (HTTP ${e.status})${detail ? `\n${detail}` : ''}`;
  }
  if (e instanceof Error) return e.message;
  return String(e);
}

function jobDescription(name: string): string {
  if (name === 'run-weekly-ingestion') {
    return 'Downloads the configured Bolagsverket bulk ZIP, parses TXT into bulk tables (uses BV_BULK_WEEKLY_URL unless job payload carries sourceUrl).';
  }
  if (name === 'process-enrichment-request') {
    return 'Processes a queued per-org deep enrichment request (separate from the main ZIP file ingest).';
  }
  return 'Background worker job on bolagsverket-bulk queue.';
}

function formatFailureStep(step: string | null | undefined): string {
  if (!step) return 'unknown';
  if (step === 'download_zip') return 'download ZIP';
  if (step === 'extract_txt') return 'extract TXT from ZIP';
  if (step === 'parse_stream') return 'parse/flush TXT stream';
  if (step === 'apply_changes') return 'apply staging/current changes';
  return step.replace(/_/g, ' ');
}

function formatPipelineStep(step: string): string {
  if (step === 'download_zip') return 'download ZIP';
  if (step === 'archive_zip') return 'archive ZIP to object storage';
  if (step === 'extract_txt') return 'extract TXT from ZIP';
  if (step === 'parse_stream') return 'parse + stage TXT stream';
  if (step === 'apply_changes') return 'apply staged changes';
  return step.replace(/_/g, ' ');
}

function formatTs(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms)) return '—';
  return new Date(ms).toISOString();
}

export function BolagsverketBulkFileIngestionPanel({ variant = 'dashboard' }: { variant?: 'dashboard' | 'workspace' }) {
  const [overrideUrl, setOverrideUrl] = useState('');
  const [queueSnapshot, setQueueSnapshot] = useState<Record<string, unknown> | null>(null);
  const [dbRuns, setDbRuns] = useState<Awaited<ReturnType<typeof api.listBolagsverketFileRuns>> | null>(null);
  const [snapshotErr, setSnapshotErr] = useState('');
  const [queueBusy, setQueueBusy] = useState(false);
  const [forceBusy, setForceBusy] = useState(false);
  const [log, setLog] = useState<LogEntry[]>([]);

  const pushLog = useCallback((kind: 'ok' | 'err', label: string, text: string) => {
    setLog(prev => [{ at: new Date().toISOString(), kind, label, text }, ...prev].slice(0, 14));
  }, []);

  const refreshSnapshot = useCallback(async () => {
    setSnapshotErr('');
    try {
      const [snap, runs] = await Promise.all([
        api.getBolagsverketFileIngestionQueue(),
        api.listBolagsverketFileRuns(20),
      ]);
      setQueueSnapshot(snap);
      setDbRuns(runs);
    } catch (e: unknown) {
      setSnapshotErr(formatApiError(e));
    }
  }, []);

  useEffect(() => {
    void refreshSnapshot();
    const t = setInterval(() => void refreshSnapshot(), 5000);
    return () => clearInterval(t);
  }, [refreshSnapshot]);

  const borderClass =
    variant === 'workspace' ? 'border border-dashed border-foreground/40' : 'border-2 border-foreground';

  const counts = (queueSnapshot?.counts ?? null) as Record<string, number> | null;
  const jobs = (queueSnapshot?.jobs ?? []) as Array<{
    id: string | null;
    name: string;
    state: string;
    data: Record<string, unknown>;
    timestamp: number;
    processedOn: number | null;
    finishedOn: number | null;
    failedReason: string | null;
  }>;
  const recentFileRunsFromQueue = (queueSnapshot?.recentFileRuns ?? []) as Array<{
    id: string;
    sourceUrl: string;
    status: string;
    testCompleted?: boolean;
    failureStep?: string | null;
    failureDetail?: string | null;
    pipelineSteps?: Array<{
      step: string;
      status: 'success' | 'failed' | 'skipped' | 'pending';
      message: string | null;
    }>;
  }>;
  const failureByRunId = new Map(
    recentFileRunsFromQueue
      .filter(r => !!r.id)
      .map(r => [
        r.id,
        {
          failureStep: r.failureStep ?? null,
          failureDetail: r.failureDetail ?? null,
          pipelineSteps: r.pipelineSteps ?? [],
        },
      ]),
  );
  const desc = queueSnapshot?.description as
    | {
        headline?: string;
        not_customer_bulk_ui?: string;
        tables_written?: string[];
        company_read_model_flags?: string;
      }
    | undefined;

  return (
    <section className={`space-y-4 ${borderClass} p-4 md:p-6`}>
      <div>
        <h2 className="font-display text-2xl md:text-3xl">Bolagsverket bulk file ingestion</h2>
        <p className="mt-2 max-w-4xl text-sm leading-relaxed text-muted-foreground">
          {desc?.headline ??
            'This is the only ingestion path that ships as a Bolagsverket bulk archive (ZIP + TXT). Live company lookups use HVD/FI APIs; they do not replace this file pipeline.'}
        </p>
        <aside className="mt-4 max-w-4xl border border-amber-500/40 bg-amber-500/5 p-3 text-sm leading-relaxed text-foreground">
          <p className="font-semibold">Not the same as customer “Bulk” in the app menu</p>
          <p className="mt-1 text-muted-foreground">
            <Link href="/bulk" className="underline underline-offset-4">
              /bulk
            </Link>{' '}
            is for end users: paste org numbers (or future file upload), then each row is queued and run against the normal company APIs. It does{' '}
            <strong>not</strong> download the national Bolagsverket bulk ZIP or fill the <code className="font-mono text-xs">bv_bulk_*</code> file tables.
            Only the controls below do that.
          </p>
          {desc?.not_customer_bulk_ui ? (
            <p className="mt-2 border-t border-amber-500/20 pt-2 text-xs text-muted-foreground">{desc.not_customer_bulk_ui}</p>
          ) : null}
        </aside>
      </div>

      {desc?.tables_written?.length ? (
        <div className="rounded-md border border-border-light bg-muted/20 p-3 text-xs leading-relaxed text-muted-foreground">
          <p className="mono-label mb-2 text-[10px] text-foreground">Tables and flags</p>
          <ul className="list-inside list-disc space-y-1">
            {desc.tables_written.map(line => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          {desc.company_read_model_flags ? (
            <p className="mt-3 border-t border-border-light pt-2">{desc.company_read_model_flags}</p>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0 flex-1 space-y-2">
          <label className="mono-label block text-[10px] text-muted-foreground">
            Optional ZIP URL override (POST /runs/force only; weekly queued job uses server config)
          </label>
          <Input
            value={overrideUrl}
            onChange={e => setOverrideUrl(e.target.value)}
            placeholder="https://…/bolagsverket_bulkfil.zip"
            className="font-mono text-xs"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            disabled={queueBusy}
            onClick={() => {
              setQueueBusy(true);
              void api
                .enqueueBolagsverketWeeklyFileJob()
                .then(res => {
                  pushLog('ok', 'Queued weekly file job', JSON.stringify(res, null, 2));
                  void refreshSnapshot();
                })
                .catch(e => pushLog('err', 'Queue weekly file job', formatApiError(e)))
                .finally(() => setQueueBusy(false));
            }}
          >
            {queueBusy ? 'Queuing…' : 'Queue weekly file ingest'}
          </Button>
          <Button
            type="button"
            disabled={forceBusy}
            onClick={() => {
              setForceBusy(true);
              const url = overrideUrl.trim();
              void api
                .forceBulkRunNow(url || undefined)
                .then(res => {
                  pushLog('ok', 'Forced file download + ingest', JSON.stringify(res, null, 2));
                  void refreshSnapshot();
                })
                .catch(e => pushLog('err', 'Forced file download + ingest', formatApiError(e)))
                .finally(() => setForceBusy(false));
            }}
          >
            {forceBusy ? 'Queuing forced ingest…' : 'Queue forced file ingest'}
          </Button>
          <Button type="button" variant="secondary" onClick={() => void refreshSnapshot()}>
            Refresh status
          </Button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        “Queue weekly” and “Queue forced” both add BullMQ jobs (concurrency 1). This avoids running full ZIP/TXT ingest inside the web request, which helps prevent Render memory spikes.
      </p>

      {snapshotErr ? (
        <div className="rounded-md border border-destructive/50 bg-destructive/5 p-3 text-sm text-destructive" role="alert">
          <p className="font-semibold">Could not load queue / file-run snapshot</p>
          <pre className="mt-2 whitespace-pre-wrap break-words font-mono text-xs">{snapshotErr}</pre>
        </div>
      ) : null}

      {counts && Object.keys(counts).length > 0 ? (
        <div>
          <p className="mono-label text-[10px] text-muted-foreground">Queue counts (BullMQ)</p>
          <div className="mt-2 flex flex-wrap gap-2 font-mono text-xs">
            {Object.entries(counts)
              .filter(([, v]) => v > 0)
              .map(([k, v]) => (
                <span key={k} className="border border-border-light px-2 py-1">
                  {k}: {v}
                </span>
              ))}
            {Object.values(counts).every(v => v === 0) ? (
              <span className="text-muted-foreground">All job buckets are at zero.</span>
            ) : null}
          </div>
        </div>
      ) : null}

      <div>
        <p className="mono-label text-[10px] text-muted-foreground">Queued / running / recent worker jobs</p>
        {jobs.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No jobs returned in the inspected windows (or queue is empty).</p>
        ) : (
          <ul className="mt-2 space-y-3 border border-border-light p-3 text-xs">
            {jobs.map((j, idx) => (
              <li key={`${j.id ?? idx}-${j.timestamp}`} className="border-b border-border-light pb-3 last:border-0 last:pb-0">
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="font-semibold uppercase">{j.state}</span>
                  <span className="font-mono">{j.name}</span>
                  {j.id ? <span className="text-muted-foreground">id {j.id}</span> : null}
                </div>
                <p className="mt-1 text-muted-foreground">{jobDescription(j.name)}</p>
                <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                  created {formatTs(j.timestamp)} · processed {formatTs(j.processedOn ?? undefined)} · finished{' '}
                  {formatTs(j.finishedOn ?? undefined)}
                </p>
                {Object.keys(j.data ?? {}).length > 0 ? (
                  <pre className="mt-2 max-h-32 overflow-auto rounded bg-muted/40 p-2 font-mono text-[10px]">
                    {JSON.stringify(j.data, null, 2)}
                  </pre>
                ) : (
                  <p className="mt-1 text-[10px] text-muted-foreground">Job payload: {'{}'} (weekly job uses server URL from env)</p>
                )}
                {j.failedReason ? (
                  <div className="mt-2 space-y-1 text-destructive">
                    <p>
                      <span className="font-semibold">Failed: </span>
                      {j.failedReason}
                    </p>
                    {typeof j.data?.runId === 'string' && failureByRunId.get(j.data.runId)?.failureStep ? (
                      <p className="font-mono text-[10px]">
                        Step: {formatFailureStep(failureByRunId.get(j.data.runId)?.failureStep)}
                      </p>
                    ) : null}
                    {typeof j.data?.runId === 'string' && failureByRunId.get(j.data.runId)?.failureDetail ? (
                      <p className="font-mono text-[10px] whitespace-pre-wrap break-words">
                        {failureByRunId.get(j.data.runId)?.failureDetail}
                      </p>
                    ) : null}
                    {typeof j.data?.runId === 'string' && (failureByRunId.get(j.data.runId)?.pipelineSteps?.length ?? 0) > 0 ? (
                      <ul className="mt-1 space-y-1 font-mono text-[10px]">
                        {failureByRunId.get(j.data.runId)?.pipelineSteps?.map(step => (
                          <li key={`${j.data.runId}-${step.step}`}>
                            [{step.status.toUpperCase()}] {formatPipelineStep(step.step)}
                            {step.message ? ` — ${step.message}` : ''}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <p className="mono-label text-[10px] text-muted-foreground">Recent file runs (database)</p>
        {!dbRuns?.length ? (
          <p className="mt-2 text-sm text-muted-foreground">No rows in bv_bulk_file_runs yet, or list failed.</p>
        ) : (
          <ul className="mt-2 space-y-3 border border-border-light p-3 text-xs">
            {dbRuns.map(r => (
              <li key={r.id} className="border-b border-border-light pb-3 last:border-0 last:pb-0">
                <div className="flex flex-wrap gap-2">
                  <span className="font-semibold uppercase">{r.status}</span>
                  {r.testCompleted ? (
                    <span className="border border-emerald-500/50 bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[10px] uppercase text-emerald-600">
                      test_completed
                    </span>
                  ) : null}
                  <span className="font-mono text-muted-foreground">{r.id}</span>
                  <span>{r.rowCount} rows</span>
                  {r.parserProfile ? <span className="text-muted-foreground">parser {r.parserProfile}</span> : null}
                </div>
                <p className="mt-1 break-all font-mono text-[10px] text-muted-foreground">source: {r.sourceUrl}</p>
                <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                  downloaded {new Date(r.downloadedAt).toISOString()}
                  {r.effectiveDate ? ` · effective ${r.effectiveDate}` : ''}
                </p>
                <p className="mt-1 break-all font-mono text-[10px] text-muted-foreground">ZIP key: {r.zipObjectKey}</p>
                <p className="mt-1 break-all font-mono text-[10px] text-muted-foreground">TXT key: {r.txtObjectKey}</p>
                {r.errorMessage && !r.testCompleted ? (
                  <p className="mt-2 text-destructive">
                    <span className="font-semibold">errorMessage: </span>
                    {r.errorMessage}
                  </p>
                ) : null}
                {r.failureStep ? (
                  <p className="mt-1 text-destructive">
                    <span className="font-semibold">failed step: </span>
                    {formatFailureStep(r.failureStep)}
                  </p>
                ) : null}
                {r.failureDetail ? (
                  <p className="mt-1 whitespace-pre-wrap break-words font-mono text-[10px] text-destructive">
                    {r.failureDetail}
                  </p>
                ) : null}
                {r.pipelineSteps?.length ? (
                  <div className="mt-2 rounded border border-border-light bg-muted/20 p-2">
                    <p className="mono-label text-[10px] text-muted-foreground">pipeline steps</p>
                    <ul className="mt-1 space-y-1 font-mono text-[10px]">
                      {r.pipelineSteps.map(step => (
                        <li key={`${r.id}-${step.step}`}>
                          [{step.status.toUpperCase()}] {formatPipelineStep(step.step)}
                          {step.message ? ` — ${step.message}` : ''}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      {log.length > 0 ? (
        <div>
          <p className="mono-label text-[10px] text-muted-foreground">Action log (button presses)</p>
          <ul className="mt-2 max-h-72 space-y-2 overflow-y-auto border border-border-light p-2 text-xs">
            {log.map((entry, i) => (
              <li
                key={`${entry.at}-${i}`}
                className={entry.kind === 'err' ? 'text-destructive' : 'text-muted-foreground'}
              >
                <span className="font-mono text-[10px]">{entry.at}</span> — <span className="font-semibold">{entry.label}</span>
                <pre className="mt-1 whitespace-pre-wrap break-words font-mono text-[10px]">{entry.text}</pre>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

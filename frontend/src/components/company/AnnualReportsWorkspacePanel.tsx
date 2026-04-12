'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { SectionCard, StatGrid, EmptyStatePro } from '@/components/company/workspace-ui';
import type {
  AnnualReportFinancialComparison,
  AnnualReportWorkspaceReadModel,
  AnnualReportWorkspaceStatementRow,
} from '@/types/annual-reports';

function formatMetricCell(raw: string | null | undefined): string {
  if (raw == null || raw === '') return '—';
  const n = Number(raw);
  if (!Number.isFinite(n)) return raw;
  return n.toLocaleString('sv-SE', { maximumFractionDigits: 2 });
}

function StatementTable({
  title,
  rows,
}: {
  title: string;
  rows: AnnualReportWorkspaceStatementRow[];
}) {
  if (!rows.length) {
    return (
      <SectionCard title={title}>
        <p className="text-sm text-muted-foreground">No mapped rows for this statement in the latest filing.</p>
      </SectionCard>
    );
  }
  return (
    <SectionCard title={title}>
      <div className="overflow-x-auto border border-border-light">
        <table className="w-full min-w-[480px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border-light bg-muted/40">
              <th className="px-3 py-2 text-left font-mono text-[10px] uppercase tracking-wide">Post</th>
              <th className="px-3 py-2 text-right font-mono text-[10px] uppercase tracking-wide">Current</th>
              <th className="px-3 py-2 text-right font-mono text-[10px] uppercase tracking-wide">Prior</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={row.code} className={idx % 2 === 0 ? 'bg-background' : 'bg-muted/15'}>
                <td className="px-3 py-2 align-top">
                  <div className="font-medium leading-snug">{row.label}</div>
                  <div className="mt-0.5 font-mono text-[10px] text-muted-foreground">{row.code}</div>
                </td>
                <td className="px-3 py-2 text-right tabular-nums align-top">{formatMetricCell(row.current)}</td>
                <td className="px-3 py-2 text-right tabular-nums align-top">{formatMetricCell(row.prior)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}

export function AnnualReportsWorkspacePanel({ orgNumber }: { orgNumber: string }) {
  const [data, setData] = useState<AnnualReportFinancialComparison | null>(null);
  const [readModel, setReadModel] = useState<AnnualReportWorkspaceReadModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [comparison, workspace] = await Promise.all([
        api.getAnnualReportFinancialComparison(orgNumber, { maxYears: 50 }),
        api.getAnnualReportWorkspaceReadModel(orgNumber),
      ]);
      setData(comparison);
      setReadModel(workspace);
    } catch (e) {
      setData(null);
      setReadModel(null);
      setError(e instanceof Error ? e.message : 'Could not load annual report data');
    } finally {
      setLoading(false);
    }
  }, [orgNumber]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadRef = useRef(load);
  loadRef.current = load;
  useEffect(() => {
    const t = setInterval(() => void loadRef.current(), 18_000);
    return () => clearInterval(t);
  }, []);

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading extracted annual reports…</p>;
  }

  if (error) {
    return <p className="text-sm text-destructive">{error}</p>;
  }

  const hasComparison = data && data.years.length > 0;
  const hasRead = readModel && readModel.headerId;

  if (!hasComparison && !hasRead) {
    return (
      <EmptyStatePro
        title="No parsed annual reports yet"
        message="When the workspace loads the HVD dokumentlista, the server queues ZIP download, MinIO storage, and Arelle parsing automatically. If nothing appears yet, wait for the background worker, then use Refresh. Browser-only download does not populate the database."
      />
    );
  }

  const yearKeys = data?.years.map(String) ?? [];
  const wm = readModel?.workspaceView;
  const capNote =
    readModel &&
    (readModel.rawFactTotals.annualReport > readModel.rawFacts.annualReport.length ||
      readModel.rawFactTotals.auditReport > readModel.rawFacts.auditReport.length)
      ? 'Showing a capped sample of raw facts for performance; totals reflect full import.'
      : null;

  return (
    <div className="space-y-8">
      {hasRead && readModel && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              Latest import read model: fiscal period, source files (årsredovisning vs revisionsberättelse), statement
              tables, and audit fields. Values are derived from tagged iXBRL with context-aware mapping — not scraped
              HTML.
            </p>
            <button
              type="button"
              onClick={() => void load()}
              className="border-2 border-foreground bg-background px-3 py-2 font-mono text-[10px] uppercase tracking-widest hover:bg-muted"
            >
              Refresh
            </button>
          </div>

          <SectionCard title="Overview">
            <StatGrid stats={wm?.overviewCards ?? []} />
          </SectionCard>

          <SectionCard title="Key metrics (summary layer)">
            <FieldGridSummary summary={readModel.summary} />
          </SectionCard>

          <div className="grid gap-4 lg:grid-cols-2">
            <StatementTable title="Income statement" rows={readModel.statementTables.incomeStatement} />
            <StatementTable title="Balance sheet" rows={readModel.statementTables.balanceSheet} />
            <StatementTable title="Cash flow" rows={readModel.statementTables.cashFlow} />
            <StatementTable title="Equity" rows={readModel.statementTables.equity} />
          </div>
          {readModel.statementTables.other.length > 0 ? (
            <StatementTable title="Other mapped lines" rows={readModel.statementTables.other} />
          ) : null}

          <SectionCard title="Audit report (separate from financial statements)">
            <dl className="grid gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Auditor</dt>
                <dd className="mt-1 text-sm">{wm?.auditPanel.auditorName ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Audit firm</dt>
                <dd className="mt-1 text-sm">{wm?.auditPanel.auditorFirm ?? '—'}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Opinion / indication
                </dt>
                <dd className="mt-1 text-sm leading-relaxed">{wm?.auditPanel.auditOpinion ?? '—'}</dd>
              </div>
            </dl>
          </SectionCard>

          <SectionCard title="Source files in ZIP">
            {readModel.sourceFiles.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No source-file rows (legacy import before multi-file tracking).
              </p>
            ) : (
              <ul className="space-y-2 text-sm">
                {readModel.sourceFiles.map((s) => (
                  <li
                    key={s.id}
                    className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border-light pb-2"
                  >
                    <span className="font-mono text-[11px] text-muted-foreground">{s.pathInArchive}</span>
                    <span className="text-xs">
                      <span className="rounded border border-border-light px-1.5 py-0.5 uppercase">{s.documentType}</span>{' '}
                      · {s.parseStatus}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <details className="rounded-sm border border-border-light bg-muted/20 p-4">
            <summary className="cursor-pointer font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Raw facts (debug) — årsredovisning vs revisionsberättelse
            </summary>
            {capNote ? <p className="mt-2 text-xs text-muted-foreground">{capNote}</p> : null}
            <p className="mt-1 text-xs text-muted-foreground">
              Totals: {readModel.rawFactTotals.annualReport} annual-side facts, {readModel.rawFactTotals.auditReport}{' '}
              audit-side facts.
            </p>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <RawFactList title="Annual report facts (sample)" facts={readModel.rawFacts.annualReport} />
              <RawFactList title="Audit report facts (sample)" facts={readModel.rawFacts.auditReport} />
            </div>
          </details>
        </>
      )}

      {hasComparison && data && (
        <div className="space-y-6 border-t border-border-light pt-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              Comparing up to <strong>{data.years.length}</strong> fiscal years (by filing period end), up to 50 when
              available. Refreshes automatically every ~18s while open.
            </p>
            <button
              type="button"
              onClick={() => void load()}
              className="border-2 border-foreground bg-background px-3 py-2 font-mono text-[10px] uppercase tracking-widest hover:bg-muted"
            >
              Refresh
            </button>
          </div>

          <div className="overflow-x-auto border-2 border-foreground">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr className="border-b-2 border-foreground bg-muted/40">
                  <th className="sticky left-0 z-10 min-w-[220px] border-r border-border-light bg-muted/90 px-3 py-2 text-left font-mono text-[10px] uppercase tracking-wide">
                    Post / nyckel
                  </th>
                  {data.columns.map((col) => (
                    <th
                      key={col.year}
                      className="min-w-[120px] px-2 py-2 text-right align-bottom font-mono text-[10px] uppercase"
                    >
                      <div className="font-semibold">{col.year}</div>
                      <div className="mt-1 font-normal normal-case text-muted-foreground">
                        {col.filingPeriodEnd ?? '—'}
                      </div>
                      <div className="mt-0.5 text-[9px] normal-case text-muted-foreground">
                        {col.factCount} facts
                        {col.currencyCode ? ` · ${col.currencyCode}` : ''}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row, idx) => (
                  <tr
                    key={row.canonicalField}
                    className={idx % 2 === 0 ? 'bg-background' : 'bg-muted/20'}
                  >
                    <td className="sticky left-0 z-10 border-r border-border-light bg-inherit px-3 py-2 align-top">
                      <div className="font-medium leading-snug">{row.label}</div>
                      <div className="mt-0.5 font-mono text-[10px] text-muted-foreground">{row.canonicalField}</div>
                    </td>
                    {yearKeys.map((y) => (
                      <td key={y} className="px-2 py-2 text-right tabular-nums align-top">
                        {formatMetricCell(row.byYear[y])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {data.columns.map((col) => (
              <article key={col.headerId} className="border-2 border-foreground p-4">
                <p className="mono-label text-[10px] text-muted-foreground">Räkenskapsår {col.year}</p>
                <p className="mt-1 text-sm">{col.companyName ?? '—'}</p>
                <p className="mt-2 text-xs text-muted-foreground">Revisor: {col.auditorFirm ?? '—'}</p>
              </article>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function FieldGridSummary({ summary }: { summary: Record<string, string | number | null> | null }) {
  if (!summary) {
    return <p className="text-sm text-muted-foreground">No summary row for this import yet.</p>;
  }
  const keys = [
    ['revenue', 'Revenue'],
    ['operatingProfit', 'Operating profit'],
    ['netProfit', 'Net profit'],
    ['totalAssets', 'Total assets'],
    ['equity', 'Equity'],
    ['cashAndBank', 'Cash and bank'],
    ['employeeCount', 'Employees'],
  ] as const;
  const rows = keys
    .map(([k, label]) => {
      const v = summary[k];
      if (v == null || v === '') return null;
      return { label, value: formatMetricCell(String(v)) };
    })
    .filter(Boolean) as { label: string; value: string }[];
  if (!rows.length) {
    return <p className="text-sm text-muted-foreground">Summary fields not populated for this filing.</p>;
  }
  return (
    <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {rows.map(({ label, value }) => (
        <div key={label} className="min-w-0 border-b border-border-light pb-2">
          <dt className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
          <dd className="mt-1 text-sm tabular-nums">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function RawFactList({
  title,
  facts,
}: {
  title: string;
  facts: AnnualReportWorkspaceReadModel['rawFacts']['annualReport'];
}) {
  if (!facts.length) {
    return (
      <div>
        <p className="mono-label mb-2 text-[10px] text-muted-foreground">{title}</p>
        <p className="text-xs text-muted-foreground">None in sample.</p>
      </div>
    );
  }
  return (
    <div>
      <p className="mono-label mb-2 text-[10px] text-muted-foreground">{title}</p>
      <ul className="max-h-64 space-y-1 overflow-y-auto font-mono text-[10px] leading-snug">
        {facts.map((f) => (
          <li key={f.id} className="border-b border-border-light/60 pb-1">
            <span className="text-muted-foreground">{f.conceptQname}</span>
            {f.contextRef ? <span className="ml-1 text-muted-foreground">@{f.contextRef}</span> : null}
            <div className="text-foreground">
              {formatMetricCell(f.valueNumeric ?? f.valueText)}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

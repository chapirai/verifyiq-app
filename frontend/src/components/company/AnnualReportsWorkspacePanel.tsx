'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { EmptyStatePro } from '@/components/company/workspace-ui';
import type { AnnualReportFinancialComparison } from '@/types/annual-reports';

function formatMetricCell(raw: string | null | undefined): string {
  if (raw == null || raw === '') return '—';
  const n = Number(raw);
  if (!Number.isFinite(n)) return raw;
  return n.toLocaleString('sv-SE', { maximumFractionDigits: 2 });
}

export function AnnualReportsWorkspacePanel({ orgNumber }: { orgNumber: string }) {
  const [data, setData] = useState<AnnualReportFinancialComparison | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getAnnualReportFinancialComparison(orgNumber, { maxYears: 50 });
      setData(res);
    } catch (e) {
      setData(null);
      setError(e instanceof Error ? e.message : 'Could not load annual report comparison');
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

  if (!data || data.years.length === 0) {
    return (
      <EmptyStatePro
        title="No parsed annual reports yet"
        message="When the workspace loads the HVD dokumentlista, the server queues ZIP download, MinIO storage, and Arelle parsing automatically. If nothing appears yet, wait for the background worker, then use Refresh. Browser-only download does not populate the database."
      />
    );
  }

  const yearKeys = data.years.map(String);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Comparing up to <strong>{data.years.length}</strong> fiscal years (by filing period end), up to 50 when available.
          Values come from tagged XBRL facts mapped to canonical fields — not scraped HTML. This view refreshes automatically
          every ~18s while open.
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
                <th key={col.year} className="min-w-[120px] px-2 py-2 text-right align-bottom font-mono text-[10px] uppercase">
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
            <p className="mt-2 text-xs text-muted-foreground">
              Revisor: {col.auditorFirm ?? '—'}
            </p>
          </article>
        ))}
      </div>
    </div>
  );
}

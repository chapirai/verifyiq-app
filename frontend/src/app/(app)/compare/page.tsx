'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { normalizeIdentitetsbeteckning } from '@/lib/org-number';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { EmptyState, ErrorState, LoadingSkeleton } from '@/components/ui/StateBlocks';
import { Table } from '@/components/ui/Table';
import type { CompanySignalRow } from '@/types/company-signals';

type ComparedCompany = {
  orgNumber: string;
  legalName: string;
  status: string;
  freshness: string;
  completeness: string;
  source: string;
  companyForm: string;
  signals: CompanySignalRow[];
  ownershipStats: {
    nodes: number;
    edges: number;
    paths: number;
    maxPathDepth: number;
    ownershipRiskScore: number;
  };
  financialSnapshot: {
    revenue: string | null;
    netResult: string | null;
    equityRatio: string | null;
    years: number[];
  };
};

type CompareView = 'overview' | 'financials' | 'ownership' | 'signals';

function signalScore(signals: CompanySignalRow[], type: string): number | null {
  const row = signals.find((s) => s.signal_type === type);
  return row?.score ?? null;
}

function ComparePageContent() {
  const searchParams = useSearchParams();
  const orgsFromUrl = searchParams.get('orgs')?.trim() ?? '';
  const [orgInput, setOrgInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [rows, setRows] = useState<ComparedCompany[]>([]);
  const [view, setView] = useState<CompareView>('overview');

  const runCompareRaw = useCallback(async (raw: string) => {
    setError('');
    const ids = Array.from(
      new Set(
        raw
          .split(/[\s,;\n]+/)
          .map((x) => normalizeIdentitetsbeteckning(x))
          .filter((x) => x.length === 10 || x.length === 12),
      ),
    ).slice(0, 8);
    if (ids.length < 2) {
      setError('Enter at least two valid organisation numbers (or open Compare list from a target list with two or more orgs).');
      setRows([]);
      return;
    }
    setLoading(true);
    try {
      const comparePayload = await api.compareCompanies({ organisationNumbers: ids, years: 4 });
      const result = comparePayload.data.map((one) => {
        const company = one.company ?? {};
        const signals = (one.signals ?? []).map((s) => ({
          signal_type: s.signalType,
          definition: '',
          engine_version: s.engineVersion,
          score: s.score,
          explanation: (s.explanation as { definition?: string; drivers?: Array<Record<string, unknown>> } | null) ?? null,
          computed_at: s.computedAt,
        })) as CompanySignalRow[];
        return {
          orgNumber: one.organisationNumber,
          legalName: String((company as { legalName?: string }).legalName ?? 'Unknown'),
          status: String((company as { status?: string }).status ?? 'Unknown'),
          freshness: 'Unknown',
          completeness: 'unknown',
          source: 'index',
          companyForm: String((company as { companyForm?: string }).companyForm ?? 'Unknown'),
          signals,
          ownershipStats: {
            nodes: 0,
            edges: one.ownership?.currentEdges ?? 0,
            paths: 0,
            maxPathDepth: 0,
            ownershipRiskScore: one.ownership?.ownershipRiskScore ?? 0,
          },
          financialSnapshot: {
            revenue: one.financials?.revenue ?? null,
            netResult: one.financials?.netResult ?? null,
            equityRatio:
              one.financials?.equityRatio != null ? `${(one.financials.equityRatio * 100).toFixed(1)}%` : null,
            years: one.financials?.fiscalYear ? [Number(one.financials.fiscalYear)] : [],
          },
        } as ComparedCompany;
      });
      setRows(result);
    } catch (e) {
      setRows([]);
      setError(e instanceof Error ? e.message : 'Compare failed');
    } finally {
      setLoading(false);
    }
  }, []);

  const summaryInsights = useMemo(() => {
    if (rows.length < 2) return [];
    const withAcq = rows
      .map((r) => ({ row: r, v: signalScore(r.signals, 'acquisition_likelihood') }))
      .filter((x) => x.v != null) as Array<{ row: ComparedCompany; v: number }>;
    const withStress = rows
      .map((r) => ({ row: r, v: signalScore(r.signals, 'financial_stress') }))
      .filter((x) => x.v != null) as Array<{ row: ComparedCompany; v: number }>;
    const withComplexity = rows
      .map((r) => ({ row: r, v: signalScore(r.signals, 'compliance_ownership_complexity') }))
      .filter((x) => x.v != null) as Array<{ row: ComparedCompany; v: number }>;

    const insights: string[] = [];
    if (withAcq.length > 0) {
      const top = [...withAcq].sort((a, b) => b.v - a.v)[0];
      insights.push(`Highest acquisition likelihood: ${top.row.legalName} (${top.row.orgNumber}) score ${top.v.toFixed(1)}.`);
    }
    if (withStress.length > 0) {
      const low = [...withStress].sort((a, b) => a.v - b.v)[0];
      const high = [...withStress].sort((a, b) => b.v - a.v)[0];
      insights.push(
        `Financial stress spread: lowest ${low.row.legalName} (${low.v.toFixed(1)}) vs highest ${high.row.legalName} (${high.v.toFixed(1)}).`,
      );
    }
    if (withComplexity.length > 0) {
      const top = [...withComplexity].sort((a, b) => b.v - a.v)[0];
      insights.push(
        `Most ownership/compliance complexity: ${top.row.legalName} (${top.row.orgNumber}) score ${top.v.toFixed(1)}.`,
      );
    }
    return insights;
  }, [rows]);

  useEffect(() => {
    if (!orgsFromUrl) return;
    setOrgInput(orgsFromUrl);
    void runCompareRaw(orgsFromUrl);
  }, [orgsFromUrl, runCompareRaw]);

  return (
    <section className="space-y-6">
      <h1 className="font-display text-5xl">Compare companies</h1>
      <p className="max-w-3xl text-sm text-muted-foreground">
        Compare shortlist candidates side-by-side on core identity and data-quality dimensions before moving into deeper diligence. Lists can open this view with{' '}
        <span className="font-mono text-xs">?orgs=</span>
        (comma-separated, up to eight org numbers).
      </p>
      <div className="grid gap-3 md:grid-cols-[1fr_auto]">
        <Input
          value={orgInput}
          onChange={(e) => setOrgInput(e.target.value)}
          placeholder="Enter org numbers separated by comma, space, or newline"
        />
        <Button type="button" onClick={() => void runCompareRaw(orgInput)}>Compare</Button>
      </div>

      {loading ? <LoadingSkeleton lines={8} /> : null}
      {!loading && error ? <ErrorState title="Compare failed" message={error} /> : null}
      {!loading && !error && rows.length === 0 ? (
        <EmptyState title="No compared companies yet" description="Run compare with at least two organisation numbers." />
      ) : null}

      {!loading && !error && rows.length > 0 ? (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 border-2 border-foreground p-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="mono-label text-[10px]">Compare workspace</p>
              <p className="text-sm text-muted-foreground">Side-by-side analyst view with decision-oriented summary insights.</p>
            </div>
            <Select value={view} onChange={(e) => setView(e.target.value as CompareView)} className="md:w-[220px]">
              <option value="overview">Overview</option>
              <option value="financials">Financials</option>
              <option value="ownership">Ownership</option>
              <option value="signals">Signals</option>
            </Select>
          </div>

          {summaryInsights.length > 0 ? (
            <section className="space-y-2 border border-border-light p-3">
              <p className="mono-label text-[10px]">Summary insights</p>
              <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
                {summaryInsights.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </section>
          ) : null}

          {view === 'overview' ? (
            <Table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Org number</th>
                  <th>Status</th>
                  <th>Company form</th>
                  <th>Freshness</th>
                  <th>Completeness</th>
                  <th>Source</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.orgNumber}>
                    <td>{row.legalName}</td>
                    <td className="font-mono text-xs">{row.orgNumber}</td>
                    <td>{row.status}</td>
                    <td>{row.companyForm}</td>
                    <td>{row.freshness}</td>
                    <td>{row.completeness}</td>
                    <td>{row.source}</td>
                    <td>
                      <Link href={`/companies/workspace/${row.orgNumber}`} className="underline underline-offset-4">
                        Open workspace
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : null}

          {view === 'financials' ? (
            <Table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Revenue (latest)</th>
                  <th>Net result (latest)</th>
                  <th>Equity ratio (latest)</th>
                  <th>Years captured</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.orgNumber}>
                    <td>{row.legalName}</td>
                    <td>{row.financialSnapshot.revenue ?? '—'}</td>
                    <td>{row.financialSnapshot.netResult ?? '—'}</td>
                    <td>{row.financialSnapshot.equityRatio ?? '—'}</td>
                    <td>{row.financialSnapshot.years.join(', ') || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : null}

          {view === 'ownership' ? (
            <Table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Ownership nodes</th>
                  <th>Ownership edges</th>
                  <th>Control paths</th>
                  <th>Max path depth</th>
                  <th>Ownership risk score</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.orgNumber}>
                    <td>{row.legalName}</td>
                    <td>{row.ownershipStats.nodes}</td>
                    <td>{row.ownershipStats.edges}</td>
                    <td>{row.ownershipStats.paths}</td>
                    <td>{row.ownershipStats.maxPathDepth}</td>
                    <td>{row.ownershipStats.ownershipRiskScore.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : null}

          {view === 'signals' ? (
            <Table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Acquisition</th>
                  <th>Transition</th>
                  <th>Seller readiness</th>
                  <th>Growth</th>
                  <th>Compliance complexity</th>
                  <th>Financial stress</th>
                  <th>Board/network</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.orgNumber}>
                    <td>{row.legalName}</td>
                    <td>{signalScore(row.signals, 'acquisition_likelihood')?.toFixed(1) ?? '—'}</td>
                    <td>{signalScore(row.signals, 'ownership_transition_probability')?.toFixed(1) ?? '—'}</td>
                    <td>{signalScore(row.signals, 'seller_readiness')?.toFixed(1) ?? '—'}</td>
                    <td>{signalScore(row.signals, 'growth_vs_stagnation')?.toFixed(1) ?? '—'}</td>
                    <td>{signalScore(row.signals, 'compliance_ownership_complexity')?.toFixed(1) ?? '—'}</td>
                    <td>{signalScore(row.signals, 'financial_stress')?.toFixed(1) ?? '—'}</td>
                    <td>{signalScore(row.signals, 'board_network_signals')?.toFixed(1) ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

export default function ComparePage() {
  return (
    <Suspense fallback={<LoadingSkeleton lines={8} />}>
      <ComparePageContent />
    </Suspense>
  );
}

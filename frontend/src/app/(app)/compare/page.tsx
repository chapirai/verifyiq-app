'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { normalizeIdentitetsbeteckning } from '@/lib/org-number';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { EmptyState, ErrorState, LoadingSkeleton } from '@/components/ui/StateBlocks';
import { Table } from '@/components/ui/Table';

type ComparedCompany = {
  orgNumber: string;
  legalName: string;
  status: string;
  freshness: string;
  completeness: string;
  source: string;
  companyForm: string;
};

export default function ComparePage() {
  const searchParams = useSearchParams();
  const orgsFromUrl = searchParams.get('orgs')?.trim() ?? '';
  const [orgInput, setOrgInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [rows, setRows] = useState<ComparedCompany[]>([]);

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
      const result = await Promise.all(
        ids.map(async (org) => {
          const lookup = await api.lookupCompany(org, false);
          const payload = lookup as { company?: Record<string, unknown>; metadata?: Record<string, unknown> };
          const company = payload.company ?? {};
          const metadata = payload.metadata ?? {};
          return {
            orgNumber: org,
            legalName: String(company.legalName ?? 'Unknown'),
            status: String(company.status ?? 'Unknown'),
            freshness: String(metadata.freshness ?? 'Unknown'),
            completeness: String(metadata.profile_completeness ?? 'unknown'),
            source: String(metadata.source ?? 'Unknown'),
            companyForm: String(company.companyForm ?? 'Unknown'),
          } as ComparedCompany;
        }),
      );
      setRows(result);
    } catch (e) {
      setRows([]);
      setError(e instanceof Error ? e.message : 'Compare failed');
    } finally {
      setLoading(false);
    }
  }, []);

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
    </section>
  );
}

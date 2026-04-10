'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { ErrorState, LoadingSkeleton } from '@/components/ui/StateBlocks';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

export default function CompanyDetailPage({ params }: { params: { id: string } }) {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState('');
  const [orgNumber, setOrgNumber] = useState('');
  const [financial, setFinancial] = useState<Record<string, unknown> | null>(null);
  const [snapshots, setSnapshots] = useState<Array<Record<string, unknown>>>([]);

  useEffect(() => {
    api.getCompany(params.id)
      .then((response) => setData(response as Record<string, unknown>))
      .catch((err: { message?: string }) => setError(err.message ?? 'Failed to load company'));
  }, [params.id]);

  useEffect(() => {
    if (!data) return;
    const companyPayload = (data.company as Record<string, unknown> | undefined) ?? data;
    const number = String(companyPayload.organisationsnummer ?? companyPayload.organizationNumber ?? '');
    if (!number) return;
    Promise.all([
      api.getFinancialSnapshot(number).catch(() => null),
      api.getCompanySnapshots(number, 10).catch(() => ({ data: [] })),
    ]).then(([fin, history]) => {
      setFinancial(fin as Record<string, unknown> | null);
      setSnapshots(((history as { data?: Array<Record<string, unknown>> }).data) ?? []);
    });
  }, [data]);

  if (error) {
    return (
      <section className="space-y-6">
        <ErrorState title="Company detail endpoint unavailable" message={`${error}. Use direct lookup by organization number.`} />
        <div className="flex gap-3 border-2 border-foreground p-4">
          <Input value={orgNumber} onChange={(e) => setOrgNumber(e.target.value)} placeholder="10 or 12 digit organization number" />
          <Button
            onClick={async () => {
              setError('');
              const response = await api.lookupCompany(orgNumber);
              const companyData = response as Record<string, unknown>;
              setData(companyData);
              const meta = companyData.metadata as { age_days?: number } | undefined;
              const number = String((companyData.company as { organisationsnummer?: string; organizationNumber?: string } | undefined)?.organisationsnummer
                ?? (companyData.company as { organizationNumber?: string } | undefined)?.organizationNumber
                ?? orgNumber);
              if (number) {
                const [fin, history] = await Promise.all([
                  api.getFinancialSnapshot(number).catch(() => null),
                  api.getCompanySnapshots(number, 10).catch(() => ({ data: [] })),
                ]);
                setFinancial((fin as Record<string, unknown> | null) ?? (meta ? { metadata_age_days: meta.age_days } : null));
                const rows = (history as { data?: Array<Record<string, unknown>> }).data ?? [];
                setSnapshots(rows);
              }
            }}
          >
            Lookup
          </Button>
        </div>
      </section>
    );
  }
  if (!data) return <LoadingSkeleton lines={10} />;

  const companyPayload = (data.company as Record<string, unknown> | undefined) ?? data;
  const metadata = (data.metadata as Record<string, unknown> | undefined) ?? {};
  const entries = Object.entries(companyPayload).slice(0, 20);
  const financialEntries = financial ? Object.entries(financial).slice(0, 12) : [];
  return (
    <section className="space-y-6">
      <h1 className="font-display text-5xl">Company details & financial analysis</h1>
      <div className="grid gap-4 md:grid-cols-4">
        <article className="border-2 border-foreground p-4"><p className="mono-label text-[10px]">Data source</p><p className="mt-2 text-sm">{String(metadata.source ?? '-')}</p></article>
        <article className="border-2 border-foreground p-4"><p className="mono-label text-[10px]">Freshness</p><p className="mt-2 text-sm">{String(metadata.freshness ?? '-')}</p></article>
        <article className="border-2 border-foreground p-4"><p className="mono-label text-[10px]">Policy</p><p className="mt-2 text-sm">{String(metadata.policy_decision ?? '-')}</p></article>
        <article className="border-2 border-foreground p-4"><p className="mono-label text-[10px]">Failure state</p><p className="mt-2 text-sm">{String(metadata.failure_state ?? 'none')}</p></article>
      </div>
      <div className="border-2 border-foreground p-6">
        <p className="mono-label text-[10px]">Company summary</p>
        <dl className="grid gap-4 md:grid-cols-2">
          {entries.map(([key, value]) => (
            <div key={key} className="border-b border-foreground/20 pb-2">
              <dt className="mono-label text-[10px]">{key}</dt>
              <dd className="mt-1 break-words text-sm">{typeof value === 'string' ? value : JSON.stringify(value)}</dd>
            </div>
          ))}
        </dl>
      </div>
      <div className="border-2 border-foreground p-6">
        <p className="mono-label text-[10px]">Financial analysis snapshot</p>
        {financialEntries.length > 0 ? (
          <dl className="mt-3 grid gap-4 md:grid-cols-2">
            {financialEntries.map(([key, value]) => (
              <div key={key} className="border-b border-foreground/20 pb-2">
                <dt className="mono-label text-[10px]">{key}</dt>
                <dd className="mt-1 break-words text-sm">{typeof value === 'string' ? value : JSON.stringify(value)}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">No financial snapshot returned for this company.</p>
        )}
      </div>
      <div className="border-2 border-foreground p-6">
        <p className="mono-label text-[10px]">Fetch history</p>
        {snapshots.length > 0 ? (
          <ul className="mt-3 space-y-2 text-sm">
            {snapshots.map((s, idx) => (
              <li key={idx}>- {String(s['fetchedAt'] ?? s['fetched_at'] ?? 'n/a')} / {String(s['fetchStatus'] ?? s['status'] ?? 'unknown')}</li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">No snapshot history available.</p>
        )}
      </div>
    </section>
  );
}

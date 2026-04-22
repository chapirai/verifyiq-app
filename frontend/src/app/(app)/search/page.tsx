'use client';

import { FormEvent, useState } from 'react';
import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { normalizeIdentitetsbeteckning } from '@/lib/org-number';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { ErrorState, LoadingSkeleton } from '@/components/ui/StateBlocks';
import type { SourcingParsedFilters } from '@/types/sourcing';

const LOOKUP_CACHE_PREFIX = 'verifyiq:lookup:';

function buildCompaniesUrlFromSourcingFilters(filters: SourcingParsedFilters): string {
  const qs = new URLSearchParams({
    page: '1',
    limit: '20',
    sort_by: 'sourcing_rank',
    sort_dir: 'desc',
  });
  if (filters.q) qs.set('q', filters.q);
  if (filters.org_number) qs.set('org_number', filters.org_number);
  if (filters.status) qs.set('status', filters.status);
  if (filters.company_form_contains) qs.set('company_form_contains', filters.company_form_contains);
  if (filters.deal_mode) qs.set('deal_mode', filters.deal_mode);
  return `/companies?${qs.toString()}`;
}

export default function SearchPage() {
  const router = useRouter();
  const [orgNumber, setOrgNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [forceRefresh, setForceRefresh] = useState('false');

  const [sourcingText, setSourcingText] = useState('');
  const [sourcingLoading, setSourcingLoading] = useState(false);
  const [sourcingError, setSourcingError] = useState('');
  const [sourcingPreview, setSourcingPreview] = useState<{
    filters: SourcingParsedFilters;
    notes: string[];
  } | null>(null);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const normalized = normalizeIdentitetsbeteckning(orgNumber);
      if (normalized.length !== 10 && normalized.length !== 12) {
        setError('Enter a 10- or 12-digit identitetsbeteckning (dashes optional).');
        setLoading(false);
        return;
      }
      const lookup = await api.lookupCompany(normalized, forceRefresh === 'true');
      sessionStorage.setItem(`${LOOKUP_CACHE_PREFIX}${normalized}`, JSON.stringify(lookup));
      router.push(`/companies/workspace/${normalized}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Lookup failed');
    } finally {
      setLoading(false);
    }
  };

  const onParseSourcing = async (event: FormEvent) => {
    event.preventDefault();
    setSourcingLoading(true);
    setSourcingError('');
    setSourcingPreview(null);
    try {
      const { filters, notes } = await api.parseSourcingQuery(sourcingText.trim());
      setSourcingPreview({ filters, notes });
    } catch (err: unknown) {
      setSourcingError(err instanceof Error ? err.message : 'Parse failed');
    } finally {
      setSourcingLoading(false);
    }
  };

  return (
    <section className="space-y-10">
      <div className="space-y-6">
        <h1 className="font-display text-5xl">Lookup & sourcing</h1>
        <p className="max-w-2xl text-muted-foreground">
          Run a direct Bolagsverket-backed lookup to open the company workspace, or describe a universe in plain language to jump to the company list with structured filters and signal-based ranking.
        </p>
        <form className="grid gap-3 md:grid-cols-[1fr_200px_auto]" onSubmit={onSubmit}>
          <Input value={orgNumber} onChange={(e) => setOrgNumber(e.target.value)} placeholder="Organisation number (e.g. 5565683058)" required />
          <Select value={forceRefresh} onChange={(e) => setForceRefresh(e.target.value)}>
            <option value="false">Prefer cache</option>
            <option value="true">Force provider refresh</option>
          </Select>
          <Button type="submit">Lookup workspace</Button>
        </form>
        {loading ? <LoadingSkeleton lines={6} /> : null}
        {!loading && error ? <ErrorState title="Lookup failed" message={error} /> : null}
      </div>

      <div className="space-y-4 border-t-2 border-foreground pt-10">
        <h2 className="font-display text-3xl">Sourcing assistant</h2>
        <p className="max-w-2xl text-sm text-muted-foreground">
          The parser extracts Swedish org numbers, status and legal-form keywords, and sends the remainder as a name search. Results open on the Companies page sorted by <span className="font-mono text-foreground">sourcing_rank</span> (dataset richness heuristics).
        </p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={() => setSourcingText('founder exit aktiebolag stockholm')}>
            Preset: Founder exit
          </Button>
          <Button type="button" variant="secondary" onClick={() => setSourcingText('distressed industribolag göteborg')}>
            Preset: Distressed
          </Button>
          <Button type="button" variant="secondary" onClick={() => setSourcingText('roll-up services bolag sverige')}>
            Preset: Roll-up
          </Button>
        </div>
        <form className="space-y-3" onSubmit={onParseSourcing}>
          <textarea
            className="min-h-[120px] w-full border-2 border-foreground bg-background p-3 font-sans text-sm outline-none focus:ring-2 focus:ring-foreground/20"
            value={sourcingText}
            onChange={(e) => setSourcingText(e.target.value)}
            placeholder="Example: konkurs aktiebolag stål stockholm"
            maxLength={2000}
          />
          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant="secondary" disabled={sourcingLoading || !sourcingText.trim()}>
              {sourcingLoading ? 'Parsing…' : 'Parse query'}
            </Button>
            <Button
              type="button"
              disabled={!sourcingPreview}
              onClick={() => {
                if (!sourcingPreview) return;
                router.push(buildCompaniesUrlFromSourcingFilters(sourcingPreview.filters) as Route);
              }}
            >
              Open company list
            </Button>
          </div>
        </form>
        {sourcingLoading ? <LoadingSkeleton lines={4} /> : null}
        {!sourcingLoading && sourcingError ? <ErrorState title="Sourcing parse failed" message={sourcingError} /> : null}
        {!sourcingLoading && sourcingPreview ? (
          <div className="space-y-3 border-2 border-foreground p-4 text-sm">
            <p className="mono-label text-[10px]">Structured filters</p>
            {Object.values(sourcingPreview.filters).every((v) => v == null || v === '') ? (
              <p className="text-muted-foreground">No structured filters — you can still open the list (broad match, signal-ranked).</p>
            ) : (
              <dl className="grid gap-2 font-mono text-xs md:grid-cols-2">
                {Object.entries(sourcingPreview.filters).map(([k, v]) =>
                  v != null && v !== '' ? (
                    <div key={k} className="flex flex-wrap gap-2 border border-foreground/30 p-2">
                      <dt className="text-muted-foreground">{k}</dt>
                      <dd>{String(v)}</dd>
                    </div>
                  ) : null,
                )}
              </dl>
            )}
            {sourcingPreview.notes.length > 0 ? (
              <div className="space-y-2">
                <p className="mono-label text-[10px]">Parser trace</p>
                <ul className="list-inside list-disc space-y-1 text-muted-foreground">
                  {sourcingPreview.notes.map((n, i) => (
                    <li key={`${i}-${n}`}>{n}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}
        <ul className="mono-label flex flex-wrap gap-2 text-[10px] text-muted-foreground">
          <li className="border border-foreground px-2 py-1">Org number</li>
          <li className="border border-foreground px-2 py-1">Status keywords</li>
          <li className="border border-foreground px-2 py-1">Legal form (AB, EF, …)</li>
          <li className="border border-foreground px-2 py-1">Remainder → q</li>
        </ul>
      </div>
    </section>
  );
}

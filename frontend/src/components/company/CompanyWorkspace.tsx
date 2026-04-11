'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { api } from '@/lib/api';
import { normalizeIdentitetsbeteckning } from '@/lib/org-number';
import { hvdClient } from '@/lib/source-clients';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ErrorState, LoadingSkeleton } from '@/components/ui/StateBlocks';
import { Table } from '@/components/ui/Table';
import {
  EmptyStatePro,
  FieldGridPro,
  SectionCard,
  StatGrid,
  StatusChip,
} from '@/components/company/workspace-ui';
import type {
  CompanyEngagementServing,
  CompanyFiCaseServing,
  CompanyFiReportServing,
  CompanyHvdDocumentServing,
  CompanyOfficerServing,
  CompanyOverviewServing,
  CompanyShareCapitalServing,
} from '@/types/company-serving';
import type { SourceFetchState } from '@/types/source-data';

type TabId =
  | 'overview'
  | 'hvd'
  | 'fiOrg'
  | 'reports'
  | 'fiReports'
  | 'cases'
  | 'capital'
  | 'engagements';

function sourceState<T>(): SourceFetchState<T> {
  return { data: null, error: null, ok: false };
}

function mapSettled<T>(result: PromiseSettledResult<T>): SourceFetchState<T> {
  return result.status === 'fulfilled'
    ? { data: result.value, error: null, ok: true }
    : { data: null, error: result.reason instanceof Error ? result.reason.message : 'Request failed', ok: false };
}

/** HVD POST /organisationer returns { organisation?, organisationer?, fel? } */
function extractHvdOrganisation(payload: unknown): Record<string, unknown> | null {
  if (!payload || typeof payload !== 'object') return null;
  const o = payload as Record<string, unknown>;
  const org = o.organisation;
  if (org && typeof org === 'object') return org as Record<string, unknown>;
  const list = o.organisationer;
  if (Array.isArray(list) && list[0] && typeof list[0] === 'object') return list[0] as Record<string, unknown>;
  return o;
}

function displayValue(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return 'Not available';
  const s = typeof v === 'number' ? String(v) : v;
  if (s.trim() === '') return 'Not available';
  return s;
}

function formatDateOnly(v: string | null | undefined): string {
  if (!v) return 'Not available';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? v : d.toLocaleDateString();
}

function formatMoneyAmount(amount: string | null | undefined, currency: string | null | undefined): string {
  if (amount == null || amount === '') return 'Not available';
  const n = Number(amount);
  if (!Number.isFinite(n)) return `${amount} ${currency ?? ''}`.trim();
  return `${n.toLocaleString()} ${currency ?? ''}`.trim();
}

type ServingBundle = {
  overview: CompanyOverviewServing | null;
  officers: CompanyOfficerServing[];
  reports: CompanyFiReportServing[];
  documents: CompanyHvdDocumentServing[];
  cases: CompanyFiCaseServing[];
  shareCapital: CompanyShareCapitalServing | null;
  engagements: CompanyEngagementServing[];
};

const emptyServing = (): ServingBundle => ({
  overview: null,
  officers: [],
  reports: [],
  documents: [],
  cases: [],
  shareCapital: null,
  engagements: [],
});

function buildServingOverviewSummary(o: CompanyOverviewServing): { label: string; value: string }[] {
  return [
    { label: 'Bolagsnamn', value: displayValue(o.organisationsnamn) },
    { label: 'Organisationsform', value: displayValue(o.organisationsformKlartext) },
    { label: 'Organisationsnummer', value: displayValue(o.organisationsnummer) },
    { label: 'Identitetstyp', value: displayValue(o.identitetTypKlartext) },
    { label: 'Registreringsdatum', value: formatDateOnly(o.organisationsdatumRegistreringsdatum) },
    { label: 'Bildat datum', value: formatDateOnly(o.organisationsdatumBildatDatum) },
    { label: 'Hemvist kommun', value: displayValue(o.hemvistKommunKlartext) },
    { label: 'Län', value: displayValue(o.hemvistLanKlartext) },
    { label: 'Räkenskapsår', value: `${displayValue(o.rakenskapsarInleds)} – ${displayValue(o.rakenskapsarAvslutas)}` },
    { label: 'Verksamhetsbeskrivning', value: displayValue(o.verksamhetsbeskrivning) },
    { label: 'Adress', value: displayValue(o.organisationsadressPostadress) },
    { label: 'Postnummer / ort', value: [o.organisationsadressPostnummer, o.organisationsadressPostort].filter(Boolean).join(' ') || 'Not available' },
    { label: 'E-post', value: displayValue(o.organisationsadressEpost) },
    { label: 'Firmateckning', value: displayValue(o.firmateckningKlartext) },
    { label: 'Ledamöter / suppleanter', value: `${o.antalValdaLedamoter ?? '—'} / ${o.antalValdaSuppleanter ?? '—'}` },
    { label: 'Aktiekapital (översikt)', value: formatMoneyAmount(o.aktiekapitalBelopp, o.aktiekapitalValuta) },
    { label: 'Antal aktier (översikt)', value: displayValue(o.antalAktier) },
    { label: 'HVD verksam organisation', value: displayValue(o.verksamOrganisationKod) },
    { label: 'Registreringsland', value: displayValue(o.registreringslandKlartext) },
    { label: 'Read model refreshed', value: formatDateOnly(o.dataRefreshedAt) },
  ];
}

function pickStrings(obj: Record<string, unknown> | null | undefined, keys: string[]): { label: string; value: string }[] {
  if (!obj) return [];
  const out: { label: string; value: string }[] = [];
  for (const k of keys) {
    const v = obj[k];
    if (v === undefined || v === null) continue;
    const s = typeof v === 'string' ? v : typeof v === 'number' || typeof v === 'boolean' ? String(v) : JSON.stringify(v);
    if (s && s !== '{}' && s !== '[]') out.push({ label: k, value: s });
  }
  return out;
}

function FieldGrid({ rows }: { rows: { label: string; value: string }[] }) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">No fields to display.</p>;
  return (
    <dl className="grid gap-3 md:grid-cols-2">
      {rows.map(({ label, value }) => (
        <div key={label} className="border-b border-border-light pb-2">
          <dt className="mono-label text-[10px] text-muted-foreground">{label}</dt>
          <dd className="mt-1 text-sm leading-relaxed">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function TabButton({ active, children, onClick }: { active: boolean; children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`border-2 border-foreground px-3 py-2 font-mono text-[10px] uppercase tracking-widest transition-none ${
        active ? 'bg-foreground text-background' : 'bg-background text-foreground hover:bg-muted'
      }`}
    >
      {children}
    </button>
  );
}

function Panel({ title, badge, children }: { title: string; badge?: string; children: ReactNode }) {
  return (
    <article className="border-2 border-foreground bg-background p-6">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <p className="mono-label text-[10px]">{title}</p>
        {badge ? <Badge>{badge}</Badge> : null}
      </div>
      {children}
    </article>
  );
}

interface CompanyWorkspaceProps {
  orgNumberFromRoute: string;
}

export function CompanyWorkspace({ orgNumberFromRoute }: CompanyWorkspaceProps) {
  const org = normalizeIdentitetsbeteckning(orgNumberFromRoute);
  const [tab, setTab] = useState<TabId>('overview');
  const [lookupLoading, setLookupLoading] = useState(true);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [lookupResult, setLookupResult] = useState<Record<string, unknown> | null>(null);

  const [hvdOrg, setHvdOrg] = useState(sourceState<Record<string, unknown>>());
  const [hvdDocs, setHvdDocs] = useState(sourceState<Record<string, unknown>>());
  const [serving, setServing] = useState<ServingBundle>(() => emptyServing());
  const [servingMeta, setServingMeta] = useState<{ loading: boolean; error: string | null }>({
    loading: false,
    error: null,
  });
  const [snapshots, setSnapshots] = useState<Array<Record<string, unknown>>>([]);
  const [downloadMsg, setDownloadMsg] = useState('');
  const [refreshingSources, setRefreshingSources] = useState(false);
  const [namnskyddslopnummer, setNamnskyddslopnummer] = useState('');
  const namnskyddRef = useRef('');
  useEffect(() => {
    namnskyddRef.current = namnskyddslopnummer;
  }, [namnskyddslopnummer]);

  const loadServing = useCallback(async (identitet: string) => {
    setServingMeta({ loading: true, error: null });
    try {
      const [overview, officers, reports, documents, cases, shareCapital, engagements] = await Promise.all([
        api.getCompanyServingOverview(identitet),
        api.getCompanyServingOfficers(identitet),
        api.getCompanyServingFinancialReports(identitet),
        api.getCompanyServingDocuments(identitet),
        api.getCompanyServingFiCases(identitet),
        api.getCompanyServingShareCapital(identitet),
        api.getCompanyServingEngagements(identitet),
      ]);
      setServing({ overview, officers, reports, documents, cases, shareCapital, engagements });
      setServingMeta({ loading: false, error: null });
    } catch (e) {
      setServingMeta({
        loading: false,
        error: e instanceof Error ? e.message : 'Read model request failed',
      });
    }
  }, []);

  const loadEndpoints = useCallback(async (identitet: string) => {
    setRefreshingSources(true);
    const ns = namnskyddRef.current.trim();
    const dokumentListaBody = {
      identitetsbeteckning: identitet,
      ...(ns ? { namnskyddslopnummer: ns } : {}),
    };
    const results = await Promise.allSettled([
      hvdClient.hvdGetOrganisation({ identitetsbeteckning: identitet, ...(ns ? { namnskyddslopnummer: ns } : {}) }),
      hvdClient.hvdGetDocumentList(dokumentListaBody),
    ]);
    setHvdOrg(mapSettled(results[0] as PromiseSettledResult<Record<string, unknown>>));
    setHvdDocs(mapSettled(results[1] as PromiseSettledResult<Record<string, unknown>>));
    setRefreshingSources(false);
  }, []);

  const reloadHvdDocumentList = useCallback(async () => {
    if (!org || org.length < 10) return;
    setRefreshingSources(true);
    const ns = namnskyddRef.current.trim();
    const body = { identitetsbeteckning: org, ...(ns ? { namnskyddslopnummer: ns } : {}) };
    try {
      const r = await Promise.allSettled([hvdClient.hvdGetDocumentList(body)]);
      setHvdDocs(mapSettled(r[0] as PromiseSettledResult<Record<string, unknown>>));
      await loadServing(org);
    } finally {
      setRefreshingSources(false);
    }
  }, [org, loadServing]);

  useEffect(() => {
    if (!org || org.length < 10) {
      setLookupLoading(false);
      setLookupError('Invalid organisation number (use 10 or 12 digits).');
      return;
    }
    setLookupLoading(true);
    setLookupError(null);
    api
      .lookupCompany(org, false)
      .then((res) => {
        setLookupResult(res as Record<string, unknown>);
        return api.getCompanySnapshots(org, 10).catch(() => ({ data: [] as Array<Record<string, unknown>> }));
      })
      .then((hist) => {
        setSnapshots((hist as { data?: Array<Record<string, unknown>> }).data ?? []);
      })
      .catch((e: unknown) => {
        setLookupError(e instanceof Error ? e.message : 'Lookup failed');
        setLookupResult(null);
      })
      .finally(() => setLookupLoading(false));
  }, [org]);

  useEffect(() => {
    if (!org || org.length < 10) return;
    void loadEndpoints(org);
    void loadServing(org);
  }, [org, loadEndpoints, loadServing]);

  if (!org || org.length < 10) {
    return <ErrorState title="Invalid organisation number" message="Use a 10- or 12-digit identitetsbeteckning in the URL." />;
  }

  if (lookupLoading && !lookupResult) {
    return <LoadingSkeleton lines={12} />;
  }

  const company = (lookupResult?.company as Record<string, unknown> | undefined) ?? {};
  const metadata = (lookupResult?.metadata as Record<string, unknown> | undefined) ?? {};
  const hvdSection = company.hvdSection as Record<string, unknown> | undefined;
  const v4Section = company.v4Section as Record<string, unknown> | undefined;

  const hvdEndpointOrg = extractHvdOrganisation(hvdOrg.data);
  const servingOverviewRows = serving.overview ? buildServingOverviewSummary(serving.overview) : [];

  const hvdOrgRows = pickStrings(hvdEndpointOrg, [
    'namn',
    'identitetsbeteckning',
    'verksamhetsbeskrivning',
    'organisationsdatum',
    'registreringsdatum',
    'juridiskForm',
    'organisationsform',
    'verksamOrganisation',
    'registreringsland',
  ]);

  return (
    <section className="space-y-8">
      <div className="flex flex-col gap-4 border-b-2 border-foreground pb-6 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="mono-label text-[10px] text-muted-foreground">Company workspace</p>
          <h1 className="font-display text-4xl md:text-5xl">{String(company.legalName ?? 'Organisation')}</h1>
          <p className="mt-2 font-mono text-sm">{org}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            className="min-h-10 text-[10px]"
            onClick={() => {
              void api
                .lookupCompany(org, true)
                .then((r) => setLookupResult(r as Record<string, unknown>))
                .catch(() => undefined);
              void loadEndpoints(org);
              void loadServing(org);
            }}
            disabled={refreshingSources}
          >
            {refreshingSources ? 'Refreshing…' : 'Force refresh (lookup + sources)'}
          </Button>
          <Button href="/search" variant="secondary" className="min-h-10 text-[10px]">
            New lookup
          </Button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <article className="border-2 border-foreground p-4">
          <p className="mono-label text-[10px]">Orchestrated source</p>
          <p className="mt-2 text-sm">{String(metadata.source ?? '—')}</p>
        </article>
        <article className="border-2 border-foreground p-4">
          <p className="mono-label text-[10px]">Freshness</p>
          <p className="mt-2 text-sm">{String(metadata.freshness ?? '—')}</p>
        </article>
        <article className="border-2 border-foreground p-4">
          <p className="mono-label text-[10px]">Snapshot</p>
          <p className="mt-2 break-all font-mono text-xs">{String(metadata.snapshot_id ?? '—')}</p>
        </article>
        <article className="border-2 border-foreground p-4">
          <p className="mono-label text-[10px]">Correlation</p>
          <p className="mt-2 break-all font-mono text-xs">{String(metadata.correlation_id ?? '—')}</p>
        </article>
      </div>

      {lookupError ? <ErrorState title="Lookup unavailable" message={lookupError} /> : null}
      {servingMeta.error ? <ErrorState title="Read model unavailable" message={servingMeta.error} /> : null}
      {servingMeta.loading ? (
        <p className="text-sm text-muted-foreground">Updating read-model tables…</p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <TabButton active={tab === 'overview'} onClick={() => setTab('overview')}>
          Overview
        </TabButton>
        <TabButton active={tab === 'hvd'} onClick={() => setTab('hvd')}>
          HVD endpoint
        </TabButton>
        <TabButton active={tab === 'fiOrg'} onClick={() => setTab('fiOrg')}>
          FI organisationer
        </TabButton>
        <TabButton active={tab === 'reports'} onClick={() => setTab('reports')}>
          HVD annual files
        </TabButton>
        <TabButton active={tab === 'fiReports'} onClick={() => setTab('fiReports')}>
          FI finansiella rapporter
        </TabButton>
        <TabButton active={tab === 'cases'} onClick={() => setTab('cases')}>
          FI ärenden
        </TabButton>
        <TabButton active={tab === 'capital'} onClick={() => setTab('capital')}>
          FI aktiekapital
        </TabButton>
        <TabButton active={tab === 'engagements'} onClick={() => setTab('engagements')}>
          FI engagemang
        </TabButton>
      </div>

      {tab === 'overview' ? (
        <div className="space-y-6">
          <Panel title="Normalised profile (orchestrated lookup)" badge="convenience">
            <FieldGrid
              rows={pickStrings(company as Record<string, unknown>, [
                'legalName',
                'organizationNumber',
                'companyForm',
                'registeredAt',
                'businessDescription',
              ])}
            />
          </Panel>
          <Panel title="Company read model" badge="bv_read.company_overview_current">
            {servingOverviewRows.length === 0 ? (
              <EmptyStatePro
                title="No read-model row yet"
                message="Run a lookup or wait for the parse/refresh pipeline. Data is served from physical bv_read tables, not raw JSON."
              />
            ) : (
              <FieldGridPro rows={servingOverviewRows} />
            )}
          </Panel>
          <details className="border-2 border-foreground p-4">
            <summary className="cursor-pointer mono-label text-[10px]">Legacy orchestrated HVD / FI blocks (debug)</summary>
            <div className="mt-4 grid gap-6 lg:grid-cols-2">
              <FieldGrid
                rows={pickStrings(hvdSection ?? null, [
                  'verksamhetsbeskrivning',
                  'organisationsdatum',
                  'juridiskForm',
                  'organisationsform',
                  'registreringsland',
                  'verksamOrganisation',
                ])}
              />
              <FieldGrid
                rows={pickStrings(v4Section ?? null, [
                  'organisationsnamn',
                  'organisationsform',
                  'organisationsdatum',
                  'verksamhetsbeskrivning',
                ])}
              />
            </div>
          </details>
          <Panel title="Financial reports (read model)" badge="bv_read.company_fi_reports_current">
            {serving.reports.length === 0 ? (
              <EmptyStatePro
                title="No financial report rows"
                message="These rows come from parsed FI data in the serving layer. Årsredovisning files (ZIP) are listed under HVD annual files."
              />
            ) : (
              <Table>
                <thead>
                  <tr>
                    <th>Typ</th>
                    <th>Period</th>
                    <th>Ankom</th>
                    <th>Registrerad</th>
                    <th>Koncern</th>
                    <th>Utdelning</th>
                  </tr>
                </thead>
                <tbody>
                  {serving.reports.map((r) => (
                    <tr key={r.reportId}>
                      <td className="text-sm">{displayValue(r.rapporttypKlartext ?? r.rapporttypKod)}</td>
                      <td className="text-sm">
                        {formatDateOnly(r.periodFrom)} – {formatDateOnly(r.periodTom)}
                      </td>
                      <td className="text-sm">{formatDateOnly(r.ankomDatum)}</td>
                      <td className="text-sm">{formatDateOnly(r.registreradDatum)}</td>
                      <td className="text-sm">
                        {r.innehallerKoncernredovisning === null ? '—' : r.innehallerKoncernredovisning ? 'Ja' : 'Nej'}
                      </td>
                      <td className="text-sm tabular-nums">
                        {formatMoneyAmount(r.vinstutdelningBelopp, r.vinstutdelningValutaKod)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Panel>
          <Panel title="Fetch history" badge="snapshots">
            {snapshots.length === 0 ? (
              <p className="text-sm text-muted-foreground">No snapshots returned.</p>
            ) : (
              <ul className="space-y-2 font-mono text-xs">
                {snapshots.map((s, idx) => (
                  <li key={idx} className="border-b border-border-light pb-2">
                    {String(s.fetchedAt ?? s.fetched_at ?? '—')} · {String(s.fetchStatus ?? s.status ?? '—')}
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      ) : null}

      {tab === 'hvd' ? (
        <Panel title="POST /bolagsverket/hvd/organisationer" badge={hvdOrg.ok ? 'ok' : 'error'}>
          {hvdOrg.error ? <ErrorState title="HVD organisationer failed" message={hvdOrg.error} /> : null}
          <FieldGrid rows={hvdOrgRows} />
          {!hvdOrg.ok && !hvdOrg.error ? <LoadingSkeleton lines={4} /> : null}
        </Panel>
      ) : null}

      {tab === 'fiOrg' ? (
        <div className="space-y-6">
          <Panel title="FI organisation (read model)" badge="bv_read">
            {!serving.overview ? (
              <EmptyStatePro
                title="No organisation row in serving layer"
                message="Complete a lookup so raw payloads are parsed and bv_read.company_overview_current is refreshed."
              />
            ) : (
              <div className="grid gap-6 lg:grid-cols-2">
                <SectionCard title="Identity">
                  <FieldGridPro
                    rows={[
                      { label: 'Organisationsnummer', value: displayValue(serving.overview.organisationsnummer) },
                      { label: 'Namn', value: displayValue(serving.overview.organisationsnamn) },
                      { label: 'Identitetstyp', value: displayValue(serving.overview.identitetTypKlartext) },
                      { label: 'Organisationsform', value: displayValue(serving.overview.organisationsformKlartext) },
                    ]}
                  />
                </SectionCard>
                <SectionCard title="Registration">
                  <FieldGridPro
                    rows={[
                      { label: 'Registreringsdatum', value: formatDateOnly(serving.overview.organisationsdatumRegistreringsdatum) },
                      { label: 'Bildat datum', value: formatDateOnly(serving.overview.organisationsdatumBildatDatum) },
                    ]}
                  />
                </SectionCard>
                <SectionCard title="Status / domicile">
                  <FieldGridPro
                    rows={[
                      { label: 'Kommun', value: displayValue(serving.overview.hemvistKommunKlartext) },
                      { label: 'Län', value: displayValue(serving.overview.hemvistLanKlartext) },
                      {
                        label: 'Räkenskapsår',
                        value: `${displayValue(serving.overview.rakenskapsarInleds)} – ${displayValue(serving.overview.rakenskapsarAvslutas)}`,
                      },
                      { label: 'Registreringsland', value: displayValue(serving.overview.registreringslandKlartext) },
                    ]}
                  />
                </SectionCard>
                <SectionCard title="Operations">
                  <FieldGridPro
                    rows={[
                      { label: 'Verksamhetsbeskrivning', value: displayValue(serving.overview.verksamhetsbeskrivning) },
                      { label: 'Firmateckning', value: displayValue(serving.overview.firmateckningKlartext) },
                    ]}
                  />
                </SectionCard>
                <SectionCard title="Contact">
                  <FieldGridPro
                    rows={[
                      { label: 'Adress', value: displayValue(serving.overview.organisationsadressPostadress) },
                      {
                        label: 'Postnummer / ort',
                        value:
                          [serving.overview.organisationsadressPostnummer, serving.overview.organisationsadressPostort]
                            .filter(Boolean)
                            .join(' ') || 'Not available',
                      },
                      { label: 'E-post', value: displayValue(serving.overview.organisationsadressEpost) },
                    ]}
                  />
                </SectionCard>
                <SectionCard title="Board summary">
                  <FieldGridPro
                    rows={[
                      { label: 'Valda ledamöter', value: displayValue(serving.overview.antalValdaLedamoter) },
                      { label: 'Valda suppleanter', value: displayValue(serving.overview.antalValdaSuppleanter) },
                    ]}
                  />
                </SectionCard>
              </div>
            )}
          </Panel>
          <Panel title="Officers / funktionärer" badge="bv_read.company_officers_current">
            {serving.officers.length === 0 ? (
              <EmptyStatePro title="No officers in read model" message="Parsed FI funktionärer will appear here after refresh." />
            ) : (
              <Table>
                <thead>
                  <tr>
                    <th>Namn</th>
                    <th>Personnummer</th>
                    <th>Roll</th>
                    <th>Postadress</th>
                  </tr>
                </thead>
                <tbody>
                  {serving.officers.map((o) => (
                    <tr key={`${o.funktionarId}-${o.fiFunktionarRollId}`}>
                      <td className="text-sm">
                        {[o.fornamn, o.efternamn].filter(Boolean).join(' ') || 'Not available'}
                      </td>
                      <td className="font-mono text-xs">{displayValue(o.identitetsbeteckning)}</td>
                      <td className="text-sm">
                        <StatusChip>{displayValue(o.rollKlartext ?? o.rollKod)}</StatusChip>
                      </td>
                      <td className="text-sm">
                        {[o.postadressAdress, o.postadressPostnummer, o.postadressPostort].filter(Boolean).join(', ') ||
                          'Not available'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Panel>
        </div>
      ) : null}

      {tab === 'reports' ? (
        <div className="space-y-6">
          <Panel title="HVD annual files (read model)" badge="bv_read.company_hvd_documents_current">
            <p className="mb-4 text-sm text-muted-foreground">
              Rows are served from parsed dokumentlista. Download uses only each row&apos;s <strong>dokumentId</strong> against{' '}
              <code className="font-mono text-xs">GET …/hvd/dokument/:dokumentId</code>.
            </p>
            <div className="mb-6 flex flex-col gap-3 border-2 border-foreground p-4 md:flex-row md:items-end">
              <div className="min-w-0 flex-1">
                <label htmlFor="namnskydd-hvd" className="mono-label mb-1 block text-[10px] text-muted-foreground">
                  Namnskyddslöpnummer (optional)
                </label>
                <Input
                  id="namnskydd-hvd"
                  value={namnskyddslopnummer}
                  onChange={(e) => setNamnskyddslopnummer(e.target.value)}
                  placeholder="Only when Bolagsverket requires disambiguation"
                />
              </div>
              <Button
                type="button"
                variant="secondary"
                className="min-h-10 shrink-0 text-[10px]"
                disabled={refreshingSources}
                onClick={() => void reloadHvdDocumentList()}
              >
                Reload live lista + read model
              </Button>
            </div>
            {hvdDocs.error ? <ErrorState title="Live dokumentlista request failed" message={hvdDocs.error} /> : null}
            {serving.documents.length === 0 ? (
              <EmptyStatePro
                title="No HVD documents in serving layer"
                message="Bolagsverket only lists digitally submitted annual reports. After a successful lookup, dokument rows are merged into raw payloads and parsed into bv_read."
              />
            ) : (
              <Table>
                <thead>
                  <tr>
                    <th>Period (tom)</th>
                    <th>Registrerad</th>
                    <th>Format</th>
                    <th>Dokument-ID</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {serving.documents.map((row) => (
                    <tr key={row.dokumentId}>
                      <td className="text-sm">{formatDateOnly(row.rapporteringsperiodTom)}</td>
                      <td className="text-sm">{formatDateOnly(row.registreringstidpunkt)}</td>
                      <td className="text-sm">{displayValue(row.filformat)}</td>
                      <td className="font-mono text-xs">{row.dokumentId}</td>
                      <td>
                        <Button
                          variant="primary"
                          className="min-h-9 px-3 py-1 text-[10px]"
                          onClick={async () => {
                            const docId = row.dokumentId?.trim();
                            if (!docId) return;
                            setDownloadMsg(`Downloading ${docId}…`);
                            try {
                              const file = await hvdClient.hvdDownloadDocument(docId);
                              const url = URL.createObjectURL(file.blob);
                              const a = document.createElement('a');
                              a.href = url;
                              a.download = file.fileName;
                              a.click();
                              URL.revokeObjectURL(url);
                              setDownloadMsg(`Saved: ${file.fileName}`);
                            } catch (e) {
                              setDownloadMsg(e instanceof Error ? e.message : 'Download failed');
                            }
                          }}
                        >
                          Download
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
            {downloadMsg ? <p className="mt-4 text-sm text-muted-foreground">{downloadMsg}</p> : null}
          </Panel>
        </div>
      ) : null}

      {tab === 'fiReports' ? (
        <Panel title="FI finansiella rapporter (read model)" badge="bv_read.company_fi_reports_current">
          {serving.reports.length === 0 ? (
            <EmptyStatePro title="No rows" message="Parsed FI financial reports will appear here." />
          ) : (
            <Table>
              <thead>
                <tr>
                  <th>Typ</th>
                  <th>Period</th>
                  <th>Ankom / registrerad</th>
                  <th>Koncern</th>
                  <th>Utdelning</th>
                </tr>
              </thead>
              <tbody>
                {serving.reports.map((r) => (
                  <tr key={r.reportId}>
                    <td className="text-sm">{displayValue(r.rapporttypKlartext ?? r.rapporttypKod)}</td>
                    <td className="text-sm">
                      {formatDateOnly(r.periodFrom)} – {formatDateOnly(r.periodTom)}
                    </td>
                    <td className="text-sm">
                      {formatDateOnly(r.ankomDatum)} / {formatDateOnly(r.registreradDatum)}
                    </td>
                    <td className="text-sm">
                      {r.innehallerKoncernredovisning === null ? '—' : r.innehallerKoncernredovisning ? 'Ja' : 'Nej'}
                    </td>
                    <td className="text-sm tabular-nums">
                      {formatMoneyAmount(r.vinstutdelningBelopp, r.vinstutdelningValutaKod)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Panel>
      ) : null}

      {tab === 'cases' ? (
        <Panel title="FI ärenden (read model)" badge="bv_read.company_fi_cases_current">
          {serving.cases.length === 0 ? (
            <EmptyStatePro title="No cases" message="Ärenden from the organisation snapshot and financial-report blocks are merged in the serving layer." />
          ) : (
            <Table>
              <thead>
                <tr>
                  <th>Ärendenummer</th>
                  <th>Avslutat</th>
                  <th>Typ</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {serving.cases.map((c) => (
                  <tr key={`${c.arendeRank}-${c.arendenummer ?? ''}`}>
                    <td className="font-mono text-xs">{displayValue(c.arendenummer)}</td>
                    <td className="text-sm">{formatDateOnly(c.avslutatTidpunkt)}</td>
                    <td className="text-sm">{displayValue(c.arendetyp)}</td>
                    <td className="text-sm">{displayValue(c.status)}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Panel>
      ) : null}

      {tab === 'capital' ? (
        <Panel title="FI aktiekapital (read model)" badge="bv_read.company_share_capital_current">
          {!serving.shareCapital ? (
            <EmptyStatePro title="No share-capital row" message="Aktieinformation from the latest FI organisation snapshot is surfaced here." />
          ) : (
            <div className="space-y-6">
              <StatGrid
                stats={[
                  { label: 'Aktiekapital', value: formatMoneyAmount(serving.shareCapital.aktiekapitalBelopp, serving.shareCapital.aktiekapitalValuta) },
                  { label: 'Antal aktier', value: displayValue(serving.shareCapital.antalAktier) },
                  {
                    label: 'Kvotvärde',
                    value: formatMoneyAmount(serving.shareCapital.kvotvardeBelopp, serving.shareCapital.kvotvardeValuta),
                  },
                ]}
              />
              <SectionCard title="Gränser (aktiekapital / antal aktier)">
                <FieldGridPro
                  rows={[
                    { label: 'Aktiekapital min / max', value: `${displayValue(serving.shareCapital.aktiekapitalGransLagst)} / ${displayValue(serving.shareCapital.aktiekapitalGransHogst)}` },
                    { label: 'Antal aktier min / max', value: `${displayValue(serving.shareCapital.antalAktierGransLagst)} / ${displayValue(serving.shareCapital.antalAktierGransHogst)}` },
                    { label: 'Valuta (gränser)', value: displayValue(serving.shareCapital.aktiegranserValuta) },
                  ]}
                />
              </SectionCard>
            </div>
          )}
        </Panel>
      ) : null}

      {tab === 'engagements' ? (
        <Panel title="FI engagemang (read model)" badge="bv_read.company_engagements_current">
          {serving.engagements.length === 0 ? (
            <EmptyStatePro
              title="No engagements"
              message="When FI organisation payloads include organisationsengagemang, rows are extracted into the serving table."
            />
          ) : (
            <Table>
              <thead>
                <tr>
                  <th>Relaterad organisation</th>
                  <th>Org.nr</th>
                  <th>Roll / typ</th>
                  <th>Person / namn</th>
                </tr>
              </thead>
              <tbody>
                {serving.engagements.map((e) => (
                  <tr key={e.engagementRank}>
                    <td className="text-sm">{displayValue(e.relatedOrganisationName)}</td>
                    <td className="font-mono text-xs">{displayValue(e.relatedOrganisationNumber)}</td>
                    <td className="text-sm">
                      <StatusChip>{displayValue(e.engagementTypeKlartext ?? e.roleKlartext ?? e.roleKod)}</StatusChip>
                    </td>
                    <td className="text-sm">{displayValue(e.personOrOrganisationName)}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Panel>
      ) : null}
    </section>
  );
}

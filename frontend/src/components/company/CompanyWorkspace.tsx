'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { api } from '@/lib/api';
import { normalizeIdentitetsbeteckning } from '@/lib/org-number';
import { fiClient, hvdClient } from '@/lib/source-clients';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ErrorState, LoadingSkeleton } from '@/components/ui/StateBlocks';
import { Table } from '@/components/ui/Table';
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

function dokumentArrayFromRoot(payload: unknown): Array<Record<string, unknown>> {
  if (!payload || typeof payload !== 'object') return [];
  const o = payload as Record<string, unknown>;
  const raw =
    o.dokument ??
    o.Dokument ??
    (typeof o.data === 'object' && o.data !== null
      ? (o.data as Record<string, unknown>).dokument ?? (o.data as Record<string, unknown>).Dokument
      : undefined);
  if (!Array.isArray(raw)) return [];
  return raw.filter((x) => x && typeof x === 'object') as Array<Record<string, unknown>>;
}

/** Deep scan when root has no `dokument` array (some proxies / legacy shapes). */
function collectDokumentRowsDeep(node: unknown, out: Array<Record<string, unknown>>, seen: Set<string>) {
  if (node === null || node === undefined) return;
  if (Array.isArray(node)) {
    for (const item of node) collectDokumentRowsDeep(item, out, seen);
    return;
  }
  if (typeof node !== 'object') return;
  const row = node as Record<string, unknown>;
  const id = row.dokumentId ?? row.dokumentid;
  if (typeof id === 'string' && id.trim()) {
    const key = id.trim();
    if (!seen.has(key)) {
      seen.add(key);
      out.push(row);
    }
    return;
  }
  for (const v of Object.values(row)) collectDokumentRowsDeep(v, out, seen);
}

/** HVD POST /dokumentlista → { dokument: [...] } (case variants + nested dokumentId tolerated) */
export function extractHvdDocuments(payload: unknown): Array<Record<string, unknown>> {
  const direct = dokumentArrayFromRoot(payload);
  if (direct.length > 0) return direct;
  const deep: Array<Record<string, unknown>> = [];
  collectDokumentRowsDeep(payload, deep, new Set());
  return deep;
}

/** FI POST /organisationer returns OrganisationInformationResponse[] (array at root) */
function normalizeFiOrganisationBlocks(data: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(data)) return data as Array<Record<string, unknown>>;
  if (data && typeof data === 'object') {
    const o = data as Record<string, unknown>;
    const wrapped = o.organisationInformation;
    if (Array.isArray(wrapped)) return wrapped as Array<Record<string, unknown>>;
  }
  return [];
}

function flattenOrchestratedFinancialReports(blocks: Array<Record<string, unknown>>) {
  const rows: { key: string; arende: string; period: string; typ: string; datum: string }[] = [];
  blocks.forEach((block, bi) => {
    const arende = block.arende as Record<string, unknown> | undefined;
    const arendeStr = arende ? String(arende.arendenummer ?? '—') : '—';
    const rapporter = block.rapporter;
    if (!Array.isArray(rapporter)) return;
    rapporter.forEach((rep, ri) => {
      if (!rep || typeof rep !== 'object') return;
      const r = rep as Record<string, unknown>;
      const period = r.rapporteringsperiod as Record<string, unknown> | undefined;
      const typ = r.rapportTyp as Record<string, unknown> | undefined;
      const periodStr =
        period && (period.periodFrom != null || period.periodTom != null)
          ? `${String(period.periodFrom ?? '')}–${String(period.periodTom ?? '')}`
          : '—';
      rows.push({
        key: `${bi}-${ri}`,
        arende: arendeStr,
        period: periodStr,
        typ: typ ? String(typ.klartext ?? typ.kod ?? '—') : '—',
        datum: String(r.registreradDatum ?? r.ankomDatum ?? r.handlaggningAvslutadDatum ?? '—'),
      });
    });
  });
  return rows;
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
  const [fiOrg, setFiOrg] = useState(sourceState<unknown>());
  const [fiCases, setFiCases] = useState(sourceState<Record<string, unknown>>());
  const [fiCapital, setFiCapital] = useState(sourceState<Record<string, unknown>>());
  const [fiEngagements, setFiEngagements] = useState(sourceState<Record<string, unknown>>());
  const [fiFinancial, setFiFinancial] = useState(sourceState<Record<string, unknown>>());
  const [snapshots, setSnapshots] = useState<Array<Record<string, unknown>>>([]);
  const [downloadMsg, setDownloadMsg] = useState('');
  const [refreshingSources, setRefreshingSources] = useState(false);

  const loadEndpoints = useCallback(async (identitet: string) => {
    setRefreshingSources(true);
    const fiCategories = [
      'ORGANISATIONSADRESSER',
      'FIRMATECKNING',
      'FUNKTIONARER',
      'HEMVISTKOMMUN',
      'RAKENSKAPSAR',
      'ORGANISATIONSDATUM',
      'VERKSAMHETSBESKRIVNING',
      'AKTIEINFORMATION',
      'SAMTLIGA_ORGANISATIONSNAMN',
      'ORGANISATIONSENGAGEMANG',
      'TILLSTAND',
      'FINANSIELLA_RAPPORTER',
      'OVRIG_ORGANISATIONSINFORMATION',
      'ORGANISATIONSMARKERINGAR',
      'BESTAMMELSER',
    ];
    const results = await Promise.allSettled([
      hvdClient.hvdGetOrganisation({ identitetsbeteckning: identitet }),
      hvdClient.hvdGetDocumentList({ identitetsbeteckning: identitet }),
      fiClient.fiGetOrganisation({ identitetsbeteckning: identitet, informationCategories: fiCategories }),
      fiClient.fiGetCases({ organisationIdentitetsbeteckning: identitet }),
      fiClient.fiGetShareCapitalChanges({ identitetsbeteckning: identitet }),
      fiClient.fiGetOrganisationEngagements({ identitetsbeteckning: identitet, paginering: { sida: 1, antalPerSida: 25 } }),
      fiClient.fiGetFinancialReports({ identitetsbeteckning: identitet }),
    ]);
    setHvdOrg(mapSettled(results[0] as PromiseSettledResult<Record<string, unknown>>));
    setHvdDocs(mapSettled(results[1] as PromiseSettledResult<Record<string, unknown>>));
    setFiOrg(mapSettled(results[2] as PromiseSettledResult<unknown>));
    setFiCases(mapSettled(results[3] as PromiseSettledResult<Record<string, unknown>>));
    setFiCapital(mapSettled(results[4] as PromiseSettledResult<Record<string, unknown>>));
    setFiEngagements(mapSettled(results[5] as PromiseSettledResult<Record<string, unknown>>));
    setFiFinancial(mapSettled(results[6] as PromiseSettledResult<Record<string, unknown>>));
    setRefreshingSources(false);
  }, []);

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
  }, [org, loadEndpoints]);

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
  const financialReports = (company.financialReports as Array<Record<string, unknown>> | undefined) ?? [];
  const financialReportRows = flattenOrchestratedFinancialReports(financialReports);

  const hvdEndpointOrg = extractHvdOrganisation(hvdOrg.data);
  const dokumentRows = extractHvdDocuments(hvdDocs.data);
  const fiBlocks = normalizeFiOrganisationBlocks(fiOrg.data);

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
              void api.lookupCompany(org, true).then((r) => setLookupResult(r as Record<string, unknown>)).catch(() => undefined);
              void loadEndpoints(org);
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
          <div className="grid gap-6 lg:grid-cols-2">
            <Panel title="HVD section (from orchestrated response)" badge="hvdSection">
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
            </Panel>
            <Panel title="FI v4 section (from orchestrated response)" badge="v4Section">
              <FieldGrid
                rows={pickStrings(v4Section ?? null, [
                  'organisationsnamn',
                  'organisationsform',
                  'organisationsdatum',
                  'verksamhetsbeskrivning',
                ])}
              />
            </Panel>
          </div>
          <Panel title="Financial reports (orchestrated)" badge="FI metadata — not file download">
            {financialReportRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No rows in <code className="font-mono text-xs">company.financialReports</code>. Årsredovisning files are listed under the{' '}
                <strong>HVD annual files</strong> tab (dokumentlista).
              </p>
            ) : (
              <Table>
                <thead>
                  <tr>
                    <th>Ärende</th>
                    <th>Period</th>
                    <th>Typ</th>
                    <th>Registrerad / ankom</th>
                  </tr>
                </thead>
                <tbody>
                  {financialReportRows.map((r) => (
                    <tr key={r.key}>
                      <td className="font-mono text-xs">{r.arende}</td>
                      <td className="text-sm">{r.period}</td>
                      <td className="text-sm">{r.typ}</td>
                      <td className="text-sm">{r.datum}</td>
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
          <Panel title="POST /bolagsverket/fi/organisationer" badge={fiOrg.ok ? 'ok' : 'error'}>
            {fiOrg.error ? <ErrorState title="FI organisationer failed" message={fiOrg.error} /> : null}
            {fiBlocks.length === 0 && fiOrg.ok ? (
              <p className="text-sm text-muted-foreground">Empty response array.</p>
            ) : (
              fiBlocks.map((block, idx) => (
                <div key={idx} className="mb-6 border-2 border-foreground p-4 last:mb-0">
                  <p className="mono-label mb-3 text-[10px]">Block {idx + 1}</p>
                  <FieldGrid
                    rows={Object.entries(block)
                      .filter(([, v]) => v !== null && v !== undefined)
                      .slice(0, 40)
                      .map(([k, v]) => ({
                        label: k,
                        value: typeof v === 'string' ? v : JSON.stringify(v),
                      }))}
                  />
                </div>
              ))
            )}
          </Panel>
        </div>
      ) : null}

      {tab === 'reports' ? (
        <div className="space-y-6">
          <Panel title="POST /bolagsverket/hvd/dokumentlista" badge={hvdDocs.ok ? 'ok' : 'error'}>
            {hvdDocs.error ? <ErrorState title="HVD dokumentlista failed" message={hvdDocs.error} /> : null}
            <p className="mb-4 text-sm text-muted-foreground">
              Download uses dokumentId from this list only — GET /bolagsverket/hvd/dokument/:id
            </p>
            {dokumentRows.length === 0 ? (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  No rows with <code className="font-mono text-xs">dokumentId</code> in the dokumentlista response. Bolagsverket only exposes downloads here when
                  HVD returns document metadata; orchestrated <code className="font-mono text-xs">financialReports</code> are separate (metadata only).
                </p>
                {hvdDocs.ok && hvdDocs.data ? (
                  <details className="border-2 border-foreground p-4">
                    <summary className="cursor-pointer font-mono text-[10px] uppercase tracking-widest">Raw dokumentlista response (debug)</summary>
                    <pre className="mt-4 max-h-96 overflow-auto font-mono text-xs">{JSON.stringify(hvdDocs.data, null, 2)}</pre>
                  </details>
                ) : null}
              </div>
            ) : (
              <Table>
                <thead>
                  <tr>
                    <th>Period (tom)</th>
                    <th>Registered</th>
                    <th>Format</th>
                    <th>dokumentId</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {dokumentRows.map((row, idx) => {
                    const docId = String(row.dokumentId ?? row.dokumentid ?? '');
                    return (
                      <tr key={`${docId}-${idx}`}>
                        <td>{String(row.rapporteringsperiodTom ?? '—')}</td>
                        <td>{String(row.registreringstidpunkt ?? '—')}</td>
                        <td>{String(row.filformat ?? '—')}</td>
                        <td className="font-mono text-xs">{docId || '—'}</td>
                        <td>
                          {docId ? (
                            <Button
                              variant="primary"
                              className="min-h-9 px-3 py-1 text-[10px]"
                              onClick={async () => {
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
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            )}
            {downloadMsg ? <p className="mt-4 font-mono text-xs text-muted-foreground">{downloadMsg}</p> : null}
          </Panel>
        </div>
      ) : null}

      {tab === 'fiReports' ? (
        <Panel title="POST /bolagsverket/fi/finansiella-rapporter" badge={fiFinancial.ok ? 'ok' : 'error'}>
          {fiFinancial.error ? <ErrorState title="FI finansiella-rapporter failed" message={fiFinancial.error} /> : null}
          {fiFinancial.data ? (
            <pre className="overflow-x-auto border-2 border-foreground p-4 font-mono text-xs">{JSON.stringify(fiFinancial.data, null, 2)}</pre>
          ) : (
            !fiFinancial.error && <p className="text-sm text-muted-foreground">No data.</p>
          )}
        </Panel>
      ) : null}

      {tab === 'cases' ? (
        <Panel title="POST /bolagsverket/fi/arenden" badge={fiCases.ok ? 'ok' : 'error'}>
          {fiCases.error ? <ErrorState title="FI ärenden failed" message={fiCases.error} /> : null}
          {fiCases.data ? (
            <pre className="overflow-x-auto border-2 border-foreground p-4 font-mono text-xs">{JSON.stringify(fiCases.data, null, 2)}</pre>
          ) : null}
        </Panel>
      ) : null}

      {tab === 'capital' ? (
        <Panel title="POST /bolagsverket/fi/aktiekapitalforandringar" badge={fiCapital.ok ? 'ok' : 'error'}>
          {fiCapital.error ? <ErrorState title="FI aktiekapital failed" message={fiCapital.error} /> : null}
          {fiCapital.data ? (
            <pre className="overflow-x-auto border-2 border-foreground p-4 font-mono text-xs">{JSON.stringify(fiCapital.data, null, 2)}</pre>
          ) : null}
        </Panel>
      ) : null}

      {tab === 'engagements' ? (
        <Panel title="POST /bolagsverket/fi/organisationsengagemang" badge={fiEngagements.ok ? 'ok' : 'error'}>
          {fiEngagements.error ? <ErrorState title="FI engagemang failed" message={fiEngagements.error} /> : null}
          {fiEngagements.data ? (
            <pre className="overflow-x-auto border-2 border-foreground p-4 font-mono text-xs">{JSON.stringify(fiEngagements.data, null, 2)}</pre>
          ) : null}
        </Panel>
      ) : null}
    </section>
  );
}

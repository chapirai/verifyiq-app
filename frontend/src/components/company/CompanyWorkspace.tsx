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
import { AnnualReportsWorkspacePanel } from '@/components/company/AnnualReportsWorkspacePanel';
import type {
  CompanyServingBundle,
  CompanyOverviewServing,
  CompanyVerkligaHuvudmanServing,
} from '@/types/company-serving';
import type { SourceFetchState } from '@/types/source-data';

type TabId =
  | 'overview'
  | 'ownership'
  | 'hvd'
  | 'fiOrg'
  | 'reports'
  | 'annualParsed'
  | 'fiReports'
  | 'cases'
  | 'capital'
  | 'engagements'
  | 'vhRegister';

const LOOKUP_CACHE_PREFIX = 'verifyiq:lookup:';

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

const emptyServing = (): CompanyServingBundle => ({
  overview: null,
  officers: [],
  reports: [],
  documents: [],
  cases: [],
  shareCapital: null,
  engagements: [],
  verkligaHuvudman: null,
});

function vhPersonLabel(p: Record<string, unknown>): string {
  const pn = p.personnamn as Record<string, unknown> | undefined;
  if (pn) {
    const parts = [pn.fornamn, pn.mellannamn, pn.efternamn].filter(Boolean).map(String);
    if (parts.length) return parts.join(' ');
  }
  return 'Anonym / uppgift saknas';
}

function VerkligaHuvudmanRegisterPanel({ row }: { row: CompanyVerkligaHuvudmanServing | null }) {
  if (!row?.payload || typeof row.payload !== 'object') {
    return (
      <EmptyStatePro
        title="No Verkliga huvudmän row stored yet"
        message="Enable BV_VH_ENABLED on the backend, ensure OAuth can reach the VH gateway, then run a fresh lookup. This dataset is separate from HVD and Företagsinformation v4."
      />
    );
  }
  const payload = row.payload;
  const org = payload.organisation as Record<string, unknown> | undefined;
  const vhs = Array.isArray(payload.verkligHuvudman) ? (payload.verkligHuvudman as Record<string, unknown>[]) : [];
  const indirectKeys = new Map<string, { name: string; orgNr: string }>();
  for (const vh of vhs) {
    const kontroll = Array.isArray(vh.kontroll) ? (vh.kontroll as Record<string, unknown>[]) : [];
    for (const k of kontroll) {
      const ik = k.indirektKontroll as Record<string, unknown> | undefined;
      const orgNr = ik?.identitetsbeteckning != null ? String(ik.identitetsbeteckning).replace(/\D/g, '').slice(0, 10) : '';
      const name = ik?.organisationsnamn != null ? String(ik.organisationsnamn) : orgNr;
      if (orgNr) indirectKeys.set(orgNr, { name, orgNr });
    }
  }
  const intermediates = [...indirectKeys.values()];
  const orgNr = org?.identitetsbeteckning != null ? String(org.identitetsbeteckning) : '';
  const orgName = org?.organisationsnamn != null ? String(org.organisationsnamn) : orgNr || 'Organisation';
  const status = org?.statusForVerkligHuvudman as Record<string, unknown> | undefined;
  const warnings = Array.isArray(org?.felaktigaUppgifterIRegistretOverVerkligaHuvudman)
    ? (org.felaktigaUppgifterIRegistretOverVerkligaHuvudman as Record<string, unknown>[])
    : [];

  return (
    <div className="space-y-8">
      <Panel title="Bolagsverket — Verkliga huvudmän (register API)" badge="separate from FI + HVD">
        <p className="mb-4 text-sm text-muted-foreground">
          Source gateway: Verkliga huvudmän v1 (accept / production per backend BV_VH_BASE_URL). Same OAuth client flow as
          Företagsinformation when enabled. Not mixed into the HVD or FI organisationer payloads.
        </p>
        <div className="mb-6 flex flex-wrap gap-2 text-[10px] uppercase tracking-widest">
          <StatusChip>Stored snapshot</StatusChip>
          {row.fetchedAt ? <StatusChip>Fetched {formatDateOnly(row.fetchedAt)}</StatusChip> : null}
          {row.requestId ? (
            <span className="font-mono text-[10px] text-muted-foreground">request {row.requestId}</span>
          ) : null}
        </div>
        {warnings.length > 0 ? (
          <div className="mb-6 border border-destructive/40 bg-destructive/5 p-3 text-sm">
            <p className="mono-label text-[10px] text-destructive">Registervarning</p>
            <ul className="mt-2 list-disc pl-5">
              {warnings.map((w, i) => (
                <li key={i}>{String(w.klartext ?? w.kod ?? '—')}</li>
              ))}
            </ul>
          </div>
        ) : null}
        <FieldGridPro
          rows={[
            { label: 'Organisation', value: displayValue(orgName) },
            { label: 'Organisationsnummer', value: displayValue(orgNr) },
            {
              label: 'Status (VH)',
              value: displayValue(status?.klartext != null ? String(status.klartext) : String(status?.kod ?? '')),
            },
            { label: 'Registrerade VH-personer', value: String(vhs.length) },
          ]}
        />
      </Panel>

      <Panel title="Ownership map (register view)" badge="UX sketch">
        <p className="mb-6 text-sm text-muted-foreground">
          Visual layout for indirect structures: subject company at the top, intermediate legal entities in the middle,
          registered beneficial owners at the bottom. Edges follow Bolagsverket <code className="font-mono text-xs">kontroll</code> objects.
        </p>
        <div className="relative flex flex-col items-center gap-6 py-4">
          <div className="w-full max-w-xl border-2 border-foreground bg-background p-4 text-center">
            <p className="mono-label text-[10px] text-muted-foreground">Subject (register)</p>
            <p className="mt-2 font-display text-lg">{orgName}</p>
            <p className="mt-1 font-mono text-xs">{orgNr}</p>
          </div>
          {intermediates.length > 0 ? (
            <>
              <div className="h-6 w-px bg-foreground" aria-hidden />
              <div className="flex w-full max-w-4xl flex-wrap justify-center gap-4">
                {intermediates.map((n) => (
                  <div
                    key={n.orgNr}
                    className="min-w-[140px] flex-1 border-2 border-dashed border-foreground/40 p-3 text-center text-sm"
                  >
                    <p className="mono-label text-[10px] text-muted-foreground">Indirekt kontroll</p>
                    <p className="mt-2 font-medium leading-snug">{n.name}</p>
                    <p className="mt-1 font-mono text-[10px]">{n.orgNr}</p>
                  </div>
                ))}
              </div>
            </>
          ) : null}
          <div className="h-6 w-px bg-foreground" aria-hidden />
          <div className="grid w-full max-w-4xl gap-4 sm:grid-cols-2">
            {vhs.length === 0 ? (
              <p className="text-sm text-muted-foreground">Inga personposter i detta snapshot.</p>
            ) : (
              vhs.map((vh, idx) => {
                const anon = Boolean(vh.arAnonym);
                const omf = vh.omfattningAvKontroll as Record<string, unknown> | undefined;
                const kontroll = Array.isArray(vh.kontroll) ? (vh.kontroll as Record<string, unknown>[]) : [];
                return (
                  <div key={idx} className="border-2 border-foreground p-4">
                    <p className="mono-label text-[10px] text-muted-foreground">Verklig huvudman</p>
                    <p className="mt-2 font-medium">{anon ? 'Anonymiserad' : vhPersonLabel(vh)}</p>
                    {!anon ? (
                      <p className="mt-1 font-mono text-xs">
                        {String((vh.identitet as Record<string, unknown> | undefined)?.identitetsbeteckning ?? '—')}
                      </p>
                    ) : null}
                    <p className="mt-3 text-xs text-muted-foreground">
                      Omfattning: {String(omf?.klartext ?? omf?.kod ?? '—')}
                    </p>
                    {kontroll.length > 0 ? (
                      <ul className="mt-3 space-y-1 border-t border-border-light pt-3 text-xs">
                        {kontroll.map((k, j) => {
                          const art = k.artAvKontroll as Record<string, unknown> | undefined;
                          return (
                            <li key={j}>
                              <span className="text-muted-foreground">{String(art?.klartext ?? art?.kod ?? 'Kontroll')}</span>
                            </li>
                          );
                        })}
                      </ul>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </Panel>
    </div>
  );
}

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

function scalarHvdDisplay(raw: unknown): string {
  if (raw == null) return 'Not available';
  if (typeof raw === 'string') return raw.trim() === '' ? 'Not available' : raw;
  if (typeof raw === 'number' || typeof raw === 'boolean') return String(raw);
  if (typeof raw === 'object') {
    const o = raw as Record<string, unknown>;
    for (const k of ['klartext', 'beskrivning', 'kod', 'text']) {
      const v = o[k];
      if (typeof v === 'string' && v.trim()) return v;
    }
  }
  return 'Not available';
}

/** Flatten nested HVD organisation objects into labelled rows (no raw JSON blobs). */
function flattenHvdOrganisationFields(
  obj: Record<string, unknown>,
  prefix = '',
  depth = 0,
): { label: string; value: string }[] {
  if (depth > 6) return [{ label: prefix || 'värde', value: '…' }];
  const out: { label: string; value: string }[] = [];
  for (const [k, v] of Object.entries(obj)) {
    if (k === 'organisationer' || k === 'dokument') continue;
    const label = prefix ? `${prefix} · ${k}` : k;
    if (v === null || v === undefined) continue;
    if (Array.isArray(v)) {
      if (v.length === 0) continue;
      const allObj = v.every((x) => x && typeof x === 'object' && !Array.isArray(x));
      if (allObj) continue;
      out.push({ label, value: v.map((x) => scalarHvdDisplay(x)).join(', ') });
    } else if (typeof v === 'object') {
      out.push(...flattenHvdOrganisationFields(v as Record<string, unknown>, label, depth + 1));
    } else {
      out.push({ label, value: scalarHvdDisplay(v) });
    }
  }
  return out;
}

function hvdObjectArrayTables(obj: Record<string, unknown> | null): { key: string; rows: Record<string, unknown>[] }[] {
  if (!obj) return [];
  const blocks: { key: string; rows: Record<string, unknown>[] }[] = [];
  for (const [k, v] of Object.entries(obj)) {
    if (!Array.isArray(v) || v.length === 0) continue;
    if (!v.every((x) => x && typeof x === 'object' && !Array.isArray(x))) continue;
    blocks.push({ key: k, rows: v as Record<string, unknown>[] });
  }
  return blocks;
}

type HvdLiveDocRow = { dokumentId: string; periodTom: string; registered: string; format: string; docType: string };

function extractLiveHvdDokumentRows(payload: unknown): HvdLiveDocRow[] {
  if (!payload || typeof payload !== 'object') return [];
  const dok = (payload as Record<string, unknown>).dokument;
  if (!Array.isArray(dok)) return [];
  const out: HvdLiveDocRow[] = [];
  for (const item of dok) {
    if (!item || typeof item !== 'object') continue;
    const r = item as Record<string, unknown>;
    const dokumentId = String(r.dokumentId ?? '').trim();
    if (!dokumentId) continue;
    out.push({
      dokumentId,
      periodTom: scalarHvdDisplay(r.rapporteringsperiodTom),
      registered: scalarHvdDisplay(r.registreringstidpunkt),
      format: scalarHvdDisplay(r.filformat),
      docType: scalarHvdDisplay(r.dokumenttyp),
    });
  }
  return out;
}

function hvdTopLevelFel(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const fel = (payload as Record<string, unknown>).fel;
  if (fel == null) return null;
  if (typeof fel === 'string') return fel;
  return scalarHvdDisplay(fel);
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
  const [serving, setServing] = useState<CompanyServingBundle>(() => emptyServing());
  const [servingMeta, setServingMeta] = useState<{ loading: boolean; error: string | null }>({
    loading: false,
    error: null,
  });
  const [snapshots, setSnapshots] = useState<Array<Record<string, unknown>>>([]);
  const [downloadMsg, setDownloadMsg] = useState('');
  const [refreshingSources, setRefreshingSources] = useState(false);
  const [ownershipGraph, setOwnershipGraph] = useState<Record<string, unknown> | null>(null);
  const [ownershipError, setOwnershipError] = useState<string | null>(null);
  const [ownershipLoading, setOwnershipLoading] = useState(false);
  const [namnskyddslopnummer, setNamnskyddslopnummer] = useState('');
  const namnskyddRef = useRef('');
  useEffect(() => {
    namnskyddRef.current = namnskyddslopnummer;
  }, [namnskyddslopnummer]);

  const loadServing = useCallback(async (identitet: string) => {
    setServingMeta({ loading: true, error: null });
    try {
      const bundle = await api.getCompanyServingBundle(identitet);
      setServing(bundle);
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

  const loadOwnership = useCallback(async (identitet: string) => {
    setOwnershipLoading(true);
    setOwnershipError(null);
    try {
      const graph = await api.getOwnershipGraph(identitet);
      setOwnershipGraph(graph as Record<string, unknown>);
    } catch (e) {
      setOwnershipGraph(null);
      setOwnershipError(e instanceof Error ? e.message : 'Ownership graph unavailable');
    } finally {
      setOwnershipLoading(false);
    }
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
    const lookupCacheKey = `${LOOKUP_CACHE_PREFIX}${org}`;
    const cachedLookup = sessionStorage.getItem(lookupCacheKey);
    if (cachedLookup) {
      try {
        setLookupResult(JSON.parse(cachedLookup) as Record<string, unknown>);
      } catch {
        sessionStorage.removeItem(lookupCacheKey);
      }
    }
    api
      .lookupCompany(org, false)
      .then((res) => {
        const payload = res as Record<string, unknown>;
        setLookupResult(payload);
        sessionStorage.setItem(lookupCacheKey, JSON.stringify(payload));
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
    void loadOwnership(org);
  }, [org, loadEndpoints, loadServing, loadOwnership]);

  if (!org || org.length < 10) {
    return <ErrorState title="Invalid organisation number" message="Use a 10- or 12-digit identitetsbeteckning in the URL." />;
  }

  if (lookupLoading && !lookupResult) {
    return <LoadingSkeleton lines={12} />;
  }

  const company = (lookupResult?.company as Record<string, unknown> | undefined) ?? {};
  const metadata = (lookupResult?.metadata as Record<string, unknown> | undefined) ?? {};
  const profileCompleteness = String(metadata.profile_completeness ?? 'unknown');
  const hasDualApiCoverage = profileCompleteness === 'complete';
  const hvdSection = company.hvdSection as Record<string, unknown> | undefined;
  const v4Section = company.v4Section as Record<string, unknown> | undefined;

  const hvdEndpointOrg = extractHvdOrganisation(hvdOrg.data);
  const servingOverviewRows = serving.overview ? buildServingOverviewSummary(serving.overview) : [];

  const hvdOrgFlatRows = hvdEndpointOrg ? flattenHvdOrganisationFields(hvdEndpointOrg) : [];
  const hvdOrgArrayTables = hvdObjectArrayTables(hvdEndpointOrg);
  const hvdLiveDokumentRows = extractLiveHvdDokumentRows(hvdDocs.data);
  const hvdOrgFel = hvdTopLevelFel(hvdOrg.data);
  const hvdDocsFel = hvdTopLevelFel(hvdDocs.data);

  return (
    <section className="space-y-8">
      <div className="flex flex-col gap-4 border-b-2 border-foreground pb-6 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="mono-label text-[10px] text-muted-foreground">Company workspace</p>
          <h1 className="font-display text-4xl md:text-5xl">{String(company.legalName ?? 'Organisation')}</h1>
          <p className="mt-2 font-mono text-sm">{org}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button href={`/lists?addOrg=${encodeURIComponent(org)}`} variant="secondary" className="min-h-10 text-[10px]">
            Add to list
          </Button>
          <Button href={`/compare?orgs=${encodeURIComponent(org)}`} variant="secondary" className="min-h-10 text-[10px]">
            Compare
          </Button>
          <Button href={`/alerts?org=${encodeURIComponent(org)}`} variant="secondary" className="min-h-10 text-[10px]">
            Set alerts
          </Button>
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
              void loadOwnership(org);
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

      <div className="grid gap-3 md:grid-cols-3">
        <article className="border-2 border-foreground p-4">
          <p className="mono-label text-[10px]">Värdefulla datamängder (HVD)</p>
          <p className="mt-2 text-sm">{String(metadata.has_hvd_data ?? false)}</p>
        </article>
        <article className="border-2 border-foreground p-4">
          <p className="mono-label text-[10px]">Företagsinformation v4</p>
          <p className="mt-2 text-sm">{String(metadata.has_foretagsinfo_data ?? false)}</p>
        </article>
        <article className="border-2 border-foreground p-4">
          <p className="mono-label text-[10px]">Verkliga huvudmän (register)</p>
          <p className="mt-2 text-sm">{String(metadata.has_verkliga_huvudman_data ?? false)}</p>
        </article>
      </div>

      {lookupError ? <ErrorState title="Lookup unavailable" message={lookupError} /> : null}
      {servingMeta.error ? <ErrorState title="Read model unavailable" message={servingMeta.error} /> : null}
      {!hasDualApiCoverage ? (
        <ErrorState
          title="Partial provider coverage"
          message="This lookup did not return full dual-API coverage for the organisation number. Trigger Force refresh to re-run HVD + Företagsinformation and complete the profile."
        />
      ) : null}
      {servingMeta.loading ? (
        <p className="text-sm text-muted-foreground">Updating read-model tables…</p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <TabButton active={tab === 'overview'} onClick={() => setTab('overview')}>
          Overview
        </TabButton>
        <TabButton active={tab === 'ownership'} onClick={() => setTab('ownership')}>
          Ownership
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
        <TabButton active={tab === 'annualParsed'} onClick={() => setTab('annualParsed')}>
          Årsredovisning (parsed)
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
        <TabButton active={tab === 'vhRegister'} onClick={() => setTab('vhRegister')}>
          Verkliga huvudmän
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

      {tab === 'ownership' ? (
        <Panel title="Ownership intelligence (phase 3 foundation)" badge="ownership.graph">
          {ownershipLoading ? <LoadingSkeleton lines={6} /> : null}
          {ownershipError ? <ErrorState title="Ownership graph unavailable" message={ownershipError} /> : null}
          {!ownershipLoading && !ownershipError ? (
            <div className="space-y-6">
              <div className="grid gap-3 md:grid-cols-3">
                <article className="border border-border-light p-3">
                  <p className="mono-label text-[10px]">Owner nodes</p>
                  <p className="mt-2 text-xl">
                    {String(
                      ((ownershipGraph?.structuralComplexity as Record<string, unknown> | undefined)?.ownerNodes as number | undefined) ?? 0,
                    )}
                  </p>
                </article>
                <article className="border border-border-light p-3">
                  <p className="mono-label text-[10px]">Ownership links</p>
                  <p className="mt-2 text-xl">
                    {String(
                      ((ownershipGraph?.structuralComplexity as Record<string, unknown> | undefined)?.ownershipLinks as number | undefined) ?? 0,
                    )}
                  </p>
                </article>
                <article className="border border-border-light p-3">
                  <p className="mono-label text-[10px]">Max chain depth</p>
                  <p className="mt-2 text-xl">
                    {String(
                      ((ownershipGraph?.structuralComplexity as Record<string, unknown> | undefined)?.maxChainDepth as number | undefined) ?? 0,
                    )}
                  </p>
                </article>
              </div>

              <SectionCard title="Data coverage">
                <dl className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <dt className="mono-label text-[10px] text-muted-foreground">Ownership links</dt>
                    <dd>{String((ownershipGraph?.dataCoverage as Record<string, unknown> | undefined)?.hasOwnershipLinks ?? false)}</dd>
                  </div>
                  <div>
                    <dt className="mono-label text-[10px] text-muted-foreground">Declared beneficial owners</dt>
                    <dd>{String((ownershipGraph?.dataCoverage as Record<string, unknown> | undefined)?.hasBeneficialOwnerRows ?? false)}</dd>
                  </div>
                  <div>
                    <dt className="mono-label text-[10px] text-muted-foreground">VH register snapshot</dt>
                    <dd>{String((ownershipGraph?.dataCoverage as Record<string, unknown> | undefined)?.hasVerkligaHuvudmanSnapshot ?? false)}</dd>
                  </div>
                  <div>
                    <dt className="mono-label text-[10px] text-muted-foreground">Opacity risk</dt>
                    <dd className="uppercase">
                      {String((ownershipGraph?.dataCoverage as Record<string, unknown> | undefined)?.opaqueOwnershipRisk ?? '—')}
                    </dd>
                  </div>
                </dl>
              </SectionCard>

              <SectionCard title="Subgraph query (performance)">
                <p className="mb-3 text-sm text-muted-foreground">
                  Only ownership links reachable upward from this organisation are loaded (not the entire tenant link
                  table).
                </p>
                <dl className="grid gap-2 text-sm sm:grid-cols-3">
                  <div>
                    <dt className="mono-label text-[10px] text-muted-foreground">Links loaded</dt>
                    <dd>{String((ownershipGraph?.subgraph as Record<string, unknown> | undefined)?.linksLoaded ?? '—')}</dd>
                  </div>
                  <div>
                    <dt className="mono-label text-[10px] text-muted-foreground">Expansion waves</dt>
                    <dd>{String((ownershipGraph?.subgraph as Record<string, unknown> | undefined)?.expansionWaves ?? '—')}</dd>
                  </div>
                  <div>
                    <dt className="mono-label text-[10px] text-muted-foreground">Distinct owned orgs queried</dt>
                    <dd>{String((ownershipGraph?.subgraph as Record<string, unknown> | undefined)?.distinctOwnedOrgsVisited ?? '—')}</dd>
                  </div>
                </dl>
              </SectionCard>

              <SectionCard title="Register vs share-chain engine">
                <p className="mb-3 text-sm text-muted-foreground">
                  Bolagsverket <strong>Verkliga huvudmän</strong> (stored snapshot) is compared to persons inferred from
                  ownership links (multiplied stakes, ≥25% rule). Status explains agreement or gaps—both are legitimate
                  lenses for M&A and KYC.
                </p>
                {ownershipGraph?.verkligaHuvudmanRegister ? (
                  <p className="mono-label mb-3 text-[10px] text-muted-foreground">
                    VH snapshot fetched:{' '}
                    {String((ownershipGraph.verkligaHuvudmanRegister as Record<string, unknown>).fetchedAt ?? '—')}
                  </p>
                ) : (
                  <p className="mb-3 text-sm text-muted-foreground">No VH snapshot stored for this tenant and org yet.</p>
                )}
                {(() => {
                  const rec = ownershipGraph?.reconciliation as Record<string, unknown> | undefined;
                  const summary = rec?.summary as Record<string, unknown> | undefined;
                  const rows = Array.isArray(rec?.rows) ? (rec!.rows as Array<Record<string, unknown>>) : [];
                  if (rows.length === 0) {
                    return <p className="text-sm text-muted-foreground">No reconciliation rows (no persons on register or chain).</p>;
                  }
                  return (
                    <div className="space-y-3">
                      <div className="grid gap-2 text-xs sm:grid-cols-4">
                        <div>
                          <span className="mono-label text-muted-foreground">Aligned</span>{' '}
                          <span className="font-medium">{String(summary?.aligned ?? 0)}</span>
                        </div>
                        <div>
                          <span className="mono-label text-muted-foreground">Register only</span>{' '}
                          <span className="font-medium">{String(summary?.registerOnly ?? 0)}</span>
                        </div>
                        <div>
                          <span className="mono-label text-muted-foreground">Derived UBO only</span>{' '}
                          <span className="font-medium">{String(summary?.derivedUboOnly ?? 0)}</span>
                        </div>
                        <div>
                          <span className="mono-label text-muted-foreground">Chain context</span>{' '}
                          <span className="font-medium">{String(summary?.chainContext ?? 0)}</span>
                        </div>
                      </div>
                      <Table>
                        <thead>
                          <tr>
                            <th>Person</th>
                            <th>Status</th>
                            <th>VH register</th>
                            <th>Chain ≥25%</th>
                            <th>Eff. ownership %</th>
                            <th>Eff. control %</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((row, idx) => (
                            <tr key={`${String(row.key ?? idx)}`}>
                              <td>{String(row.label ?? '—')}</td>
                              <td className="font-mono text-[10px]">{String(row.status ?? '—')}</td>
                              <td>{String(row.registerListed ?? false)}</td>
                              <td>{String(row.shareChainDerivedMeetsThreshold ?? false)}</td>
                              <td>{row.calculatedEffectiveOwnership != null ? String(row.calculatedEffectiveOwnership) : '—'}</td>
                              <td>{row.calculatedEffectiveControl != null ? String(row.calculatedEffectiveControl) : '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </Table>
                    </div>
                  );
                })()}
              </SectionCard>

              <SectionCard title="Control paths (explanation)">
                {Array.isArray(ownershipGraph?.controlPaths) && (ownershipGraph.controlPaths as unknown[]).length > 0 ? (
                  <ul className="space-y-4 text-sm">
                    {(ownershipGraph.controlPaths as Array<Record<string, unknown>>).map((p, i) => (
                      <li key={i} className="border-b border-border-light pb-3">
                        <p className="font-medium leading-snug">{String(p.summary ?? '')}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Cumulative ownership {String(p.cumulativeOwnershipPercentage ?? '—')}% · control{' '}
                          {String(p.cumulativeControlPercentage ?? '—')}%
                          {p.hasUnknownEdgeWeights ? (
                            <span className="ml-2 rounded border border-border-light px-1.5 py-0.5 text-[10px] uppercase">
                              partial weights
                            </span>
                          ) : null}
                        </p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No multi-step paths recorded yet. Populate ownership links (direct and indirect) to see how control flows into this entity.
                  </p>
                )}
              </SectionCard>

              <SectionCard title="Ultimate beneficial owners (>=25% or control)">
                {Array.isArray(ownershipGraph?.ubos) && ownershipGraph.ubos.length > 0 ? (
                  <Table>
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Personnummer</th>
                        <th>Effective ownership</th>
                        <th>Effective control</th>
                        <th>Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(ownershipGraph.ubos as Array<Record<string, unknown>>).map((row, idx) => (
                        <tr key={`${String(row.name ?? 'ubo')}-${idx}`}>
                          <td>{String(row.name ?? '—')}</td>
                          <td className="font-mono text-xs">{String(row.personnummer ?? '—')}</td>
                          <td>{String(row.effectiveOwnershipPercentage ?? '0')}%</td>
                          <td>{String(row.effectiveControlPercentage ?? '0')}%</td>
                          <td>{String(row.qualificationReason ?? '—')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                ) : (
                  <p className="text-sm text-muted-foreground">No UBOs currently meet threshold from available ownership links.</p>
                )}
              </SectionCard>
            </div>
          ) : null}
        </Panel>
      ) : null}

      {tab === 'hvd' ? (
        <div className="space-y-6">
          <Panel title="HVD — organisation (live API)" badge={hvdOrg.ok ? 'hvd.organisationer' : 'error'}>
            {hvdOrg.error ? <ErrorState title="HVD organisationer failed" message={hvdOrg.error} /> : null}
            {!hvdOrg.ok && !hvdOrg.error ? <LoadingSkeleton lines={4} /> : null}
            {hvdOrgFel ? <p className="mb-4 text-sm text-destructive">Bolagsverket: {hvdOrgFel}</p> : null}
            {hvdOrgFlatRows.length > 0 ? (
              <SectionCard title="Uppgifter">
                <FieldGridPro rows={hvdOrgFlatRows.map(({ label, value }) => ({ label, value }))} />
              </SectionCard>
            ) : null}
            {hvdOrg.ok && !hvdOrg.error && hvdOrgFlatRows.length === 0 && !hvdOrgFel ? (
              <p className="text-sm text-muted-foreground">No scalar fields in the organisation payload.</p>
            ) : null}
            {hvdOrgArrayTables.map(({ key, rows }) => {
              const keys = [...new Set(rows.flatMap((r) => Object.keys(r)))].slice(0, 12);
              return (
                <SectionCard key={key} title={key}>
                  <Table>
                    <thead>
                      <tr>
                        {keys.map((k) => (
                          <th key={k} className="text-left">
                            {k}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r, i) => (
                        <tr key={i}>
                          {keys.map((k) => (
                            <td key={k} className="text-xs">
                              {scalarHvdDisplay(r[k])}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </SectionCard>
              );
            })}
          </Panel>
          <Panel title="HVD — dokumentlista (live API)" badge={hvdDocs.ok ? 'hvd.dokumentlista' : 'error'}>
            {hvdDocs.error ? <ErrorState title="HVD dokumentlista failed" message={hvdDocs.error} /> : null}
            {!hvdDocs.ok && !hvdDocs.error ? <LoadingSkeleton lines={3} /> : null}
            {hvdDocsFel ? <p className="mb-4 text-sm text-destructive">Bolagsverket: {hvdDocsFel}</p> : null}
            <p className="mb-4 text-sm text-muted-foreground">
              When this list is fetched through the API, the backend queues server-side ZIP download, storage, and iXBRL
              parsing for each eligible annual-report package. Open <strong>Årsredovisning (parsed)</strong> to watch
              extracted figures appear; that view refreshes on its own.
            </p>
            {hvdLiveDokumentRows.length === 0 && hvdDocs.ok && !hvdDocsFel ? (
              <p className="text-sm text-muted-foreground">No documents in the response.</p>
            ) : null}
            {hvdLiveDokumentRows.length > 0 ? (
              <Table>
                <thead>
                  <tr>
                    <th>Period (tom)</th>
                    <th>Registrerad</th>
                    <th>Format</th>
                    <th>Dokumenttyp</th>
                    <th>Dokument-ID</th>
                  </tr>
                </thead>
                <tbody>
                  {hvdLiveDokumentRows.map((row) => (
                    <tr key={row.dokumentId}>
                      <td className="text-sm">{row.periodTom}</td>
                      <td className="text-sm">{row.registered}</td>
                      <td className="text-sm">{row.format}</td>
                      <td className="text-sm">{row.docType}</td>
                      <td className="font-mono text-xs">{row.dokumentId}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            ) : null}
          </Panel>
        </div>
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
              Rows are from the read model (parsed dokumentlista). <strong>Download</strong> saves the ZIP in your browser only.
              Ingest and parsing run automatically when the live dokumentlista is loaded from the API; use{' '}
              <strong>Årsredovisning (parsed)</strong> for figures. Digital annual reports are usually{' '}
              <code className="font-mono text-xs">application/zip</code>.
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
                    <th>Download</th>
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

      {tab === 'annualParsed' ? (
        <Panel title="Årsredovisning — extraherade nyckeltal (iXBRL)" badge="annual_report_xbrl + serving">
          <AnnualReportsWorkspacePanel orgNumber={org} />
        </Panel>
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

      {tab === 'vhRegister' ? <VerkligaHuvudmanRegisterPanel row={serving.verkligaHuvudman} /> : null}
    </section>
  );
}

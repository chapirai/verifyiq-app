'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { api } from '@/lib/api';
import { normalizeIdentitetsbeteckning } from '@/lib/org-number';
import { hvdClient } from '@/lib/source-clients';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
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
import { BolagsverketBulkFileIngestionPanel } from '@/components/bulk/BolagsverketBulkFileIngestionPanel';
import type {
  CompanyServingBundle,
  CompanyServingBundleDiagnostics,
  CompanyOverviewServing,
  CompanyVerkligaHuvudmanServing,
} from '@/types/company-serving';
import type { SourceFetchState } from '@/types/source-data';
import type { CompanySignalsResponse } from '@/types/company-signals';
import type { SimilarCompaniesMode, SimilarCompaniesResponse } from '@/types/sourcing';
import type { CompanyDecisionInsight, CompanyDecisionInsightSnapshot } from '@/types/decision';

type TabId =
  | 'overview'
  | 'ownership'
  | 'financials'
  | 'signals'
  | 'documents'
  | 'compare'
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

function boolWord(v: unknown): 'Yes' | 'No' {
  return v === true || String(v).toLowerCase() === 'true' ? 'Yes' : 'No';
}

function riskWord(v: unknown): string {
  const s = String(v ?? 'unknown').toLowerCase();
  if (s === 'high' || s === 'critical') return 'High';
  if (s === 'medium' || s === 'elevated') return 'Medium';
  if (s === 'low') return 'Low';
  return s === 'unknown' ? 'Unknown' : s;
}

function anomalyExplanation(code: string): string {
  const c = code.toLowerCase();
  if (c.includes('ownership_cycle')) return 'Detected circular ownership links that may hide true control.';
  if (c.includes('unknown_edge')) return 'Ownership links exist but some percentages are missing or unresolved.';
  if (c.includes('nomin')) return 'Possible nominee or proxy structure reducing transparency.';
  if (c.includes('high')) return 'Model flagged this as a high-risk structural pattern.';
  return 'Pattern flagged by the ownership-analysis model.';
}

function WorkspaceCallout({ tone, title, message }: { tone: 'warn' | 'danger' | 'info'; title: string; message: string }) {
  const cls =
    tone === 'danger'
      ? 'border-destructive/60 bg-destructive/5'
      : tone === 'warn'
        ? 'border-foreground/40 bg-muted/25'
        : 'border-border-light bg-muted/15';
  return (
    <article className={`border-2 p-4 ${cls}`} role="status">
      <p className="mono-label text-[10px]">{title}</p>
      <p className="mt-2 text-sm leading-relaxed">{message}</p>
    </article>
  );
}

function pickProviderDiag(
  rows: unknown,
  provider: string,
): { status: string; message?: string; organisation_number?: string } | null {
  if (!Array.isArray(rows)) return null;
  const hit = rows.find((r) => r && typeof r === 'object' && (r as Record<string, unknown>).provider === provider);
  if (!hit || typeof hit !== 'object') return null;
  const o = hit as Record<string, unknown>;
  return {
    status: String(o.status ?? ''),
    message: o.message != null ? String(o.message) : undefined,
    organisation_number: o.organisation_number != null ? String(o.organisation_number) : undefined,
  };
}

function formatIsoShort(iso: string | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

function ProviderStatusCard({ title, statusLine, detail }: { title: string; statusLine: string; detail?: string }) {
  return (
    <article className="border-2 border-foreground p-4">
      <p className="mono-label text-[10px]">{title}</p>
      <p className="mt-2 text-sm font-medium">{statusLine}</p>
      {detail ? <p className="mt-1 text-xs text-muted-foreground leading-snug">{detail}</p> : null}
    </article>
  );
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
  const [ownershipAdvanced, setOwnershipAdvanced] = useState<Record<string, unknown> | null>(null);
  const [ownershipError, setOwnershipError] = useState<string | null>(null);
  const [ownershipLoading, setOwnershipLoading] = useState(false);
  const [ownershipAdvancedAction, setOwnershipAdvancedAction] = useState('');
  const [similar, setSimilar] = useState<SimilarCompaniesResponse | null>(null);
  const [similarLoading, setSimilarLoading] = useState(false);
  const [similarError, setSimilarError] = useState<string | null>(null);
  const [similarMode, setSimilarMode] = useState<SimilarCompaniesMode>('form');
  const [signals, setSignals] = useState<CompanySignalsResponse | null>(null);
  const [signalsLoading, setSignalsLoading] = useState(false);
  const [signalsError, setSignalsError] = useState<string | null>(null);
  const [signalsAction, setSignalsAction] = useState('');
  const [signalsJobId, setSignalsJobId] = useState<string | null>(null);
  const [decisionInsight, setDecisionInsight] = useState<CompanyDecisionInsight | null>(null);
  const [decisionLoading, setDecisionLoading] = useState(false);
  const [decisionError, setDecisionError] = useState<string | null>(null);
  const [decisionMode, setDecisionMode] = useState<'pe' | 'credit' | 'compliance'>('pe');
  const [decisionHistory, setDecisionHistory] = useState<CompanyDecisionInsightSnapshot[]>([]);
  const [decisionActionMsg, setDecisionActionMsg] = useState('');
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
      const [graph, advanced] = await Promise.all([
        api.getOwnershipGraph(identitet),
        api.getAdvancedOwnershipInsights(identitet).catch(() => null),
      ]);
      setOwnershipGraph(graph as Record<string, unknown>);
      setOwnershipAdvanced((advanced as Record<string, unknown> | null) ?? null);
    } catch (e) {
      setOwnershipGraph(null);
      setOwnershipAdvanced(null);
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
        const fallback = sessionStorage.getItem(lookupCacheKey);
        if (fallback) {
          try {
            setLookupResult(JSON.parse(fallback) as Record<string, unknown>);
          } catch {
            setLookupResult(null);
          }
        } else {
          setLookupResult(null);
        }
      })
      .finally(() => setLookupLoading(false));
  }, [org]);

  useEffect(() => {
    if (!org || !signalsJobId) return;
    let cancelled = false;
    const timer = setInterval(() => {
      void api
        .getCompanySignalsJobStatus(org, signalsJobId)
        .then((s) => {
          if (cancelled) return;
          setSignalsAction(`Signal job ${s.id}: ${s.state}`);
          if (s.state === 'completed') {
            setSignalsJobId(null);
            setSignalsLoading(true);
            void api
              .getCompanySignals(org)
              .then((r) => setSignals(r))
              .catch(() => undefined)
              .finally(() => setSignalsLoading(false));
          }
          if (s.state === 'failed') {
            setSignalsJobId(null);
          }
        })
        .catch(() => undefined);
    }, 2000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [org, signalsJobId]);

  useEffect(() => {
    if (!org || org.length < 10) return;
    void loadEndpoints(org);
    void loadServing(org);
    void loadOwnership(org);
  }, [org, loadEndpoints, loadServing, loadOwnership]);

  useEffect(() => {
    if (!org || org.length < 10) return;
    let cancelled = false;
    setSimilarLoading(true);
    setSimilarError(null);
    void api
      .getSimilarCompanies(org, 12, similarMode)
      .then((r) => {
        if (!cancelled) setSimilar(r);
      })
      .catch((e: unknown) => {
        if (!cancelled) setSimilarError(e instanceof Error ? e.message : 'Similar companies unavailable');
      })
      .finally(() => {
        if (!cancelled) setSimilarLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [org, similarMode]);

  useEffect(() => {
    if (!org || org.length < 10) return;
    let cancelled = false;
    setSignalsLoading(true);
    setSignalsError(null);
    void api
      .getCompanySignals(org)
      .then((r) => {
        if (!cancelled) setSignals(r);
      })
      .catch((e: unknown) => {
        if (!cancelled) setSignalsError(e instanceof Error ? e.message : 'Signals unavailable');
      })
      .finally(() => {
        if (!cancelled) setSignalsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [org]);

  useEffect(() => {
    if (!org || org.length < 10) return;
    let cancelled = false;
    setDecisionLoading(true);
    setDecisionError(null);
    void api
      .getCompanyDecisionInsight(org, decisionMode)
      .then(async (r) => {
        if (cancelled) return;
        setDecisionInsight(r);
        const hist = await api.getCompanyDecisionInsightHistory(org, decisionMode, 8).catch(() => []);
        if (!cancelled) setDecisionHistory(hist);
      })
      .catch((e: unknown) => {
        if (!cancelled) setDecisionError(e instanceof Error ? e.message : 'Decision insight unavailable');
      })
      .finally(() => {
        if (!cancelled) setDecisionLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [org, decisionMode]);

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

  const providerRows = metadata.provider_fetch_diagnostics;
  const hvdFetchDiag = pickProviderDiag(providerRows, 'hvd.organisationer');
  const fiFetchDiag = pickProviderDiag(providerRows, 'fi.organisationer');
  const vhFetchDiag = pickProviderDiag(providerRows, 'vh.verkligaHuvudman');
  const truthy = (v: unknown) => v === true || v === 'true';
  const hasHvdHint =
    hvdFetchDiag?.status === 'loaded' ||
    hvdFetchDiag?.status === 'partial' ||
    truthy(metadata.has_hvd_data) ||
    hvdOrg.ok;
  const hasFiHint =
    fiFetchDiag?.status === 'loaded' ||
    fiFetchDiag?.status === 'partial' ||
    truthy(metadata.has_foretagsinfo_data);
  const hasReadModelSlice =
    serving.overview != null ||
    serving.documents.length > 0 ||
    serving.reports.length > 0 ||
    serving.officers.length > 0 ||
    serving.cases.length > 0 ||
    serving.engagements.length > 0 ||
    serving.shareCapital != null;

  const hasPartialSignals =
    lookupResult != null ||
    Boolean(hasHvdHint) ||
    Boolean(hasFiHint) ||
    hasReadModelSlice ||
    hvdDocs.ok;

  const lookupIsBlocking = Boolean(lookupError) && !hasPartialSignals;
  const lookupIsDegraded = Boolean(lookupError) && hasPartialSignals;
  const readModelIsBlocking = Boolean(servingMeta.error) && !hasPartialSignals;
  const readModelIsDegraded = Boolean(servingMeta.error) && hasPartialSignals;
  const dualGapIsBlocking = !hasDualApiCoverage && !hasPartialSignals;
  const dualGapIsDegraded = !hasDualApiCoverage && hasPartialSignals;

  const bundleDiag = serving.diagnostics as CompanyServingBundleDiagnostics | undefined;

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
              const lookupCacheKey = `${LOOKUP_CACHE_PREFIX}${org}`;
              void api
                .lookupCompany(org, true)
                .then((r) => {
                  const payload = r as Record<string, unknown>;
                  setLookupResult(payload);
                  sessionStorage.setItem(lookupCacheKey, JSON.stringify(payload));
                })
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

      {tab === 'signals' ? (
        <>
      <SectionCard title="Similar companies (tenant index)">
        <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <p className="text-xs text-muted-foreground">
            Compare peers using only rows stored for your tenant. Modes: legal form, activity text overlap, FI report-stub
            counts, or officer roster size.
          </p>
          <Select
            className="max-w-xs border-2 border-foreground bg-background px-2 py-1 font-mono text-[10px]"
            value={similarMode}
            onChange={(e) => setSimilarMode(e.target.value as SimilarCompaniesMode)}
          >
            <option value="form">Legal form</option>
            <option value="industry">Industry / activity text</option>
            <option value="financial">Financial metadata</option>
            <option value="ownership">Ownership / officers</option>
          </Select>
        </div>
        {similarLoading ? <LoadingSkeleton lines={4} /> : null}
        {!similarLoading && similarError ? <ErrorState title="Similar list" message={similarError} /> : null}
        {!similarLoading && !similarError && similar ? (
          <div className="space-y-3 text-sm">
            {similar.strategy === 'invalid_org' ? (
              <p className="text-muted-foreground">Organisation number in the URL is not valid for this query.</p>
            ) : null}
            {similar.strategy === 'not_indexed' ? (
              <p className="text-muted-foreground">
                This organisation is not stored in your tenant index yet. Run a lookup, then open the workspace again to see peers.
              </p>
            ) : null}
            {similar.strategy === 'no_company_form' ? (
              <p className="text-muted-foreground">No company form is stored on the index row — switch to another mode or enrich the index.</p>
            ) : null}
            {similar.strategy === 'no_industry_text' ? (
              <p className="text-muted-foreground">No usable verksamhetsbeskrivning on the index row for overlap search.</p>
            ) : null}
            {similar.strategy === 'no_financial_reports' ? (
              <p className="text-muted-foreground">Anchor has no financial report rows in JSON — cannot rank by FI stub count.</p>
            ) : null}
            {similar.strategy === 'no_officers' ? (
              <p className="text-muted-foreground">Anchor has no officer rows in JSON — cannot rank by roster size.</p>
            ) : null}
            {similar.strategy === 'same_company_form' ? (
              <p className="text-muted-foreground">
                Matched on <span className="font-mono text-foreground">{similar.companyForm}</span> — {similar.total} in index
                (showing {similar.data.length}).
              </p>
            ) : null}
            {similar.strategy === 'industry_narrative_overlap' ? (
              <p className="text-muted-foreground">
                Overlap on description snippet
                {similar.industrySnippet ? (
                  <>
                    : <span className="font-mono text-foreground">{similar.industrySnippet}</span> — {similar.total} hits
                    (showing {similar.data.length}).
                  </>
                ) : (
                  '.'
                )}
              </p>
            ) : null}
            {similar.strategy === 'financial_report_count_proximity' ? (
              <p className="text-muted-foreground">
                Closest <span className="font-mono text-foreground">jsonb_array_length(financial_reports)</span> to anchor (
                {similar.anchorFinancialReportsCount ?? '—'}) — {similar.total} candidates (showing {similar.data.length}).
              </p>
            ) : null}
            {similar.strategy === 'officer_count_proximity' ? (
              <p className="text-muted-foreground">
                Closest officer count to anchor ({similar.anchorOfficersCount ?? '—'}) — {similar.total} candidates (showing{' '}
                {similar.data.length}).
              </p>
            ) : null}
            {similar.data.length > 0 ? (
              <Table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Org</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {similar.data.map((row) => {
                    const hrefOrg = normalizeIdentitetsbeteckning(row.organisationNumber);
                    return (
                      <tr key={row.id}>
                        <td>{row.legalName}</td>
                        <td className="font-mono text-xs">{row.organisationNumber}</td>
                        <td>
                          <Link href={`/companies/workspace/${hrefOrg}`} className="underline underline-offset-4">
                            Workspace
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            ) : null}
            {similar.strategy === 'same_company_form' && similar.data.length === 0 ? (
              <p className="text-muted-foreground">No other companies share this form in your index.</p>
            ) : null}
          </div>
        ) : null}
      </SectionCard>

      <SectionCard title="Decision signals (Phase 5)">
        <p className="mb-3 text-xs text-muted-foreground">
          Scores are computed asynchronously from the tenant index row and versioned in{' '}
          <span className="font-mono text-foreground">company_signals</span>. Use recompute after a fresh lookup.
        </p>
        <div className="mb-3 flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            className="min-h-9 text-[10px]"
            onClick={() => {
              setSignalsAction('');
              void api
                .recomputeCompanySignals(org)
                .then((r) => {
                  setSignalsJobId(r.job_id);
                  setSignalsAction(`Queued job ${r.job_id}`);
                })
                .catch((e: unknown) => setSignalsAction(e instanceof Error ? e.message : 'Enqueue failed'));
            }}
          >
            Recompute (async)
          </Button>
          {signalsAction ? <p className="text-xs text-muted-foreground">{signalsAction}</p> : null}
        </div>
        {signalsLoading ? <LoadingSkeleton lines={6} /> : null}
        {!signalsLoading && signalsError ? <ErrorState title="Signals" message={signalsError} /> : null}
        {!signalsLoading && !signalsError && signals ? (
          <div className="space-y-4 text-sm">
            <p className="mono-label text-[10px] text-muted-foreground">
              Engine catalog {signals.engine_catalog_version}
            </p>
            {signals.data.map((row) => {
              const drivers = Array.isArray(row.explanation?.drivers) ? row.explanation!.drivers! : [];
              return (
                <article key={row.signal_type} className="border border-border-light p-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h4 className="font-medium">{row.signal_type.replace(/_/g, ' ')}</h4>
                    <span className="font-mono text-xs">
                      score: {row.score != null && Number.isFinite(row.score) ? row.score.toFixed(1) : '—'}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{row.definition}</p>
                  {drivers.length > 0 ? (
                    <ul className="mt-2 list-inside list-disc space-y-1 text-xs text-muted-foreground">
                      {drivers.map((d, i) => (
                        <li key={`${row.signal_type}-${i}`}>
                          <span className="font-mono text-foreground">{d.key}</span>
                          {d.weight ? ` (${d.weight})` : ''}: {String(d.value ?? d.detail ?? '—')}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    {row.computed_at ? `Computed ${new Date(row.computed_at).toLocaleString()}` : 'Not computed yet — run recompute.'}
                  </p>
                </article>
              );
            })}
          </div>
        ) : null}
      </SectionCard>

      <SectionCard title="Decision insight (Phase 9)">
        <p className="mb-3 text-xs text-muted-foreground">
          Why this company matters now, based on the latest tenant-scoped signals, ownership topology, and financial evidence.
        </p>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Select
            className="max-w-xs border-2 border-foreground bg-background px-2 py-1 font-mono text-[10px]"
            value={decisionMode}
            onChange={(e) => setDecisionMode(e.target.value as 'pe' | 'credit' | 'compliance')}
          >
            <option value="pe">PE mode</option>
            <option value="credit">Credit mode</option>
            <option value="compliance">Compliance mode</option>
          </Select>
          <Button
            type="button"
            variant="secondary"
            className="min-h-9 text-[10px]"
            onClick={() => {
              setDecisionActionMsg('');
              void api
                .captureCompanyDecisionSnapshots(org)
                .then(() => {
                  setDecisionActionMsg('Snapshot captured for all decision modes.');
                  return api.getCompanyDecisionInsightHistory(org, decisionMode, 8);
                })
                .then((hist) => setDecisionHistory(hist))
                .catch((e: unknown) => setDecisionActionMsg(e instanceof Error ? e.message : 'Snapshot capture failed'));
            }}
          >
            Capture snapshot
          </Button>
          {decisionActionMsg ? <p className="text-xs text-muted-foreground">{decisionActionMsg}</p> : null}
        </div>
        {decisionLoading ? <LoadingSkeleton lines={4} /> : null}
        {!decisionLoading && decisionError ? <ErrorState title="Decision insight" message={decisionError} /> : null}
        {!decisionLoading && !decisionError && decisionInsight ? (
          <div className="space-y-3 text-sm">
            <p>{decisionInsight.summary}</p>
            <p className="text-xs text-muted-foreground">
              Mode: <span className="font-mono text-foreground">{decisionInsight.strategy_mode}</span> |{' '}
              Recommended action: <span className="font-mono text-foreground">{decisionInsight.recommended_action}</span> | confidence:{' '}
              <span className="font-mono text-foreground">{decisionInsight.confidence}</span>
            </p>
            <ul className="list-inside list-disc space-y-1 text-xs text-muted-foreground">
              {decisionInsight.drivers.map((d) => (
                <li key={d.key}>
                  <span className="font-mono text-foreground">{d.key}</span>: {String(d.value ?? '—')} — {d.meaning}
                  {d.source ? (
                    <>
                      {' '}
                      [src: <span className="font-mono text-foreground">{d.source.table}</span>
                      {d.source.id ? `:${d.source.id}` : ''}{d.source.pointer ? ` @ ${d.source.pointer}` : ''}]
                    </>
                  ) : null}
                </li>
              ))}
            </ul>
            {decisionHistory.length > 0 ? (
              <div className="space-y-2">
                <p className="mono-label text-[10px] text-muted-foreground">Decision drift history ({decisionMode})</p>
                <Table>
                  <thead>
                    <tr>
                      <th>Captured</th>
                      <th>Recommended action</th>
                      <th>Confidence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {decisionHistory.map((h) => (
                      <tr key={h.id}>
                        <td className="text-xs">{new Date(h.created_at).toLocaleString()}</td>
                        <td>{h.recommended_action}</td>
                        <td className="font-mono text-xs">{h.confidence}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            ) : null}
          </div>
        ) : null}
      </SectionCard>
        </>
      ) : null}

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
        <ProviderStatusCard
          title="Värdefulla datamängder (HVD)"
          statusLine={
            hvdFetchDiag?.status === 'loaded'
              ? 'Loaded'
              : hvdFetchDiag?.status === 'partial'
                ? 'Partial'
                : hvdFetchDiag?.status === 'error'
                  ? 'Unavailable'
                  : truthy(metadata.has_hvd_data) || hvdOrg.ok
                    ? 'Available (live or index)'
                    : 'Unavailable'
          }
          detail={
            hvdFetchDiag?.message
              ? `${hvdFetchDiag.organisation_number ? `Org ${hvdFetchDiag.organisation_number} · ` : ''}${hvdFetchDiag.message}`
              : undefined
          }
        />
        <ProviderStatusCard
          title="Företagsinformation v4"
          statusLine={
            fiFetchDiag?.status === 'loaded'
              ? 'Loaded'
              : fiFetchDiag?.status === 'partial'
                ? 'Partial'
                : fiFetchDiag?.status === 'error'
                  ? 'Unavailable'
                  : truthy(metadata.has_foretagsinfo_data)
                    ? 'Available (index)'
                    : 'Unavailable'
          }
          detail={
            fiFetchDiag?.message
              ? `${fiFetchDiag.organisation_number ? `Org ${fiFetchDiag.organisation_number} · ` : ''}${fiFetchDiag.message}`
              : undefined
          }
        />
        <ProviderStatusCard
          title="Verkliga huvudmän (register)"
          statusLine={
            vhFetchDiag?.status === 'skipped'
              ? 'Not live yet / disabled'
              : vhFetchDiag?.status === 'loaded'
                ? 'Loaded'
                : vhFetchDiag?.status === 'error'
                  ? 'Unavailable'
                  : truthy(metadata.has_verkliga_huvudman_data)
                    ? 'Available'
                    : 'Not live yet or no row'
          }
          detail={
            vhFetchDiag?.message
              ? `${vhFetchDiag.organisation_number ? `Org ${vhFetchDiag.organisation_number} · ` : ''}${vhFetchDiag.message}`
              : undefined
          }
        />
      </div>

      {lookupIsBlocking ? <ErrorState title="Lookup unavailable" message={lookupError ?? ''} /> : null}
      {lookupIsDegraded ? (
        <WorkspaceCallout
          tone="warn"
          title="Lookup request failed — showing cached or live data"
          message={`${lookupError ?? ''} You can still use HVD live calls, read-model slices, and annual reports when those sources succeed.`}
        />
      ) : null}
      {readModelIsBlocking ? <ErrorState title="Read model unavailable" message={servingMeta.error ?? ''} /> : null}
      {readModelIsDegraded ? (
        <WorkspaceCallout
          tone="warn"
          title="Read-model bundle request had issues"
          message={`${servingMeta.error ?? ''} Other sections above may still show rows returned before the error.`}
        />
      ) : null}
      {dualGapIsBlocking ? (
        <ErrorState
          title="Partial provider coverage"
          message="This lookup did not return full dual-API coverage for the organisation number. Trigger Force refresh to re-run HVD + Företagsinformation and complete the profile."
        />
      ) : null}
      {dualGapIsDegraded ? (
        <WorkspaceCallout
          tone="info"
          title="Partial provider coverage"
          message="HVD and Företagsinformation v4 were not both fully populated for this org. The workspace still shows whatever succeeded (including annual reports under Financials). Use Force refresh to retry missing providers."
        />
      ) : null}

      <details className="border border-border-light p-3">
        <summary className="cursor-pointer mono-label text-[10px] text-muted-foreground">
          Retrieval timeline & debug
        </summary>
        <div className="mt-3 space-y-2 font-mono text-[11px] leading-relaxed text-muted-foreground">
          <p>
            Lookup metadata fetched_at: {formatIsoShort(metadata.fetched_at != null ? String(metadata.fetched_at) : undefined)}
          </p>
          <p>Snapshot fetch status: {String(metadata.snapshot_fetch_status ?? '—')}</p>
          <p>
            Read-model bundle: requested {formatIsoShort(bundleDiag?.requested_at)} → finished{' '}
            {formatIsoShort(bundleDiag?.finished_at)}
          </p>
          {bundleDiag?.sections
            ? Object.entries(bundleDiag.sections).map(([k, s]) => (
                <p key={k}>
                  {k}: {s.status}
                  {s.error ? ` — ${s.error}` : ''} ({formatIsoShort(s.started_at)} → {formatIsoShort(s.finished_at)})
                </p>
              ))
            : null}
        </div>
      </details>

      <BolagsverketBulkFileIngestionPanel variant="workspace" />

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
        <TabButton active={tab === 'financials'} onClick={() => setTab('financials')}>
          Financials
        </TabButton>
        <TabButton active={tab === 'signals'} onClick={() => setTab('signals')}>
          Signals
        </TabButton>
        <TabButton active={tab === 'documents'} onClick={() => setTab('documents')}>
          Documents
        </TabButton>
        <TabButton active={tab === 'compare'} onClick={() => setTab('compare')}>
          Compare
        </TabButton>
      </div>

      <details className="border border-border-light p-3">
        <summary className="cursor-pointer mono-label text-[10px] text-muted-foreground">Source-specific tabs</summary>
        <div className="mt-3 flex flex-wrap gap-2">
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
      </details>

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

              <SectionCard title="Ownership graph map (visual)">
                {(() => {
                  const paths = Array.isArray(ownershipGraph?.controlPaths)
                    ? (ownershipGraph.controlPaths as Array<Record<string, unknown>>)
                    : [];
                  if (paths.length === 0) {
                    return <p className="text-sm text-muted-foreground">No control paths available to draw yet.</p>;
                  }
                  const first = paths.slice(0, 10);
                  const nodeSet = new Set<string>([org]);
                  const edges: Array<{ from: string; to: string; riskTier: 'low' | 'medium' | 'high'; label: string }> = [];
                  const advFlags = Array.isArray((ownershipAdvanced as Record<string, unknown> | null)?.suspiciousPathFlags)
                    ? (((ownershipAdvanced as Record<string, unknown>).suspiciousPathFlags as Array<Record<string, unknown>>) ?? [])
                    : [];
                  const riskByCode = new Map<string, 'low' | 'medium' | 'high'>();
                  for (const f of advFlags) {
                    const code = String(f.code ?? '').trim();
                    if (!code) continue;
                    const tierRaw = String(f.riskTier ?? '').toLowerCase();
                    const tier: 'low' | 'medium' | 'high' =
                      tierRaw === 'critical' || tierRaw === 'high'
                        ? 'high'
                        : tierRaw === 'medium' || tierRaw === 'elevated'
                          ? 'medium'
                          : 'low';
                    riskByCode.set(code, tier);
                  }
                  for (const p of first) {
                    const summary = String(p.summary ?? '');
                    const code = String(p.code ?? '');
                    const pathRisk: 'low' | 'medium' | 'high' =
                      riskByCode.get(code) ??
                      (summary.toLowerCase().includes('unknown') || summary.toLowerCase().includes('opaque') ? 'high' : 'low');
                    const ownershipPct =
                      p.cumulativeOwnershipPercentage != null && Number.isFinite(Number(p.cumulativeOwnershipPercentage))
                        ? `${Number(p.cumulativeOwnershipPercentage).toFixed(1)}%`
                        : null;
                    const pieces = summary
                      .split('->')
                      .map((x) => normalizeIdentitetsbeteckning(x) || x.trim())
                      .filter(Boolean)
                      .slice(0, 6);
                    for (let i = 0; i < pieces.length; i += 1) nodeSet.add(pieces[i]);
                    for (let i = 0; i < pieces.length - 1; i += 1) {
                      edges.push({
                        from: pieces[i],
                        to: pieces[i + 1],
                        riskTier: pathRisk,
                        label: ownershipPct ?? `${i + 1}/${Math.max(1, pieces.length - 1)}`,
                      });
                    }
                  }
                  const nodes = [...nodeSet].slice(0, 24);
                  const cx = 360;
                  const cy = 170;
                  const radius = 120;
                  const positions = new Map<string, { x: number; y: number }>();
                  const riskStroke: Record<'low' | 'medium' | 'high', string> = {
                    low: '#0f766e',
                    medium: '#b45309',
                    high: '#b91c1c',
                  };
                  nodes.forEach((id, idx) => {
                    if (id === org) {
                      positions.set(id, { x: cx, y: cy });
                      return;
                    }
                    const angle = (idx / Math.max(1, nodes.length - 1)) * Math.PI * 2;
                    positions.set(id, {
                      x: cx + Math.cos(angle) * radius,
                      y: cy + Math.sin(angle) * radius,
                    });
                  });
                  return (
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-3 text-[10px]">
                        <span className="mono-label text-muted-foreground">Risk color</span>
                        <span className="inline-flex items-center gap-1">
                          <span className="h-2 w-4" style={{ backgroundColor: riskStroke.low }} />
                          Low
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <span className="h-2 w-4" style={{ backgroundColor: riskStroke.medium }} />
                          Medium
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <span className="h-2 w-4" style={{ backgroundColor: riskStroke.high }} />
                          High
                        </span>
                        <span className="text-muted-foreground">Edges show direction + ownership weight.</span>
                      </div>
                    <svg viewBox="0 0 720 340" className="w-full border border-border-light bg-muted/20">
                      <defs>
                        <marker id="arrow-low" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
                          <path d="M0,0 L8,4 L0,8 z" fill={riskStroke.low} />
                        </marker>
                        <marker id="arrow-medium" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
                          <path d="M0,0 L8,4 L0,8 z" fill={riskStroke.medium} />
                        </marker>
                        <marker id="arrow-high" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
                          <path d="M0,0 L8,4 L0,8 z" fill={riskStroke.high} />
                        </marker>
                      </defs>
                      {edges.map((e, idx) => {
                        const a = positions.get(e.from);
                        const b = positions.get(e.to);
                        if (!a || !b) return null;
                        const mx = (a.x + b.x) / 2;
                        const my = (a.y + b.y) / 2;
                        return (
                          <g key={`${e.from}-${e.to}-${idx}`}>
                            <line
                              x1={a.x}
                              y1={a.y}
                              x2={b.x}
                              y2={b.y}
                              stroke={riskStroke[e.riskTier]}
                              strokeWidth={e.riskTier === 'high' ? 2 : 1.5}
                              strokeOpacity="0.7"
                              markerEnd={`url(#arrow-${e.riskTier})`}
                            />
                            <rect x={mx - 16} y={my - 8} width="32" height="12" fill="white" fillOpacity="0.9" />
                            <text x={mx} y={my + 1} textAnchor="middle" className="fill-current text-[8px]">
                              {e.label}
                            </text>
                          </g>
                        );
                      })}
                      {nodes.map((id) => {
                        const p = positions.get(id);
                        if (!p) return null;
                        const focus = id === org;
                        return (
                          <g key={id}>
                            <circle cx={p.x} cy={p.y} r={focus ? 8 : 5} fill="currentColor" />
                            <text x={p.x + 8} y={p.y - 8} className="fill-current text-[9px]">
                              {id}
                            </text>
                          </g>
                        );
                      })}
                    </svg>
                    </div>
                  );
                })()}
              </SectionCard>

              <SectionCard title="Data coverage">
                <dl className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <dt className="mono-label text-[10px] text-muted-foreground">Ownership links</dt>
                    <dd title="Yes = ownership edges exist in the dataset. No = no ownership-link rows found.">
                      {boolWord((ownershipGraph?.dataCoverage as Record<string, unknown> | undefined)?.hasOwnershipLinks ?? false)}
                    </dd>
                  </div>
                  <div>
                    <dt className="mono-label text-[10px] text-muted-foreground">Declared beneficial owners</dt>
                    <dd title="Yes = one or more declared beneficial-owner rows exist.">
                      {boolWord(
                        (ownershipGraph?.dataCoverage as Record<string, unknown> | undefined)?.hasBeneficialOwnerRows ?? false,
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="mono-label text-[10px] text-muted-foreground">VH register snapshot</dt>
                    <dd title="Yes = a Bolagsverket VH snapshot is stored for this org.">
                      {boolWord(
                        (ownershipGraph?.dataCoverage as Record<string, unknown> | undefined)?.hasVerkligaHuvudmanSnapshot ??
                          false,
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="mono-label text-[10px] text-muted-foreground">Opacity risk</dt>
                    <dd
                      className="uppercase"
                      title="High = structure likely contains opaque or unresolved control paths."
                    >
                      {riskWord((ownershipGraph?.dataCoverage as Record<string, unknown> | undefined)?.opaqueOwnershipRisk ?? '—')}
                    </dd>
                  </div>
                </dl>
              </SectionCard>

              <SectionCard title="Advanced ownership intelligence (Phase 11)">
                <p className="mb-3 text-sm text-muted-foreground">
                  Analyst-priority anomalies and suspicious path flags are ranked by risk tiers, with optional async precompute
                  on high-traffic companies.
                </p>
                <details className="mb-3 border border-border-light p-3 text-xs">
                  <summary className="cursor-pointer font-mono uppercase tracking-widest text-[10px]">
                    How to read priority / tier / anomaly / count / severity
                  </summary>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
                    <li><strong>Priority</strong>: analyst order (lower number = review first).</li>
                    <li><strong>Tier</strong>: model risk bucket (low/medium/high).</li>
                    <li><strong>Anomaly</strong>: exact detected pattern code.</li>
                    <li><strong>Count</strong>: number of times the pattern appears in this graph.</li>
                    <li><strong>Severity</strong>: technical impact estimate for that anomaly.</li>
                  </ul>
                </details>
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    className="min-h-9 text-[10px]"
                    onClick={() => {
                      setOwnershipAdvancedAction('');
                      void api
                        .precomputeAdvancedOwnershipInsights(org)
                        .then((r) => {
                          const queued = Boolean((r as Record<string, unknown>).queued);
                          setOwnershipAdvancedAction(queued ? 'Advanced precompute queued.' : 'Advanced precompute skipped.');
                        })
                        .catch((e: unknown) =>
                          setOwnershipAdvancedAction(e instanceof Error ? e.message : 'Failed to queue precompute'),
                        );
                    }}
                  >
                    Queue precompute
                  </Button>
                  {ownershipAdvancedAction ? <p className="text-xs text-muted-foreground">{ownershipAdvancedAction}</p> : null}
                </div>
                {(() => {
                  const adv = ownershipAdvanced;
                  if (!adv) return <p className="text-sm text-muted-foreground">Advanced insights not available yet.</p>;
                  const anomalies = Array.isArray(adv.anomalies) ? (adv.anomalies as Array<Record<string, unknown>>) : [];
                  const flags = Array.isArray(adv.suspiciousPathFlags)
                    ? (adv.suspiciousPathFlags as Array<Record<string, unknown>>)
                    : [];
                  return (
                    <div className="space-y-4">
                      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                        <div className="border border-border-light p-2 text-xs">
                          <p className="mono-label text-[10px] text-muted-foreground">Nodes</p>
                          <p className="mt-1 text-sm">{String((adv.network as Record<string, unknown> | undefined)?.nodes ?? 0)}</p>
                        </div>
                        <div className="border border-border-light p-2 text-xs">
                          <p className="mono-label text-[10px] text-muted-foreground">Edges</p>
                          <p className="mt-1 text-sm">{String((adv.network as Record<string, unknown> | undefined)?.edges ?? 0)}</p>
                        </div>
                        <div className="border border-border-light p-2 text-xs">
                          <p className="mono-label text-[10px] text-muted-foreground">Potential cycle nodes</p>
                          <p className="mt-1 text-sm">
                            {String((adv.network as Record<string, unknown> | undefined)?.potentialCycleNodes ?? 0)}
                          </p>
                        </div>
                        <div className="border border-border-light p-2 text-xs">
                          <p className="mono-label text-[10px] text-muted-foreground">Cache</p>
                          <p className="mt-1 text-sm" title="Hit = reused cached advanced graph; Miss = recomputed from source rows.">
                            {((adv.cache as Record<string, unknown> | undefined)?.hit ?? false) ? 'Hit' : 'Miss'}
                          </p>
                        </div>
                      </div>
                      <Table>
                        <thead>
                          <tr>
                            <th>Priority</th>
                            <th>Tier</th>
                            <th>Anomaly</th>
                            <th>Count</th>
                            <th>Severity</th>
                          </tr>
                        </thead>
                        <tbody>
                          {anomalies.map((a, idx) => (
                            <tr key={`${String(a.code ?? idx)}-${idx}`}>
                              <td className="font-mono text-xs" title="Analyst order; lower = investigate earlier.">
                                {String(a.analystPriority ?? '—')}
                              </td>
                              <td
                                className="font-mono text-xs"
                                title="Risk tier from model; high means likely stronger ownership-risk signal."
                              >
                                {riskWord(a.riskTier ?? '—')}
                              </td>
                              <td title={anomalyExplanation(String(a.code ?? ''))}>{String(a.code ?? '—')}</td>
                              <td title="Occurrences of this anomaly in the graph.">{String(a.count ?? '—')}</td>
                              <td title="Technical severity score label for this anomaly.">
                                {riskWord(a.severity ?? '—')}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </Table>
                      <div>
                        <p className="mono-label mb-2 text-[10px] text-muted-foreground">Suspicious path flags</p>
                        {flags.length === 0 ? (
                          <p className="text-sm text-muted-foreground">No suspicious paths flagged from current evidence.</p>
                        ) : (
                          <ul className="space-y-2 text-sm">
                            {flags.map((f, idx) => (
                              <li key={`${String(f.code ?? idx)}-${idx}`} className="border border-border-light p-2">
                                <p className="font-medium">
                                  {String(f.code ?? 'flag')} ·{' '}
                                  <span className="font-mono text-xs">{riskWord(f.riskTier ?? '—')}</span>
                                </p>
                                <p className="text-xs text-muted-foreground">{String(f.reason ?? '—')}</p>
                                {f.summary ? <p className="mt-1 text-xs">{String(f.summary)}</p> : null}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  );
                })()}
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
                              <td title="Yes = listed in stored VH register snapshot.">
                                {boolWord(row.registerListed ?? false)}
                              </td>
                              <td title="Yes = ownership-chain model derived this person at or above threshold.">
                                {boolWord(row.shareChainDerivedMeetsThreshold ?? false)}
                              </td>
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

      {tab === 'reports' || tab === 'documents' ? (
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

      {tab === 'financials' ? (
        <WorkspaceCallout
          tone="info"
          title="Two separate financial sources"
          message="Årsredovisning below uses GET /annual-reports/companies/…/financial-comparison and …/workspace-read-model (parsed iXBRL from HVD ZIPs stored in your tenant). It does not call Företagsinformation v4. The FI finansiella rapporter table under it reads only bv_read.company_fi_reports_current from Bolagsverket FI — that block can stay empty while annual-report tables and HVD document downloads still work."
        />
      ) : null}

      {tab === 'annualParsed' || tab === 'financials' ? (
        <Panel title="Årsredovisning — extraherade nyckeltal (iXBRL)" badge="annual_report_xbrl + serving">
          <AnnualReportsWorkspacePanel orgNumber={org} />
        </Panel>
      ) : null}

      {tab === 'fiReports' || tab === 'financials' ? (
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

      {tab === 'compare' ? (
        <Panel title="Compare workspace handoff" badge="phase 2">
          <p className="mb-3 text-sm text-muted-foreground">
            Build a fast side-by-side shortlist using this company plus selected similar peers.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button href={`/compare?orgs=${encodeURIComponent(org)}`} variant="secondary" className="min-h-10 text-[10px]">
              Open compare with this company
            </Button>
            {similar?.data?.[0] ? (
              <Button
                href={`/compare?orgs=${encodeURIComponent(
                  [org, ...similar.data.slice(0, 3).map((r) => normalizeIdentitetsbeteckning(r.organisationNumber))].join(','),
                )}`}
                variant="secondary"
                className="min-h-10 text-[10px]"
              >
                Compare with top similar peers
              </Button>
            ) : null}
          </div>
        </Panel>
      ) : null}

      {tab === 'vhRegister' ? <VerkligaHuvudmanRegisterPanel row={serving.verkligaHuvudman} /> : null}
    </section>
  );
}

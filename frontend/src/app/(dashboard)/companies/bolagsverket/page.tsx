'use client';

import { useState, useCallback } from 'react';
import { api } from '@/lib/api';
import type { BvDokument } from '@/lib/api';
import {
  classifyIdentifier,
  validateIdentifier,
  identifierError,
  IDENTIFIER_TYPE_LABELS,
  normaliseIdentifier,
} from '@/utils/validation/validateIdentifier';

interface OfficerRow {
  namn?: string | null;
  personId?: string | null;
  roller?: Array<{ rollbeskrivning?: string }>;
  fodelseAr?: string | null;
  nationalitet?: string | null;
}

interface FinancialReport {
  rapportTypKlartext?: string;
  period?: string;
  status?: { klartext?: string };
}

interface AddressRow {
  adresstyp?: string | null;
  utdelningsadress?: string | null;
  gatuadress?: string | null;
  postnummer?: string | null;
  postort?: string | null;
  land?: string | null;
}

interface FieldError {
  field: string;
  errorType: string;
}

interface NormalisedData {
  organisationNumber?: string;
  legalName?: string;
  companyForm?: string | null;
  status?: string | null;
  registeredAt?: string | null;
  deregisteredAt?: string | null;
  countryCode?: string | null;
  businessDescription?: string | null;
  signatoryText?: string | null;
  industryCode?: string | null;
  officers?: OfficerRow[];
  financialReports?: FinancialReport[];
  addresses?: AddressRow[];
  allNames?: Array<{ namn?: string; namnTyp?: string }>;
  permits?: Array<Record<string, unknown>>;
  fieldErrors?: FieldError[];
  sourcePayloadSummary?: {
    hasHighValueDataset?: boolean;
    hasRichOrganisationInformation?: boolean;
    partialDataFields?: string[];
    historicalRecords?: unknown[];
  };
}

interface SnapshotRow {
  id: string;
  fetchedAt: string;
  fetchStatus: string;
  isFromCache: boolean;
  apiCallCount: number;
  ageInDays?: number | null;
}

interface EnrichResult {
  result?: {
    normalisedData?: NormalisedData;
    retrievedAt?: string;
  };
  snapshot?: SnapshotRow;
  isFromCache?: boolean;
  ageInDays?: number | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('sv-SE');
}

function formatDateTime(dateStr?: string | null): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleString('sv-SE');
}

function triggerBrowserDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── Page component ──────────────────────────────────────────────────────────

export default function BolagsverketPage() {
  const [identifier, setIdentifier] = useState('');
  const [touched, setTouched] = useState(false);
  const [forceRefresh, setForceRefresh] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enrichResult, setEnrichResult] = useState<EnrichResult | null>(null);
  const [snapshots, setSnapshots] = useState<SnapshotRow[]>([]);
  const [documents, setDocuments] = useState<BvDokument[]>([]);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const isValid = validateIdentifier(identifier);
  const identifierType = classifyIdentifier(identifier);
  const validationError = touched ? identifierError(identifier) : null;

  const handleSearch = useCallback(async () => {
    setTouched(true);
    if (!identifier.trim() || !isValid) return;
    setLoading(true);
    setError(null);
    setEnrichResult(null);
    setSnapshots([]);
    setDocuments([]);

    try {
      const stripped = normaliseIdentifier(identifier.trim());
      const isPerson = classifyIdentifier(stripped) === 'personnummer';

      let result: EnrichResult;
      if (isPerson) {
        result = await api.bolagsverket.enrichPerson({
          personnummer: stripped,
          forceRefresh,
        });
      } else {
        result = await api.bolagsverket.enrich({
          identitetsbeteckning: stripped,
          forceRefresh,
        });
      }
      setEnrichResult(result);

      // Load last 5 snapshots and document list in parallel (org numbers only)
      const tasks: Promise<void>[] = [
        api.bolagsverket.getSnapshots(stripped).then((data) => {
          setSnapshots(Array.isArray(data) ? data.slice(0, 5) : []);
        }),
      ];
      if (!isPerson) {
        tasks.push(
          api.bolagsverket.documentList(stripped).then((data) => {
            setDocuments(data?.dokument ?? []);
          }).catch(() => {
            // Document list is best-effort; don't block the rest of the page
          }),
        );
      }
      await Promise.all(tasks);
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : typeof err === 'object' && err !== null && 'response' in err
            ? String((err as { response?: { data?: unknown } }).response?.data ?? err)
            : String(err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [identifier, isValid, forceRefresh]);

  const handleDownload = useCallback(async (doc: BvDokument) => {
    if (!doc.dokumentId) return;
    setDownloadingId(doc.dokumentId);
    try {
      const { blob, fileName } = await api.bolagsverket.downloadDocument(doc.dokumentId);
      triggerBrowserDownload(blob, fileName);
    } catch {
      // silently ignore – user can retry
    } finally {
      setDownloadingId(null);
    }
  }, []);

  const normalisedData = enrichResult?.result?.normalisedData;
  const isFromCache = enrichResult?.isFromCache;
  const ageInDays = enrichResult?.ageInDays;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Bolagsverket Lookup</h1>
        <p className="mt-1 text-sm text-slate-400">
          Search by organisationsnummer (10-digit) or personnummer (12-digit). Data is cached for 30
          days.
        </p>
      </div>

      {/* Search form */}
      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label
              htmlFor="bv-identifier-input"
              className="mb-1 block text-xs uppercase tracking-widest text-slate-400"
            >
              Organisation / Person number
            </label>
            <input
              id="bv-identifier-input"
              type="text"
              value={identifier}
              onChange={(e) => { setIdentifier(e.target.value); }}
              onBlur={() => setTouched(true)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="5560000001  or  197001011234"
              autoComplete="off"
              spellCheck={false}
              className={[
                'w-full rounded-xl border bg-background px-4 py-2.5 text-sm text-white placeholder-slate-500 transition',
                'focus:outline-none focus:ring-2',
                validationError
                  ? 'border-red-500 focus:ring-red-500/50'
                  : isValid
                    ? 'border-emerald-500 focus:ring-emerald-500/50'
                    : 'border-border focus:ring-indigo-500',
              ].join(' ')}
            />
            {validationError && (
              <p className="mt-1.5 text-xs text-red-400">{validationError}</p>
            )}
            {!validationError && isValid && (
              <p className="mt-1.5 text-xs text-emerald-400">
                ✓ Valid {IDENTIFIER_TYPE_LABELS[identifierType]}
              </p>
            )}
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={forceRefresh}
              onChange={(e) => setForceRefresh(e.target.checked)}
              className="rounded"
            />
            Force Refresh
          </label>
          <button
            onClick={handleSearch}
            disabled={loading || !identifier.trim()}
            className="rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? 'Searching…' : 'Search'}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-red-700 bg-red-900/30 p-4 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Results */}
      {normalisedData && (
        <div className="space-y-6">
          {/* Freshness badge */}
          <div className="flex items-center gap-3">
            {isFromCache ? (
              <span className="rounded-full bg-emerald-800/60 px-3 py-1 text-xs font-medium text-emerald-300">
                ✓ From cache (age: {ageInDays} days)
              </span>
            ) : (
              <span className="rounded-full bg-blue-800/60 px-3 py-1 text-xs font-medium text-blue-300">
                ↻ Fresh from API
              </span>
            )}
            {enrichResult?.result?.retrievedAt && (
              <span className="text-xs text-slate-500">
                Retrieved: {new Date(enrichResult.result.retrievedAt).toLocaleString()}
              </span>
            )}
          </div>

          {/* Company profile */}
          <div className="rounded-2xl border border-border bg-card p-6">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-slate-400">
              Company Profile
            </h2>
            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <ProfileRow label="Organisation Number" value={normalisedData.organisationNumber} />
              <ProfileRow label="Legal Name" value={normalisedData.legalName} />
              <ProfileRow label="Company Form" value={normalisedData.companyForm} />
              <ProfileRow label="Status" value={normalisedData.status} />
              <ProfileRow
                label="Registered"
                value={
                  normalisedData.registeredAt
                    ? new Date(normalisedData.registeredAt).toLocaleDateString('sv-SE')
                    : null
                }
              />
              <ProfileRow
                label="Deregistered"
                value={
                  normalisedData.deregisteredAt
                    ? new Date(normalisedData.deregisteredAt).toLocaleDateString('sv-SE')
                    : null
                }
              />
              <ProfileRow label="Industry Code" value={normalisedData.industryCode} />
              <ProfileRow label="Country" value={normalisedData.countryCode} />
              <ProfileRow label="Business Description" value={normalisedData.businessDescription} />
              <ProfileRow label="Signatory" value={normalisedData.signatoryText} />
            </dl>
          </div>

          {/* Data quality warning */}
          {normalisedData.fieldErrors && normalisedData.fieldErrors.length > 0 && (
            <div className="rounded-2xl border border-yellow-700/50 bg-yellow-900/20 p-4">
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-widest text-yellow-400">
                ⚠ Partial Data — {normalisedData.fieldErrors.length} field error{normalisedData.fieldErrors.length !== 1 ? 's' : ''}
              </h2>
              <ul className="space-y-1">
                {normalisedData.fieldErrors.map((fe, i) => (
                  <li key={i} className="flex items-center gap-2 text-xs text-yellow-300">
                    <span className="rounded bg-yellow-800/60 px-1.5 py-0.5 font-mono">{fe.field}</span>
                    <span className="text-yellow-500">{fe.errorType}</span>
                  </li>
                ))}
              </ul>
              {normalisedData.sourcePayloadSummary?.partialDataFields &&
                normalisedData.sourcePayloadSummary.partialDataFields.length > 0 && (
                  <p className="mt-2 text-xs text-yellow-500">
                    Partial: {normalisedData.sourcePayloadSummary.partialDataFields.join(', ')}
                  </p>
                )}
            </div>
          )}

          {/* Addresses */}
          {normalisedData.addresses && normalisedData.addresses.length > 0 && (
            <div className="rounded-2xl border border-border bg-card p-6">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-slate-400">
                Addresses
              </h2>
              <div className="space-y-3">
                {normalisedData.addresses.map((a, i) => (
                  <div key={i} className="rounded-xl bg-slate-800/40 px-4 py-3 text-sm">
                    {a.adresstyp && (
                      <span className="mb-1 inline-block rounded bg-slate-700 px-1.5 py-0.5 text-xs text-slate-300">
                        {a.adresstyp}
                      </span>
                    )}
                    <p className="text-white">
                      {a.utdelningsadress ?? a.gatuadress ?? '—'}
                    </p>
                    <p className="text-slate-400">
                      {[a.postnummer, a.postort, a.land].filter(Boolean).join(', ') || '—'}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* All registered names */}
          {normalisedData.allNames && normalisedData.allNames.length > 0 && (
            <div className="rounded-2xl border border-border bg-card p-6">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-slate-400">
                Registered Names
              </h2>
              <ul className="space-y-1">
                {normalisedData.allNames.map((n, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm">
                    {n.namnTyp && (
                      <span className="rounded bg-slate-700 px-1.5 py-0.5 text-xs text-slate-400">
                        {n.namnTyp}
                      </span>
                    )}
                    <span className="text-white">{n.namn ?? '—'}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* HVD / data source badges */}
          {normalisedData.sourcePayloadSummary && (
            <div className="flex flex-wrap gap-2">
              {normalisedData.sourcePayloadSummary.hasHighValueDataset && (
                <span className="rounded-full bg-violet-800/50 px-3 py-1 text-xs font-medium text-violet-300">
                  ✓ High-Value Dataset
                </span>
              )}
              {normalisedData.sourcePayloadSummary.hasRichOrganisationInformation && (
                <span className="rounded-full bg-teal-800/50 px-3 py-1 text-xs font-medium text-teal-300">
                  ✓ Rich Organisation Information
                </span>
              )}
              {normalisedData.sourcePayloadSummary.historicalRecords &&
                normalisedData.sourcePayloadSummary.historicalRecords.length > 0 && (
                  <span className="rounded-full bg-slate-700/70 px-3 py-1 text-xs font-medium text-slate-300">
                    {normalisedData.sourcePayloadSummary.historicalRecords.length} historical record
                    {normalisedData.sourcePayloadSummary.historicalRecords.length !== 1 ? 's' : ''}
                  </span>
                )}
            </div>
          )}

          {/* Officers */}
          {normalisedData.officers && normalisedData.officers.length > 0 && (
            <div className="rounded-2xl border border-border bg-card p-6">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-slate-400">
                Officers
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs uppercase tracking-widest text-slate-500">
                      <th className="pb-2 pr-4">Name</th>
                      <th className="pb-2 pr-4">Role(s)</th>
                      <th className="pb-2 pr-4">Born</th>
                      <th className="pb-2">Nationality</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {normalisedData.officers.map((o, i) => (
                      <tr key={i} className="py-2">
                        <td className="py-2 pr-4 text-white">{o.namn ?? '—'}</td>
                        <td className="py-2 pr-4 text-slate-300">
                          {o.roller?.map((r) => r.rollbeskrivning).filter(Boolean).join(', ') || '—'}
                        </td>
                        <td className="py-2 pr-4 text-slate-400">{o.fodelseAr ?? '—'}</td>
                        <td className="py-2 text-slate-400">{o.nationalitet ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Annual reports from enrich + downloadable documents from HVD */}
          {((normalisedData.financialReports && normalisedData.financialReports.length > 0) ||
            documents.length > 0) && (
            <div className="rounded-2xl border border-border bg-card p-6">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-slate-400">
                Annual Reports
              </h2>

              {/* Enrichment-based report metadata */}
              {normalisedData.financialReports && normalisedData.financialReports.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-xs uppercase tracking-widest text-slate-500">
                        <th className="pb-2 pr-4">Type</th>
                        <th className="pb-2 pr-4">Period</th>
                        <th className="pb-2">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {normalisedData.financialReports.map((r, i) => (
                        <tr key={i}>
                          <td className="py-2 pr-4 text-white">
                            {r.rapportTypKlartext ?? '—'}
                          </td>
                          <td className="py-2 pr-4 text-slate-300">{r.period ?? '—'}</td>
                          <td className="py-2">
                            {r.status?.klartext ? (
                              <span className="rounded-full bg-slate-700/60 px-2 py-0.5 text-xs text-slate-300">
                                {r.status.klartext}
                              </span>
                            ) : (
                              <span className="text-slate-500">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Downloadable documents from Värdefulla Datamängder */}
              {documents.length > 0 && (
                <div className={normalisedData.financialReports && normalisedData.financialReports.length > 0 ? 'mt-6' : ''}>
                  {normalisedData.financialReports && normalisedData.financialReports.length > 0 && (
                    <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500">
                      Downloadable Files (Värdefulla Datamängder)
                    </h3>
                  )}
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border text-left text-xs uppercase tracking-widest text-slate-500">
                          <th className="pb-2 pr-4">Document Type</th>
                          <th className="pb-2 pr-4">Reporting Period End</th>
                          <th className="pb-2 pr-4">Registered</th>
                          <th className="pb-2 pr-4">Format</th>
                          <th className="pb-2">Download</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {documents.map((doc, i) => (
                          <tr key={doc.dokumentId ?? i}>
                            <td className="py-2 pr-4 text-white">
                              {doc.dokumenttyp ?? '—'}
                            </td>
                            <td className="py-2 pr-4 text-slate-300">
                              {formatDate(doc.rapporteringsperiodTom)}
                            </td>
                            <td className="py-2 pr-4 text-slate-400">
                              {formatDateTime(doc.registreringstidpunkt)}
                            </td>
                            <td className="py-2 pr-4">
                              {doc.filformat ? (
                                <span className="rounded bg-slate-700 px-1.5 py-0.5 text-xs font-mono text-slate-300">
                                  {doc.filformat.toUpperCase()}
                                </span>
                              ) : (
                                <span className="text-slate-500">—</span>
                              )}
                            </td>
                            <td className="py-2">
                              {doc.dokumentId ? (
                                <button
                                  onClick={() => handleDownload(doc)}
                                  disabled={downloadingId === doc.dokumentId}
                                  className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600/80 px-3 py-1 text-xs font-medium text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  {downloadingId === doc.dokumentId ? (
                                    <>
                                      <span className="h-3 w-3 animate-spin rounded-full border border-white/30 border-t-white" />
                                      Downloading…
                                    </>
                                  ) : (
                                    <>↓ Download</>
                                  )}
                                </button>
                              ) : (
                                <span className="text-slate-500">—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Snapshots history */}
      {snapshots.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-slate-400">
            Recent Snapshots
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-widest text-slate-500">
                  <th className="pb-2 pr-4">Fetched At</th>
                  <th className="pb-2 pr-4">Status</th>
                  <th className="pb-2 pr-4">Source</th>
                  <th className="pb-2">API Calls</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {snapshots.map((s) => (
                  <tr key={s.id}>
                    <td className="py-2 pr-4 text-slate-300">
                      {new Date(s.fetchedAt).toLocaleString()}
                    </td>
                    <td className="py-2 pr-4">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          s.fetchStatus === 'success'
                            ? 'bg-emerald-900/50 text-emerald-300'
                            : s.fetchStatus === 'error'
                              ? 'bg-red-900/50 text-red-300'
                              : 'bg-yellow-900/50 text-yellow-300'
                        }`}
                      >
                        {s.fetchStatus}
                      </span>
                    </td>
                    <td className="py-2 pr-4 text-slate-400">
                      {s.isFromCache ? 'cache' : 'api'}
                    </td>
                    <td className="py-2 text-slate-400">{s.apiCallCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function ProfileRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-widest text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-sm text-white">{value ?? '—'}</dd>
    </div>
  );
}

interface OfficerRow {
  namn?: string | null;
  personId?: string | null;
  roller?: Array<{ rollbeskrivning?: string }>;
  fodelseAr?: string | null;
  nationalitet?: string | null;
}

interface FinancialReport {
  rapportTypKlartext?: string;
  period?: string;
  status?: { klartext?: string };
}

interface AddressRow {
  adresstyp?: string | null;
  utdelningsadress?: string | null;
  gatuadress?: string | null;
  postnummer?: string | null;
  postort?: string | null;
  land?: string | null;
}

interface FieldError {
  field: string;
  errorType: string;
}

interface NormalisedData {
  organisationNumber?: string;
  legalName?: string;
  companyForm?: string | null;
  status?: string | null;
  registeredAt?: string | null;
  deregisteredAt?: string | null;
  countryCode?: string | null;
  businessDescription?: string | null;
  signatoryText?: string | null;
  industryCode?: string | null;
  officers?: OfficerRow[];
  financialReports?: FinancialReport[];
  addresses?: AddressRow[];
  allNames?: Array<{ namn?: string; namnTyp?: string }>;
  permits?: Array<Record<string, unknown>>;
  fieldErrors?: FieldError[];
  sourcePayloadSummary?: {
    hasHighValueDataset?: boolean;
    hasRichOrganisationInformation?: boolean;
    partialDataFields?: string[];
    historicalRecords?: unknown[];
  };
}

interface SnapshotRow {
  id: string;
  fetchedAt: string;
  fetchStatus: string;
  isFromCache: boolean;
  apiCallCount: number;
  ageInDays?: number | null;
}

interface EnrichResult {
  result?: {
    normalisedData?: NormalisedData;
    retrievedAt?: string;
  };
  snapshot?: SnapshotRow;
  isFromCache?: boolean;
  ageInDays?: number | null;
}

export default function BolagsverketPage() {
  const [identifier, setIdentifier] = useState('');
  const [touched, setTouched] = useState(false);
  const [forceRefresh, setForceRefresh] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enrichResult, setEnrichResult] = useState<EnrichResult | null>(null);
  const [snapshots, setSnapshots] = useState<SnapshotRow[]>([]);

  const isValid = validateIdentifier(identifier);
  const identifierType = classifyIdentifier(identifier);
  const validationError = touched ? identifierError(identifier) : null;

  const handleSearch = useCallback(async () => {
    setTouched(true);
    if (!identifier.trim() || !isValid) return;
    setLoading(true);
    setError(null);
    setEnrichResult(null);
    setSnapshots([]);

    try {
      const stripped = normaliseIdentifier(identifier.trim());
      const isPerson = classifyIdentifier(stripped) === 'personnummer';

      let result: EnrichResult;
      if (isPerson) {
        result = await api.bolagsverket.enrichPerson({
          personnummer: stripped,
          forceRefresh,
        });
      } else {
        result = await api.bolagsverket.enrich({
          identitetsbeteckning: stripped,
          forceRefresh,
        });
      }
      setEnrichResult(result);

      // Load last 5 snapshots
      const snapshotData = await api.bolagsverket.getSnapshots(stripped);
      setSnapshots(Array.isArray(snapshotData) ? snapshotData.slice(0, 5) : []);
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : typeof err === 'object' && err !== null && 'response' in err
            ? String((err as { response?: { data?: unknown } }).response?.data ?? err)
            : String(err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [identifier, isValid, forceRefresh]);

  const normalisedData = enrichResult?.result?.normalisedData;
  const isFromCache = enrichResult?.isFromCache;
  const ageInDays = enrichResult?.ageInDays;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Bolagsverket Lookup</h1>
        <p className="mt-1 text-sm text-slate-400">
          Search by organisationsnummer (10-digit) or personnummer (12-digit). Data is cached for 30
          days.
        </p>
      </div>

      {/* Search form */}
      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label
              htmlFor="bv-identifier-input"
              className="mb-1 block text-xs uppercase tracking-widest text-slate-400"
            >
              Organisation / Person number
            </label>
            <input
              id="bv-identifier-input"
              type="text"
              value={identifier}
              onChange={(e) => { setIdentifier(e.target.value); }}
              onBlur={() => setTouched(true)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="5560000001  or  197001011234"
              autoComplete="off"
              spellCheck={false}
              className={[
                'w-full rounded-xl border bg-background px-4 py-2.5 text-sm text-white placeholder-slate-500 transition',
                'focus:outline-none focus:ring-2',
                validationError
                  ? 'border-red-500 focus:ring-red-500/50'
                  : isValid
                    ? 'border-emerald-500 focus:ring-emerald-500/50'
                    : 'border-border focus:ring-indigo-500',
              ].join(' ')}
            />
            {validationError && (
              <p className="mt-1.5 text-xs text-red-400">{validationError}</p>
            )}
            {!validationError && isValid && (
              <p className="mt-1.5 text-xs text-emerald-400">
                ✓ Valid {IDENTIFIER_TYPE_LABELS[identifierType]}
              </p>
            )}
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={forceRefresh}
              onChange={(e) => setForceRefresh(e.target.checked)}
              className="rounded"
            />
            Force Refresh
          </label>
          <button
            onClick={handleSearch}
            disabled={loading || !identifier.trim()}
            className="rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? 'Searching…' : 'Search'}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-red-700 bg-red-900/30 p-4 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Results */}
      {normalisedData && (
        <div className="space-y-6">
          {/* Freshness badge */}
          <div className="flex items-center gap-3">
            {isFromCache ? (
              <span className="rounded-full bg-emerald-800/60 px-3 py-1 text-xs font-medium text-emerald-300">
                ✓ From cache (age: {ageInDays} days)
              </span>
            ) : (
              <span className="rounded-full bg-blue-800/60 px-3 py-1 text-xs font-medium text-blue-300">
                ↻ Fresh from API
              </span>
            )}
            {enrichResult?.result?.retrievedAt && (
              <span className="text-xs text-slate-500">
                Retrieved: {new Date(enrichResult.result.retrievedAt).toLocaleString()}
              </span>
            )}
          </div>

          {/* Company profile */}
          <div className="rounded-2xl border border-border bg-card p-6">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-slate-400">
              Company Profile
            </h2>
            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <ProfileRow label="Organisation Number" value={normalisedData.organisationNumber} />
              <ProfileRow label="Legal Name" value={normalisedData.legalName} />
              <ProfileRow label="Company Form" value={normalisedData.companyForm} />
              <ProfileRow label="Status" value={normalisedData.status} />
              <ProfileRow
                label="Registered"
                value={
                  normalisedData.registeredAt
                    ? new Date(normalisedData.registeredAt).toLocaleDateString('sv-SE')
                    : null
                }
              />
              <ProfileRow
                label="Deregistered"
                value={
                  normalisedData.deregisteredAt
                    ? new Date(normalisedData.deregisteredAt).toLocaleDateString('sv-SE')
                    : null
                }
              />
              <ProfileRow label="Industry Code" value={normalisedData.industryCode} />
              <ProfileRow label="Country" value={normalisedData.countryCode} />
              <ProfileRow label="Business Description" value={normalisedData.businessDescription} />
              <ProfileRow label="Signatory" value={normalisedData.signatoryText} />
            </dl>
          </div>

          {/* Data quality warning */}
          {normalisedData.fieldErrors && normalisedData.fieldErrors.length > 0 && (
            <div className="rounded-2xl border border-yellow-700/50 bg-yellow-900/20 p-4">
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-widest text-yellow-400">
                ⚠ Partial Data — {normalisedData.fieldErrors.length} field error{normalisedData.fieldErrors.length !== 1 ? 's' : ''}
              </h2>
              <ul className="space-y-1">
                {normalisedData.fieldErrors.map((fe, i) => (
                  <li key={i} className="flex items-center gap-2 text-xs text-yellow-300">
                    <span className="rounded bg-yellow-800/60 px-1.5 py-0.5 font-mono">{fe.field}</span>
                    <span className="text-yellow-500">{fe.errorType}</span>
                  </li>
                ))}
              </ul>
              {normalisedData.sourcePayloadSummary?.partialDataFields &&
                normalisedData.sourcePayloadSummary.partialDataFields.length > 0 && (
                  <p className="mt-2 text-xs text-yellow-500">
                    Partial: {normalisedData.sourcePayloadSummary.partialDataFields.join(', ')}
                  </p>
                )}
            </div>
          )}

          {/* Addresses */}
          {normalisedData.addresses && normalisedData.addresses.length > 0 && (
            <div className="rounded-2xl border border-border bg-card p-6">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-slate-400">
                Addresses
              </h2>
              <div className="space-y-3">
                {normalisedData.addresses.map((a, i) => (
                  <div key={i} className="rounded-xl bg-slate-800/40 px-4 py-3 text-sm">
                    {a.adresstyp && (
                      <span className="mb-1 inline-block rounded bg-slate-700 px-1.5 py-0.5 text-xs text-slate-300">
                        {a.adresstyp}
                      </span>
                    )}
                    <p className="text-white">
                      {a.utdelningsadress ?? a.gatuadress ?? '—'}
                    </p>
                    <p className="text-slate-400">
                      {[a.postnummer, a.postort, a.land].filter(Boolean).join(', ') || '—'}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* All registered names */}
          {normalisedData.allNames && normalisedData.allNames.length > 0 && (
            <div className="rounded-2xl border border-border bg-card p-6">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-slate-400">
                Registered Names
              </h2>
              <ul className="space-y-1">
                {normalisedData.allNames.map((n, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm">
                    {n.namnTyp && (
                      <span className="rounded bg-slate-700 px-1.5 py-0.5 text-xs text-slate-400">
                        {n.namnTyp}
                      </span>
                    )}
                    <span className="text-white">{n.namn ?? '—'}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* HVD / data source badges */}
          {normalisedData.sourcePayloadSummary && (
            <div className="flex flex-wrap gap-2">
              {normalisedData.sourcePayloadSummary.hasHighValueDataset && (
                <span className="rounded-full bg-violet-800/50 px-3 py-1 text-xs font-medium text-violet-300">
                  ✓ High-Value Dataset
                </span>
              )}
              {normalisedData.sourcePayloadSummary.hasRichOrganisationInformation && (
                <span className="rounded-full bg-teal-800/50 px-3 py-1 text-xs font-medium text-teal-300">
                  ✓ Rich Organisation Information
                </span>
              )}
              {normalisedData.sourcePayloadSummary.historicalRecords &&
                normalisedData.sourcePayloadSummary.historicalRecords.length > 0 && (
                  <span className="rounded-full bg-slate-700/70 px-3 py-1 text-xs font-medium text-slate-300">
                    {normalisedData.sourcePayloadSummary.historicalRecords.length} historical record
                    {normalisedData.sourcePayloadSummary.historicalRecords.length !== 1 ? 's' : ''}
                  </span>
                )}
            </div>
          )}

          {/* Officers */}
          {normalisedData.officers && normalisedData.officers.length > 0 && (
            <div className="rounded-2xl border border-border bg-card p-6">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-slate-400">
                Officers
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs uppercase tracking-widest text-slate-500">
                      <th className="pb-2 pr-4">Name</th>
                      <th className="pb-2 pr-4">Role(s)</th>
                      <th className="pb-2 pr-4">Born</th>
                      <th className="pb-2">Nationality</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {normalisedData.officers.map((o, i) => (
                      <tr key={i} className="py-2">
                        <td className="py-2 pr-4 text-white">{o.namn ?? '—'}</td>
                        <td className="py-2 pr-4 text-slate-300">
                          {o.roller?.map((r) => r.rollbeskrivning).filter(Boolean).join(', ') || '—'}
                        </td>
                        <td className="py-2 pr-4 text-slate-400">{o.fodelseAr ?? '—'}</td>
                        <td className="py-2 text-slate-400">{o.nationalitet ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Annual reports */}
          {normalisedData.financialReports && normalisedData.financialReports.length > 0 && (
            <div className="rounded-2xl border border-border bg-card p-6">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-slate-400">
                Annual Reports
              </h2>
              <ul className="space-y-2">
                {normalisedData.financialReports.map((r, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm">
                    <span className="rounded-md bg-slate-800 px-2 py-0.5 text-xs text-slate-300">
                      {r.rapportTypKlartext ?? 'Report'}
                    </span>
                    <span className="text-slate-300">{r.period ?? '—'}</span>
                    <span className="text-slate-500">{r.status?.klartext ?? ''}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Snapshots history */}
      {snapshots.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-slate-400">
            Recent Snapshots
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-widest text-slate-500">
                  <th className="pb-2 pr-4">Fetched At</th>
                  <th className="pb-2 pr-4">Status</th>
                  <th className="pb-2 pr-4">Source</th>
                  <th className="pb-2">API Calls</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {snapshots.map((s) => (
                  <tr key={s.id}>
                    <td className="py-2 pr-4 text-slate-300">
                      {new Date(s.fetchedAt).toLocaleString()}
                    </td>
                    <td className="py-2 pr-4">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          s.fetchStatus === 'success'
                            ? 'bg-emerald-900/50 text-emerald-300'
                            : s.fetchStatus === 'error'
                              ? 'bg-red-900/50 text-red-300'
                              : 'bg-yellow-900/50 text-yellow-300'
                        }`}
                      >
                        {s.fetchStatus}
                      </span>
                    </td>
                    <td className="py-2 pr-4 text-slate-400">
                      {s.isFromCache ? 'cache' : 'api'}
                    </td>
                    <td className="py-2 text-slate-400">{s.apiCallCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function ProfileRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-widest text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-sm text-white">{value ?? '—'}</dd>
    </div>
  );
}

'use client';

import { useState, useCallback } from 'react';
import { api } from '@/lib/api';

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

interface NormalisedData {
  organisationNumber?: string;
  legalName?: string;
  companyForm?: string | null;
  status?: string | null;
  registeredAt?: string | null;
  officers?: OfficerRow[];
  financialReports?: FinancialReport[];
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
  const [forceRefresh, setForceRefresh] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enrichResult, setEnrichResult] = useState<EnrichResult | null>(null);
  const [snapshots, setSnapshots] = useState<SnapshotRow[]>([]);

  const handleSearch = useCallback(async () => {
    if (!identifier.trim()) return;
    setLoading(true);
    setError(null);
    setEnrichResult(null);
    setSnapshots([]);

    try {
      const isPerson = /^\d{12}$/.test(identifier.trim());

      let result: EnrichResult;
      if (isPerson) {
        result = await api.bolagsverket.enrichPerson({
          personnummer: identifier.trim(),
          forceRefresh,
        });
      } else {
        result = await api.bolagsverket.enrich({
          identitetsbeteckning: identifier.trim(),
          forceRefresh,
        });
      }
      setEnrichResult(result);

      // Load last 5 snapshots
      const orgNr = identifier.trim();
      const snapshotData = await api.bolagsverket.getSnapshots(orgNr);
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
  }, [identifier, forceRefresh]);

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
            <label className="mb-1 block text-xs uppercase tracking-widest text-slate-400">
              Organisation / Person number
            </label>
            <input
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="5560000001  or  197001011234"
              className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
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
            </dl>
          </div>

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

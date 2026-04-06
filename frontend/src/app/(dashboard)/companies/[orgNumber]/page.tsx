'use client';

import Link from 'next/link';
import { useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { useCompanyFreshness } from '@/hooks/use-company-freshness';
import { useSnapshotHistory } from '@/hooks/use-snapshot-history';
import { useChangeEvents } from '@/hooks/use-change-events';
import { useCompanyLookup } from '@/hooks/use-company-lookup';
import { CompanyHeader } from '@/components/company/CompanyHeader';
import { CompanyDetailsGrid } from '@/components/company/CompanyDetailsGrid';
import { FreshnessIndicator } from '@/components/company/FreshnessIndicator';
import { DataSourceBadge } from '@/components/company/DataSourceBadge';
import { TabNavigation } from '@/components/company/TabNavigation';
import { FreshnessPanel } from '@/components/company/FreshnessPanel';
import { SourcePanel } from '@/components/company/SourcePanel';
import { SnapshotHistoryPanel } from '@/components/company/SnapshotHistoryPanel';
import { ChangeSummaryPanel } from '@/components/company/ChangeSummaryPanel';
import { api } from '@/lib/api';
import { type KodKlartext, toText } from '@/utils/bolagsverket';

// ─── Structured section types (mirrors backend NormalisedCompany sections) ───
interface MappedName { namn: string | null; namnstyp: string | null; sprak: string | null; registreringsdatum: string | null; avregistreringsdatum: string | null }
interface MappedAddress {
  adresstyp: string | null; gatuadress: string | null;
  /** Delivery/postal box address line, used instead of gatuadress for some address types. */
  utdelningsadress: string | null;
  postnummer: string | null; postort: string | null; land: string | null;
}
interface MappedStatus { status: string | KodKlartext | null; statusdatum: string | null }
interface MappedIndustryCode { snikod: string | null; snikodText: string | null }
interface MappedOfficer {
  namn: string | null; personId: string | null; fodelseAr: string | null; nationalitet: string | null;
  roller: Array<{ rollkod: string | null; rollbeskrivning: string | null; rollstatus: string | null; fran: string | null; tom: string | null }>;
}

interface HvdStructuredSection {
  identitetsbeteckning: string | null; namn: string | null; names: MappedName[];
  juridiskForm: string | KodKlartext | null; organisationsform: string | KodKlartext | null; organisationsdatum: string | null; registreringsdatum: string | null;
  verksamhetsbeskrivning: string | null; naringsgren: MappedIndustryCode[]; statusar: MappedStatus[];
  adresser: MappedAddress[]; postadressOrganisation: MappedAddress | null;
  reklamsparr: string | KodKlartext | null; avregistreradOrganisation: string | null;
  avregistreringsorsak: string | KodKlartext | null; avregistreringsdatum: string | null;
  pagaendeAvvecklingsEllerOmstruktureringsforfarande: string | null;
  verksamOrganisation: string | KodKlartext | null; registreringsland: string | KodKlartext | null; organisationsidentitet: string | null;
  rekonstruktionsstatus: string | KodKlartext | null; rekonstruktionsdatum: string | null;
}

interface V4StructuredSection {
  identitetsbeteckning: string | null; organisationsnamn: string | null; organisationsform: string | KodKlartext | null;
  organisationsdatum: string | null; registreringsdatum: string | null; organisationsstatusar: MappedStatus[];
  hemvistkommun: { kommunnamn: string | null; kommunkod: string | null } | null;
  rakenskapsar: { rakenskapsarInleds: string | null; rakenskapsarAvslutas: string | null; forstaRakenskapsarInleds: string | null; forstaRakenskapsarAvslutas: string | null } | null;
  verksamhetsbeskrivning: string | null; firmateckning: string | null; firmateckningstyp: string | null;
  samtligaOrganisationsnamn: MappedName[]; funktionarer: MappedOfficer[]; adresser: MappedAddress[];
  aktieinformation: { aktiekapital: number | null; antalAktier: number | null; kvotvarde: number | null; aktiekapitalMin: number | null; aktiekapitalMax: number | null; antalAktierMin: number | null; antalAktierMax: number | null; registreringsdatum: string | null; aktieslag: Array<{ aktieslagsnamn: string | null; antalAktier: number | null; aktiekapital: number | null; kvotvarde: number | null; rostvarde: number | null }> } | null;
  tillstand: Array<{ tillstandstyp: string | null; tillstandsnummer: string | null; tillstandsstatus: string | null; beviljatDatum: string | null; giltigFran: string | null; giltigTom: string | null; utfardareNamn: string | null }>;
  organisationsmarkeringar: Array<{ markeringstyp: string | null; markeringsdatum: string | null; text: string | null }>;
  bestammelser: Array<{ bestammelsetyp: string | null; text: string | null; registreringsdatum: string | null }>;
  vakanserOchUpplysningar: Array<{ typ: string | null; text: string | null; registreringsdatum: string | null }>;
  ekonomiskPlan: { plantyp: string | null; godkandDatum: string | null; registreringsdatum: string | null } | null;
  utlandskFilialagandeOrganisation: { utlandskOrganisationNamn: string | null; utlandskOrganisationIdentitetsbeteckning: string | null; utlandskOrganisationLand: string | null } | null;
  finansiellaRapporter: Array<{ rapporttyp: string | null; rapporteringsperiodFran: string | null; rapporteringsperiodTom: string | null; registreringsdatum: string | null; dokumentId: string | null }>;
  ovrigOrganisationsinformation: Record<string, unknown> | null;
}

// ─── Annual reports (HVD dokumentlista) types ─────────────────────────────────

interface BvDokument {
  dokumentId?: string;
  filformat?: string;
  rapporteringsperiodTom?: string;
  registreringstidpunkt?: string;
  dokumenttyp?: string;
}

// ─── Default fallback name constant ───────────────────────────────────────────

const DEFAULT_COMPANY_NAME = 'Unknown company';

// ─── Shared display helpers ───────────────────────────────────────────────────

function fmt(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  try { return new Date(dateStr).toLocaleDateString('sv-SE'); } catch { return dateStr; }
}

function fmtTs(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  try { return new Date(dateStr).toLocaleString('sv-SE'); } catch { return dateStr; }
}

function fmtNum(n: number | null | undefined): string {
  if (n == null) return '—';
  return n.toLocaleString('sv-SE');
}

function triggerDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = fileName;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}

function Row({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-widest text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-sm text-white">{value ?? '—'}</dd>
    </div>
  );
}

function SectionCard({ title, badge, children }: { title: string; badge?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="mb-4 flex items-center gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-400">{title}</h2>
        {badge}
      </div>
      {children}
    </div>
  );
}

function SourceBadge({ label, color }: { label: string; color: 'violet' | 'teal' }) {
  const cls = color === 'violet'
    ? 'bg-violet-900/40 text-violet-300 ring-violet-700/40'
    : 'bg-teal-900/40 text-teal-300 ring-teal-700/40';
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ${cls}`}>{label}</span>;
}

function AddressCard({ addr }: { addr: MappedAddress }) {
  const streetLine = addr.gatuadress ?? addr.utdelningsadress ?? null;
  return (
    <div className="rounded-xl bg-slate-800/40 px-4 py-3 text-sm">
      {addr.adresstyp && (
        <span className="mb-1 inline-block rounded bg-slate-700 px-1.5 py-0.5 text-xs text-slate-300">{addr.adresstyp}</span>
      )}
      <p className="text-white">{streetLine ?? '—'}</p>
      <p className="text-slate-400">{[addr.postnummer, addr.postort, addr.land].filter(Boolean).join(', ') || '—'}</p>
    </div>
  );
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="flex items-start gap-4">
          <div className="h-14 w-14 rounded-xl bg-slate-800" />
          <div className="flex-1 space-y-2">
            <div className="h-6 w-48 rounded bg-slate-800" />
            <div className="h-4 w-32 rounded bg-slate-800" />
          </div>
        </div>
      </div>
      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="h-4 w-32 rounded bg-slate-800 mb-4" />
        <div className="grid grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="space-y-1">
              <div className="h-3 w-24 rounded bg-slate-800" />
              <div className="h-4 w-32 rounded bg-slate-800" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Download button ──────────────────────────────────────────────────────────

function DownloadButton({ dokumentId, downloadingId, onDownload }: {
  dokumentId: string | null | undefined;
  downloadingId: string | null;
  onDownload: (dokumentId: string) => void;
}) {
  if (!dokumentId) return <span className="text-slate-500">—</span>;
  const busy = downloadingId === dokumentId;
  return (
    <button
      onClick={() => onDownload(dokumentId)}
      disabled={busy}
      className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600/80 px-3 py-1 text-xs font-medium text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {busy ? (
        <><span className="h-3 w-3 animate-spin rounded-full border border-white/30 border-t-white" />Downloading…</>
      ) : '↓ Download'}
    </button>
  );
}

// ─── HVD Data Section ─────────────────────────────────────────────────────────

function HvdDataSection({ hvd }: { hvd: HvdStructuredSection }) {
  const allAddresses = [
    ...(hvd.postadressOrganisation ? [hvd.postadressOrganisation] : []),
    ...hvd.adresser.filter((a) => a !== hvd.postadressOrganisation),
  ];

  return (
    <SectionCard title="Värdefulla Datamängder (HVD)" badge={<SourceBadge label="HVD API" color="violet" />}>
      <div className="space-y-6">
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Row label="Organisation Number" value={hvd.identitetsbeteckning} />
          <Row label="Legal Name" value={hvd.namn} />
          <Row label="Legal Form (Juridisk Form)" value={toText(hvd.juridiskForm)} />
          <Row label="Company Form" value={toText(hvd.organisationsform)} />
          <Row label="Organisation Date" value={fmt(hvd.organisationsdatum)} />
          <Row label="Registered" value={fmt(hvd.registreringsdatum)} />
          <Row label="Country" value={toText(hvd.registreringsland)} />
          <Row label="External Identity" value={hvd.organisationsidentitet} />
          <Row label="Active (Verksam)" value={toText(hvd.verksamOrganisation)} />
          <Row label="Marketing Opt-out" value={toText(hvd.reklamsparr)} />
          <Row label="Deregistered" value={fmt(hvd.avregistreradOrganisation)} />
          <Row label="Deregistration Reason" value={toText(hvd.avregistreringsorsak)} />
          {hvd.rekonstruktionsstatus && (
            <Row label="Restructuring Status" value={toText(hvd.rekonstruktionsstatus)} />
          )}
        </dl>

        {hvd.statusar.length > 0 && (
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-500">Statuses</h3>
            <div className="flex flex-wrap gap-2">
              {hvd.statusar.map((s, i) => (
                <span key={i} className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-300">
                  {toText(s.status) ?? '—'}{s.statusdatum ? ` (${fmt(s.statusdatum)})` : ''}
                </span>
              ))}
            </div>
          </div>
        )}

        {hvd.verksamhetsbeskrivning && (
          <div>
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-widest text-slate-500">Business Description</h3>
            <p className="text-sm text-slate-300">{hvd.verksamhetsbeskrivning}</p>
          </div>
        )}

        {allAddresses.length > 0 && (
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-500">Addresses</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {allAddresses.map((addr, i) => (
                <AddressCard key={i} addr={addr} />
              ))}
            </div>
          </div>
        )}

        {hvd.names.length > 0 && (
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-500">Registered Names</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-widest text-slate-500">
                    <th className="pb-2 pr-4">Name</th>
                    <th className="pb-2 pr-4">Type</th>
                    <th className="pb-2 pr-4">Registered</th>
                    <th className="pb-2">Deregistered</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {hvd.names.map((n, i) => (
                    <tr key={i}>
                      <td className="py-2 pr-4 text-white">{n.namn ?? '—'}</td>
                      <td className="py-2 pr-4 text-slate-400">{n.namnstyp ?? '—'}</td>
                      <td className="py-2 pr-4 text-slate-400">{fmt(n.registreringsdatum)}</td>
                      <td className="py-2 text-slate-400">{fmt(n.avregistreringsdatum)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </SectionCard>
  );
}

// ─── V4 Data Section ──────────────────────────────────────────────────────────

function V4DataSection({ v4 }: { v4: V4StructuredSection }) {
  return (
    <SectionCard title="Företagsinformation (v4)" badge={<SourceBadge label="Företagsinformation" color="teal" />}>
      <div className="space-y-6">
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Row label="Organisation Number" value={v4.identitetsbeteckning} />
          <Row label="Organisation Name" value={v4.organisationsnamn} />
          <Row label="Company Form" value={toText(v4.organisationsform)} />
          <Row label="Organisation Date" value={fmt(v4.organisationsdatum)} />
          <Row label="Registration Date" value={fmt(v4.registreringsdatum)} />
          <Row label="Municipality" value={v4.hemvistkommun?.kommunnamn} />
          {v4.rakenskapsar && (
            <Row label="Financial Year" value={v4.rakenskapsar.rakenskapsarInleds ? `${fmt(v4.rakenskapsar.rakenskapsarInleds)} – ${fmt(v4.rakenskapsar.rakenskapsarAvslutas)}` : null} />
          )}
          {v4.firmateckning && (
            <div className="sm:col-span-2 lg:col-span-3">
              <dt className="text-xs font-medium uppercase tracking-widest text-slate-500">Signatory Power</dt>
              <dd className="mt-0.5 text-sm text-white">{v4.firmateckning}</dd>
            </div>
          )}
        </dl>

        {v4.organisationsstatusar.length > 0 && (
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-500">Statuses</h3>
            <div className="flex flex-wrap gap-2">
              {v4.organisationsstatusar.map((s, i) => (
                <span key={i} className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-300">
                  {toText(s.status) ?? '—'}{s.statusdatum ? ` (${fmt(s.statusdatum)})` : ''}
                </span>
              ))}
            </div>
          </div>
        )}

        {v4.verksamhetsbeskrivning && (
          <div>
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-widest text-slate-500">Business Description</h3>
            <p className="text-sm text-slate-300">{v4.verksamhetsbeskrivning}</p>
          </div>
        )}

        {v4.adresser.length > 0 && (
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-500">Addresses</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {v4.adresser.map((addr, i) => (
                <AddressCard key={i} addr={addr} />
              ))}
            </div>
          </div>
        )}

        {v4.funktionarer.length > 0 && (
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-500">Officers (Funktionärer)</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-widest text-slate-500">
                    <th className="pb-2 pr-4">Name</th>
                    <th className="pb-2 pr-4">Roles</th>
                    <th className="pb-2">Birth Year</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {v4.funktionarer.map((f, i) => (
                    <tr key={i}>
                      <td className="py-2 pr-4 text-white">{f.namn ?? '—'}</td>
                      <td className="py-2 pr-4 text-slate-300">
                        {f.roller.length > 0
                          ? f.roller.map((r) => r.rollbeskrivning ?? r.rollkod ?? '—').join(', ')
                          : '—'}
                      </td>
                      <td className="py-2 text-slate-400">{f.fodelseAr ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {v4.aktieinformation && (
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-500">Share Information</h3>
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              <Row label="Share Capital" value={fmtNum(v4.aktieinformation.aktiekapital)} />
              <Row label="Number of Shares" value={fmtNum(v4.aktieinformation.antalAktier)} />
              <Row label="Quota Value" value={fmtNum(v4.aktieinformation.kvotvarde)} />
              <Row label="Registered" value={fmt(v4.aktieinformation.registreringsdatum)} />
            </dl>
          </div>
        )}

        {v4.samtligaOrganisationsnamn.length > 0 && (
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-500">All Registered Names</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-widest text-slate-500">
                    <th className="pb-2 pr-4">Name</th>
                    <th className="pb-2 pr-4">Type</th>
                    <th className="pb-2">Registered</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {v4.samtligaOrganisationsnamn.map((n, i) => (
                    <tr key={i}>
                      <td className="py-2 pr-4 text-white">{n.namn ?? '—'}</td>
                      <td className="py-2 pr-4 text-slate-400">{n.namnstyp ?? '—'}</td>
                      <td className="py-2 text-slate-400">{fmt(n.registreringsdatum)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </SectionCard>
  );
}

// ─── Annual Reports Section ───────────────────────────────────────────────────

function AnnualReportsSection({ documents, reports, downloadingId, onDownload }: {
  documents: BvDokument[];
  reports: Array<{ rapporttyp: string | null; rapporteringsperiodFran: string | null; rapporteringsperiodTom: string | null; registreringsdatum: string | null; dokumentId: string | null }>;
  downloadingId: string | null;
  onDownload: (dokumentId: string) => void;
}) {
  // Merge: reports from v4 (have period info + maybe dokumentId) plus any HVD docs
  // not already covered by a report
  const reportDocIds = new Set(reports.map((r) => r.dokumentId).filter(Boolean));
  const extraDocs = documents.filter((d) => d.dokumentId && !reportDocIds.has(d.dokumentId));

  return (
    <SectionCard title="Annual Reports">
      <div className="space-y-6">
        {reports.length > 0 && (
          <div>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500 flex items-center gap-2">
              Report List
              <SourceBadge label="Företagsinformation" color="teal" />
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-widest text-slate-500">
                    <th className="pb-2 pr-4">Report Type</th>
                    <th className="pb-2 pr-4">Period</th>
                    <th className="pb-2 pr-4">Registered</th>
                    <th className="pb-2">Download</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {reports.map((r, i) => (
                    <tr key={i}>
                      <td className="py-2 pr-4 text-white">{r.rapporttyp ?? '—'}</td>
                      <td className="py-2 pr-4 text-slate-300">
                        {r.rapporteringsperiodFran
                          ? `${fmt(r.rapporteringsperiodFran)} – ${fmt(r.rapporteringsperiodTom)}`
                          : fmt(r.rapporteringsperiodTom)}
                      </td>
                      <td className="py-2 pr-4 text-slate-400 text-xs">{fmt(r.registreringsdatum)}</td>
                      <td className="py-2">
                        <DownloadButton
                          dokumentId={r.dokumentId}
                          downloadingId={downloadingId}
                          onDownload={onDownload}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {(documents.length > 0) && (
          <div>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500 flex items-center gap-2">
              Downloadable Files
              <SourceBadge label="HVD" color="violet" />
              {extraDocs.length < documents.length && (
                <span className="text-slate-600">({documents.length} total, {extraDocs.length} additional)</span>
              )}
            </h3>
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
                      <td className="py-2 pr-4 text-white">{doc.dokumenttyp ?? '—'}</td>
                      <td className="py-2 pr-4 text-slate-300">{fmt(doc.rapporteringsperiodTom)}</td>
                      <td className="py-2 pr-4 text-slate-400 text-xs">{fmtTs(doc.registreringstidpunkt)}</td>
                      <td className="py-2 pr-4">
                        {doc.filformat
                          ? <span className="rounded bg-slate-700 px-1.5 py-0.5 text-xs font-mono text-slate-300">{doc.filformat.toUpperCase()}</span>
                          : <span className="text-slate-500">—</span>}
                      </td>
                      <td className="py-2">
                        <DownloadButton
                          dokumentId={doc.dokumentId}
                          downloadingId={downloadingId}
                          onDownload={onDownload}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {reports.length === 0 && documents.length === 0 && (
          <p className="text-sm text-slate-400">No annual reports available.</p>
        )}
      </div>
    </SectionCard>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CompanyProfilePage() {
  const params = useParams();
  const orgNumber = typeof params.orgNumber === 'string' ? params.orgNumber : '';

  const { user } = useAuth();
  const canViewSensitive = ['admin', 'audit', 'evidence', 'compliance'].includes(user?.role ?? '');
  const [snapshotLimit, setSnapshotLimit] = useState(10);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const { data, loading, error, refreshing, cooldownRemaining, refresh } = useCompanyLookup(orgNumber);
  const {
    data: freshnessData,
    loading: freshnessLoading,
    error: freshnessError,
    retry: retryFreshness,
  } = useCompanyFreshness(orgNumber);
  const {
    data: snapshotHistory,
    loading: snapshotLoading,
    error: snapshotError,
    retry: retrySnapshots,
  } = useSnapshotHistory(orgNumber, snapshotLimit);
  const {
    data: changeEvents,
    loading: changeLoading,
    error: changeError,
    retry: retryChanges,
  } = useChangeEvents(orgNumber, 6, canViewSensitive);

  const company = data?.company;
  const metadata = data?.metadata;
  const hvdSection = (company?.hvdSection ?? null) as HvdStructuredSection | null;
  const v4Section = (company?.v4Section ?? null) as V4StructuredSection | null;
  const documentList = (company?.documentList ?? null) as BvDokument[] | null;

  // Resolve display name: skip DEFAULT_COMPANY_NAME fallback and try section names
  const primaryName =
    company?.legalName && company.legalName !== DEFAULT_COMPANY_NAME
      ? company.legalName
      : null;
  const displayName =
    primaryName ??
    hvdSection?.namn ??
    hvdSection?.names?.[0]?.namn ??
    v4Section?.organisationsnamn ??
    v4Section?.samtligaOrganisationsnamn?.[0]?.namn ??
    DEFAULT_COMPANY_NAME;

  // Resolve registration date: try company.registeredAt first, then hvdSection fallbacks
  const registeredAt =
    (company?.registeredAt as string | null | undefined) ??
    hvdSection?.organisationsdatum ??
    hvdSection?.registreringsdatum ??
    v4Section?.organisationsdatum ??
    v4Section?.registreringsdatum ??
    null;

  // Annual report data sources
  const v4Reports = v4Section?.finansiellaRapporter ?? [];
  const hvdDocs = documentList ?? [];
  const hasAnnualReports = v4Reports.length > 0 || hvdDocs.length > 0;

  const handleDownload = useCallback(async (dokumentId: string) => {
    setDownloadingId(dokumentId);
    setDownloadError(null);
    try {
      const { blob, fileName } = await api.bolagsverket.downloadDocument(dokumentId);
      triggerDownload(blob, fileName);
    } catch {
      setDownloadError('Download failed. Please try again.');
    } finally {
      setDownloadingId(null);
    }
  }, []);

  return (
    <div className="space-y-6">
      {/* Breadcrumb / back nav */}
      <div className="flex items-center gap-2 text-sm text-slate-400">
        <Link href="/companies" className="transition hover:text-white">
          Companies
        </Link>
        <span>/</span>
        <span className="text-slate-200">{orgNumber}</span>
      </div>

      {/* Error state */}
      {error && !loading && (
        <div className="rounded-xl border border-red-700 bg-red-900/30 p-5">
          <p className="font-medium text-red-300">{error}</p>
          <div className="mt-3 flex gap-3">
            <button
              onClick={() => refresh()}
              className="rounded-lg bg-red-700/40 px-4 py-2 text-sm text-red-200 transition hover:bg-red-700/60"
            >
              Retry
            </button>
            <Link
              href="/search"
              className="rounded-lg bg-slate-700/40 px-4 py-2 text-sm text-slate-300 transition hover:bg-slate-700/60"
            >
              Back to Search
            </Link>
          </div>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && <LoadingSkeleton />}

      {/* Company profile */}
      {!loading && !error && company && metadata && (
        <>
          {/* Header */}
          <CompanyHeader
            legalName={displayName}
            orgNumber={company.organisationNumber ?? orgNumber}
            status={company.status}
            countryCode={company.countryCode}
          />

          {/* Freshness indicator + data source badge + refresh button */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <DataSourceBadge
                source={metadata.source}
                degraded={metadata.degraded}
                failureState={metadata.failure_state}
              />
              <FreshnessIndicator
                fetchedAt={metadata.fetched_at}
                ageDays={metadata.age_days}
                freshness={metadata.freshness}
              />
            </div>
            <button
              onClick={() => refresh()}
              disabled={refreshing || cooldownRemaining > 0}
              className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-sm text-slate-300 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {refreshing ? (
                <span className="h-3.5 w-3.5 animate-spin rounded-full border border-slate-400 border-t-white" />
              ) : (
                <span>↻</span>
              )}
              {cooldownRemaining > 0 ? `Wait ${cooldownRemaining}s` : 'Refresh'}
            </button>
          </div>

          {/* Tab navigation */}
          <TabNavigation />

          {/* Download error */}
          {downloadError && (
            <div className="rounded-xl border border-red-700 bg-red-900/30 p-4 text-sm text-red-300">
              {downloadError}
            </div>
          )}

          {/* Company details */}
          <CompanyDetailsGrid
            orgNumber={company.organisationNumber ?? orgNumber}
            registeredAt={registeredAt}
            companyForm={company.companyForm}
            countryCode={company.countryCode}
            businessDescription={company.businessDescription}
          />

          {/* HVD structured section */}
          {hvdSection && <HvdDataSection hvd={hvdSection} />}

          {/* V4 structured section */}
          {v4Section && <V4DataSection v4={v4Section} />}

          {/* Annual reports */}
          {hasAnnualReports && (
            <AnnualReportsSection
              documents={hvdDocs}
              reports={v4Reports}
              downloadingId={downloadingId}
              onDownload={handleDownload}
            />
          )}

          {/* Freshness / Source / Changes */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <FreshnessPanel
              data={freshnessData}
              loading={freshnessLoading}
              error={freshnessError}
              onRetry={retryFreshness}
            />
            <SourcePanel
              data={freshnessData}
              loading={freshnessLoading}
              error={freshnessError}
              onRetry={retryFreshness}
            />
            <ChangeSummaryPanel
              events={changeEvents ?? []}
              loading={changeLoading}
              error={changeError}
              onRetry={retryChanges}
              canViewSensitive={canViewSensitive}
            />
          </div>

          {/* Snapshot history */}
          <SnapshotHistoryPanel
            snapshots={snapshotHistory ?? []}
            loading={snapshotLoading}
            error={snapshotError}
            onRetry={retrySnapshots}
            pageSize={snapshotLimit}
            onPageSizeChange={setSnapshotLimit}
            canViewSensitive={canViewSensitive}
          />
        </>
      )}
    </div>
  );
}

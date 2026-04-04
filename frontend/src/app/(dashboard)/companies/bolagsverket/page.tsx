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

// ─── Backend response types ───────────────────────────────────────────────────

interface BvFel { typ?: string; felBeskrivning?: string }

interface HvdAddress {
  gatuadress?: string; postnummer?: string; postort?: string;
  land?: string; adresstyp?: string; fel?: BvFel;
}
interface HvdOrganisationStatus { status?: string; statusdatum?: string }
interface HvdIndustryCode { snikod?: string; snikodText?: string; fel?: BvFel }
interface HvdDeregistrationInfo { avregistreringsdatum?: string; avregistreringsorsak?: string }
interface HvdRestructuringStatus { rekonstruktionsstatus?: string; rekonstruktionsdatum?: string }
interface HvdOrganisation {
  identitetsbeteckning?: string; namn?: string; organisationsform?: string;
  registreringsdatum?: string; juridiskForm?: string;
  organisationsstatusar?: HvdOrganisationStatus[];
  adresser?: HvdAddress[];
  snikoder?: HvdIndustryCode[];
  avregistreringsinformation?: HvdDeregistrationInfo;
  rekonstruktionsstatus?: HvdRestructuringStatus;
  fel?: BvFel;
}
interface HighValueDatasetResponse {
  organisation?: HvdOrganisation;
  organisationer?: HvdOrganisation[];
  fel?: BvFel;
}

interface BvOfficerRole { rollkod?: string; rollbeskrivning?: string; rollstatus?: string; fran?: string; tom?: string }
interface BvOfficer { namn?: string; personId?: string; roller?: BvOfficerRole[]; fodelseAr?: string; nationalitet?: string }
interface BvAktieslag { aktieslagsnamn?: string; antalAktier?: number; kvotvarde?: number; aktiekapital?: number; rostvarde?: number }
interface BvAktieinformation {
  aktiekapital?: number; antalAktier?: number; kvotvarde?: number;
  aktieslag?: BvAktieslag[];
  aktiekapitalMax?: number; aktiekapitalMin?: number;
  registreringsdatum?: string; fel?: BvFel;
}
interface BvRakenskapsAr {
  rakenskapsarInleds?: string; rakenskapsarAvslutas?: string;
  forstaRakenskapsarInleds?: string; forstaRakenskapsarAvslutas?: string; fel?: BvFel;
}
interface BvOrganisationsnamn {
  namn?: string; namnstyp?: string; sprak?: string;
  registreringsdatum?: string; avregistreringsdatum?: string;
}
interface BvTillstand {
  tillstandstyp?: string; tillstandsnummer?: string; tillstandsstatus?: string;
  beviljatDatum?: string; giltigFran?: string; giltigTom?: string; utfardareNamn?: string;
}
interface BvVerksamhetsbeskrivning { text?: string; sprak?: string }
interface BvOrganisationsmarkering { markeringstyp?: string; markeringsdatum?: string; text?: string }
interface BvHemvistkommun { kommunnamn?: string; kommunkod?: string }
interface BvUtlandskFilial {
  utlandskOrganisationNamn?: string;
  utlandskOrganisationIdentitetsbeteckning?: string;
  utlandskOrganisationLand?: string;
}
interface BvFinansiellRapport {
  rapporttyp?: string; rapporteringsperiodFran?: string; rapporteringsperiodTom?: string;
  registreringsdatum?: string; dokumentId?: string;
}
interface OrganisationInformationResponse {
  identitetsbeteckning?: string; namn?: string; organisationsform?: string;
  registreringsdatum?: string;
  organisationsstatusar?: HvdOrganisationStatus[];
  funktionarer?: BvOfficer[];
  firmateckning?: { text?: string; firmateckningstyp?: string } | string;
  aktieinformation?: BvAktieinformation;
  rakenskapsAr?: BvRakenskapsAr;
  samtligaOrganisationsnamn?: BvOrganisationsnamn[];
  tillstand?: BvTillstand[];
  verksamhetsbeskrivning?: BvVerksamhetsbeskrivning | string;
  bestammelser?: Array<{ bestammelsetyp?: string; text?: string; registreringsdatum?: string }>;
  vakanserOchUpplysningar?: Array<{ typ?: string; text?: string }>;
  finansiellaRapporter?: BvFinansiellRapport[];
  organisationsmarkeringar?: BvOrganisationsmarkering[];
  hemvistkommun?: BvHemvistkommun;
  utlandskFilialagandeOrganisation?: BvUtlandskFilial;
  adresser?: HvdAddress[];
  fel?: BvFel;
}

interface FieldError { field: string; errorType: string }
interface NormalisedData {
  organisationNumber?: string; legalName?: string; companyForm?: string | null;
  status?: string | null; registeredAt?: string | null; deregisteredAt?: string | null;
  countryCode?: string | null; businessDescription?: string | null;
  signatoryText?: string | null; industryCode?: string | null;
  officers?: BvOfficer[];
  financialReports?: Array<{ rapportTypKlartext?: string; period?: string; status?: { klartext?: string } }>;
  addresses?: Array<{ adresstyp?: string | null; utdelningsadress?: string | null; gatuadress?: string | null; postnummer?: string | null; postort?: string | null; land?: string | null }>;
  allNames?: Array<{ namn?: string; namnTyp?: string }>;
  fieldErrors?: FieldError[];
  sourcePayloadSummary?: {
    hasHighValueDataset?: boolean; hasRichOrganisationInformation?: boolean;
    partialDataFields?: string[]; historicalRecords?: unknown[];
  };
}

interface SnapshotRow {
  id: string; fetchedAt: string; fetchStatus: string;
  isFromCache: boolean; apiCallCount: number; ageInDays?: number | null;
}

interface EnrichResult {
  result?: {
    normalisedData?: NormalisedData;
    highValueDataset?: HighValueDatasetResponse | null;
    organisationInformation?: OrganisationInformationResponse[];
    retrievedAt?: string;
  };
  snapshot?: SnapshotRow;
  isFromCache?: boolean;
  ageInDays?: number | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(dateStr?: string | null): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? dateStr : d.toLocaleDateString('sv-SE');
}
function fmtTs(dateStr?: string | null): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? dateStr : d.toLocaleString('sv-SE');
}
function fmtNum(n?: number | null): string {
  if (n == null) return '—';
  return n.toLocaleString('sv-SE');
}
function formatRoles(roller?: BvOfficerRole[]): string {
  if (!roller || roller.length === 0) return '—';
  return roller
    .map((r) => [r.rollbeskrivning, r.rollstatus && r.rollstatus !== 'AKTIV' ? `(${r.rollstatus})` : ''].filter(Boolean).join(' '))
    .join(', ');
}

function triggerDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = fileName;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}

// ─── Small reusable components ───────────────────────────────────────────────

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-widest text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-sm text-white">{value ?? '—'}</dd>
    </div>
  );
}

function SectionCard({ title, badge, children }: { title: string; badge?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="mb-4 flex items-center gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-400">{title}</h2>
        {badge}
      </div>
      {children}
    </div>
  );
}

function SourceBadge({ label, color }: { label: string; color: 'violet' | 'teal' }) {
  const cls = color === 'violet'
    ? 'bg-violet-800/50 text-violet-300'
    : 'bg-teal-800/50 text-teal-300';
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>{label}</span>
  );
}

function DownloadButton({ doc, downloadingId, onDownload }: {
  doc: BvDokument & { dokumentId?: string };
  downloadingId: string | null;
  onDownload: (doc: BvDokument) => void;
}) {
  if (!doc.dokumentId) return <span className="text-slate-500">—</span>;
  const busy = downloadingId === doc.dokumentId;
  return (
    <button
      onClick={() => onDownload(doc)}
      disabled={busy}
      className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600/80 px-3 py-1 text-xs font-medium text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {busy ? (
        <><span className="h-3 w-3 animate-spin rounded-full border border-white/30 border-t-white" />Downloading…</>
      ) : '↓ Download'}
    </button>
  );
}

// ─── Section: Värdefulla Datamängder (HVD) ───────────────────────────────────

function HvdSection({ hvd }: { hvd: HighValueDatasetResponse }) {
  const org = hvd.organisation ?? hvd.organisationer?.[0];
  if (!org) return null;

  const statuses = org.organisationsstatusar ?? [];
  const codes = (org.snikoder ?? []).filter((c) => !c.fel);
  const addresses = (org.adresser ?? []).filter((a) => !a.fel);
  const dereg = org.avregistreringsinformation;
  const rekon = org.rekonstruktionsstatus;

  return (
    <SectionCard title="Värdefulla Datamängder" badge={<SourceBadge label="HVD API" color="violet" />}>
      <div className="space-y-5">
        {/* Basic identity */}
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Row label="Legal name" value={org.namn} />
          <Row label="Organisation number" value={org.identitetsbeteckning} />
          <Row label="Legal form" value={org.juridiskForm ?? org.organisationsform} />
          <Row label="Registered" value={fmt(org.registreringsdatum)} />
          {dereg && (
            <>
              <Row label="Deregistered" value={fmt(dereg.avregistreringsdatum)} />
              <Row label="Deregistration reason" value={dereg.avregistreringsorsak} />
            </>
          )}
          {rekon?.rekonstruktionsstatus && (
            <Row label="Restructuring status" value={`${rekon.rekonstruktionsstatus}${rekon.rekonstruktionsdatum ? ` (${fmt(rekon.rekonstruktionsdatum)})` : ''}`} />
          )}
        </dl>

        {/* Status history */}
        {statuses.length > 0 && (
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-500">Status History</h3>
            <div className="flex flex-wrap gap-2">
              {statuses.map((s, i) => (
                <span key={i} className="rounded-full bg-slate-700/60 px-3 py-1 text-xs text-slate-300">
                  {s.status ?? '—'}{s.statusdatum ? ` · ${fmt(s.statusdatum)}` : ''}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Industry codes */}
        {codes.length > 0 && (
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-500">Industry Codes (SNI)</h3>
            <div className="space-y-1">
              {codes.map((c, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <span className="rounded bg-slate-700 px-1.5 py-0.5 font-mono text-xs text-slate-300">{c.snikod}</span>
                  <span className="text-slate-300">{c.snikodText ?? '—'}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Addresses */}
        {addresses.length > 0 && (
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-500">Addresses</h3>
            <div className="space-y-2">
              {addresses.map((a, i) => (
                <div key={i} className="rounded-xl bg-slate-800/40 px-4 py-3 text-sm">
                  {a.adresstyp && (
                    <span className="mb-1 inline-block rounded bg-slate-700 px-1.5 py-0.5 text-xs text-slate-300">{a.adresstyp}</span>
                  )}
                  <p className="text-white">{a.gatuadress ?? '—'}</p>
                  <p className="text-slate-400">{[a.postnummer, a.postort, a.land].filter(Boolean).join(', ') || '—'}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </SectionCard>
  );
}

// ─── Section: Företagsinformation/v4 ─────────────────────────────────────────

function ForetagsinfSection({ orgInfo }: { orgInfo: OrganisationInformationResponse }) {
  const share = orgInfo.aktieinformation;
  const fy = orgInfo.rakenskapsAr;
  const desc = typeof orgInfo.verksamhetsbeskrivning === 'string'
    ? orgInfo.verksamhetsbeskrivning
    : orgInfo.verksamhetsbeskrivning?.text;
  const sig = typeof orgInfo.firmateckning === 'string'
    ? orgInfo.firmateckning
    : orgInfo.firmateckning?.text;
  const names = (orgInfo.samtligaOrganisationsnamn ?? []).filter((n) => n.namn);
  const permits = (orgInfo.tillstand ?? []);
  const markings = (orgInfo.organisationsmarkeringar ?? []);
  const vacancies = (orgInfo.vakanserOchUpplysningar ?? []);
  const bestammelser = (orgInfo.bestammelser ?? []);
  const foreign = orgInfo.utlandskFilialagandeOrganisation;
  const kommun = orgInfo.hemvistkommun;

  const hasShareInfo = share && !share.fel;
  const hasFy = fy && !fy.fel;

  return (
    <SectionCard title="Företagsinformation / v4" badge={<SourceBadge label="Företagsinformation API" color="teal" />}>
      <div className="space-y-5">
        {/* Business description */}
        {desc && (
          <div>
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-widest text-slate-500">Business Description</h3>
            <p className="text-sm text-slate-300 leading-relaxed">{desc}</p>
          </div>
        )}

        {/* Signatory */}
        {sig && (
          <div>
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-widest text-slate-500">Signatory (Firmateckning)</h3>
            <p className="text-sm text-slate-300">{sig}</p>
          </div>
        )}

        {/* Municipality */}
        {kommun?.kommunnamn && (
          <div>
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-widest text-slate-500">Municipality</h3>
            <p className="text-sm text-slate-300">{kommun.kommunnamn}{kommun.kommunkod ? ` (${kommun.kommunkod})` : ''}</p>
          </div>
        )}

        {/* Share capital */}
        {hasShareInfo && (
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-500">Share Capital</h3>
            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Row label="Share capital (SEK)" value={fmtNum(share!.aktiekapital)} />
              <Row label="Number of shares" value={fmtNum(share!.antalAktier)} />
              <Row label="Quota value" value={share!.kvotvarde != null ? fmtNum(share!.kvotvarde) : null} />
              {share!.aktiekapitalMin != null && <Row label="Min capital" value={fmtNum(share!.aktiekapitalMin)} />}
              {share!.aktiekapitalMax != null && <Row label="Max capital" value={fmtNum(share!.aktiekapitalMax)} />}
              <Row label="Registered" value={fmt(share!.registreringsdatum)} />
            </dl>
            {share!.aktieslag && share!.aktieslag.length > 0 && (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs uppercase tracking-widest text-slate-500">
                      <th className="pb-1.5 pr-4">Share class</th>
                      <th className="pb-1.5 pr-4">Shares</th>
                      <th className="pb-1.5 pr-4">Capital (SEK)</th>
                      <th className="pb-1.5">Vote weight</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {share!.aktieslag!.map((s, i) => (
                      <tr key={i}>
                        <td className="py-1.5 pr-4 text-white">{s.aktieslagsnamn ?? '—'}</td>
                        <td className="py-1.5 pr-4 text-slate-300">{fmtNum(s.antalAktier)}</td>
                        <td className="py-1.5 pr-4 text-slate-300">{fmtNum(s.aktiekapital)}</td>
                        <td className="py-1.5 text-slate-400">{s.rostvarde != null ? fmtNum(s.rostvarde) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Financial year */}
        {hasFy && (
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-500">Financial Year (Räkenskapsår)</h3>
            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Row label="Starts" value={fy!.rakenskapsarInleds} />
              <Row label="Ends" value={fy!.rakenskapsarAvslutas} />
              {fy!.forstaRakenskapsarInleds && <Row label="First year starts" value={fy!.forstaRakenskapsarInleds} />}
              {fy!.forstaRakenskapsarAvslutas && <Row label="First year ends" value={fy!.forstaRakenskapsarAvslutas} />}
            </dl>
          </div>
        )}

        {/* Registered names */}
        {names.length > 0 && (
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-500">All Registered Names</h3>
            <ul className="space-y-1">
              {names.map((n, i) => (
                <li key={i} className="flex flex-wrap items-center gap-2 text-sm">
                  {n.namnstyp && <span className="rounded bg-slate-700 px-1.5 py-0.5 text-xs text-slate-400">{n.namnstyp}</span>}
                  <span className="text-white">{n.namn}</span>
                  {n.registreringsdatum && <span className="text-xs text-slate-500">reg. {fmt(n.registreringsdatum)}</span>}
                  {n.avregistreringsdatum && <span className="text-xs text-red-400">avr. {fmt(n.avregistreringsdatum)}</span>}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Officers */}
        {orgInfo.funktionarer && orgInfo.funktionarer.length > 0 && (
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-500">Officers (Funktionärer)</h3>
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
                  {orgInfo.funktionarer!.map((o, i) => (
                    <tr key={i}>
                      <td className="py-2 pr-4 text-white">{o.namn ?? '—'}</td>
                      <td className="py-2 pr-4 text-slate-300">
                        {formatRoles(o.roller)}
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

        {/* Permits */}
        {permits.length > 0 && (
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-500">Permits & Licences (Tillstånd)</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-widest text-slate-500">
                    <th className="pb-1.5 pr-4">Type</th>
                    <th className="pb-1.5 pr-4">Number</th>
                    <th className="pb-1.5 pr-4">Status</th>
                    <th className="pb-1.5 pr-4">Valid</th>
                    <th className="pb-1.5">Issuer</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {permits.map((p, i) => (
                    <tr key={i}>
                      <td className="py-1.5 pr-4 text-white">{p.tillstandstyp ?? '—'}</td>
                      <td className="py-1.5 pr-4 text-slate-300 font-mono text-xs">{p.tillstandsnummer ?? '—'}</td>
                      <td className="py-1.5 pr-4 text-slate-300">{p.tillstandsstatus ?? '—'}</td>
                      <td className="py-1.5 pr-4 text-slate-400 text-xs">{fmt(p.giltigFran)} – {fmt(p.giltigTom)}</td>
                      <td className="py-1.5 text-slate-400 text-xs">{p.utfardareNamn ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Organisation markings */}
        {markings.length > 0 && (
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-500">Organisation Markings</h3>
            <ul className="space-y-1">
              {markings.map((m, i) => (
                <li key={i} className="flex flex-wrap items-center gap-2 text-sm">
                  {m.markeringstyp && <span className="rounded bg-slate-700 px-1.5 py-0.5 text-xs text-slate-400">{m.markeringstyp}</span>}
                  {m.text && <span className="text-slate-300">{m.text}</span>}
                  {m.markeringsdatum && <span className="text-xs text-slate-500">{fmt(m.markeringsdatum)}</span>}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Vacancies / notices */}
        {vacancies.length > 0 && (
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-500">Vacancies & Notices</h3>
            <ul className="space-y-1">
              {vacancies.map((v, i) => (
                <li key={i} className="text-sm text-slate-300">
                  {v.typ && <span className="mr-2 rounded bg-slate-700 px-1.5 py-0.5 text-xs text-slate-400">{v.typ}</span>}
                  {v.text ?? '—'}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Provisions */}
        {bestammelser.length > 0 && (
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-500">Provisions (Bestämmelser)</h3>
            <ul className="space-y-1">
              {bestammelser.map((b, i) => (
                <li key={i} className="text-sm text-slate-300">
                  {b.bestammelsetyp && <span className="mr-2 rounded bg-slate-700 px-1.5 py-0.5 text-xs text-slate-400">{b.bestammelsetyp}</span>}
                  {b.text ?? '—'}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Foreign branch */}
        {foreign?.utlandskOrganisationNamn && (
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-500">Foreign Branch Owner</h3>
            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Row label="Name" value={foreign.utlandskOrganisationNamn} />
              <Row label="Org. ID" value={foreign.utlandskOrganisationIdentitetsbeteckning} />
              <Row label="Country" value={foreign.utlandskOrganisationLand} />
            </dl>
          </div>
        )}
      </div>
    </SectionCard>
  );
}

// ─── Section: Annual Reports ──────────────────────────────────────────────────

function AnnualReportsSection({ reports, hvdDocs, downloadingId, onDownload }: {
  reports: BvFinansiellRapport[];
  hvdDocs: BvDokument[];
  downloadingId: string | null;
  onDownload: (doc: BvDokument) => void;
}) {
  // Merge: reports from Företagsinformation (have period info + maybe dokumentId)
  // plus any HVD docs not already referenced by a report
  const reportDocIds = new Set(reports.map((r) => r.dokumentId).filter(Boolean));
  const extraHvdDocs = hvdDocs.filter((d) => d.dokumentId && !reportDocIds.has(d.dokumentId));

  return (
    <SectionCard title="Annual Reports">
      <div className="space-y-6">
        {/* Reports from Företagsinformation */}
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
                        {r.rapporteringsperiodFran ? `${fmt(r.rapporteringsperiodFran)} – ${fmt(r.rapporteringsperiodTom)}` : fmt(r.rapporteringsperiodTom)}
                      </td>
                      <td className="py-2 pr-4 text-slate-400 text-xs">{fmt(r.registreringsdatum)}</td>
                      <td className="py-2">
                        {r.dokumentId
                          ? <DownloadButton doc={{ dokumentId: r.dokumentId }} downloadingId={downloadingId} onDownload={onDownload} />
                          : <span className="text-slate-500">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Downloadable files from HVD (extra ones not covered above) */}
        {(hvdDocs.length > 0) && (
          <div>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500 flex items-center gap-2">
              Downloadable Files
              <SourceBadge label="HVD" color="violet" />
              {extraHvdDocs.length < hvdDocs.length && (
                <span className="text-slate-600">({hvdDocs.length} total, {extraHvdDocs.length} additional)</span>
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
                  {hvdDocs.map((doc, i) => (
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
                        <DownloadButton doc={doc} downloadingId={downloadingId} onDownload={onDownload} />
                      </td>
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

// ─── Page ────────────────────────────────────────────────────────────────────

export default function BolagsverketPage() {
  const [identifier, setIdentifier] = useState('');
  const [touched, setTouched] = useState(false);
  const [forceRefresh, setForceRefresh] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enrichResult, setEnrichResult] = useState<EnrichResult | null>(null);
  const [snapshots, setSnapshots] = useState<SnapshotRow[]>([]);
  const [hvdDocs, setHvdDocs] = useState<BvDokument[]>([]);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

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
    setHvdDocs([]);

    try {
      const stripped = normaliseIdentifier(identifier.trim());
      const isPerson = classifyIdentifier(stripped) === 'personnummer';

      let result: EnrichResult;
      if (isPerson) {
        result = await api.bolagsverket.enrichPerson({ personnummer: stripped, forceRefresh });
      } else {
        result = await api.bolagsverket.enrich({ identitetsbeteckning: stripped, forceRefresh });
      }
      setEnrichResult(result);

      // Snapshots + HVD document list in parallel (org only)
      const tasks: Promise<void>[] = [
        api.bolagsverket.getSnapshots(stripped).then((d) => {
          setSnapshots(Array.isArray(d) ? d.slice(0, 5) : []);
        }),
      ];
      if (!isPerson) {
        tasks.push(
          api.bolagsverket.documentList(stripped)
            .then((d) => setHvdDocs(d?.dokument ?? []))
            .catch(() => {
              // Document list is best-effort; backend may not have HVD access yet
            }),
        );
      }
      await Promise.all(tasks);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message
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
    setDownloadError(null);
    try {
      const { blob, fileName } = await api.bolagsverket.downloadDocument(doc.dokumentId);
      triggerDownload(blob, fileName);
    } catch {
      setDownloadError('Download failed. Please try again.');
    } finally {
      setDownloadingId(null);
    }
  }, []);

  const nd = enrichResult?.result?.normalisedData;
  const hvd = enrichResult?.result?.highValueDataset;
  const orgInfoArray = enrichResult?.result?.organisationInformation ?? [];
  const orgInfo = orgInfoArray[0];
  const isFromCache = enrichResult?.isFromCache;
  const ageInDays = enrichResult?.ageInDays;

  // Reports from Företagsinformation (have richer period data + dokumentId)
  const financialReports: BvFinansiellRapport[] = orgInfo?.finansiellaRapporter ?? [];

  // Show annual reports section if we have any data
  const hasReports = financialReports.length > 0 || hvdDocs.length > 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Bolagsverket Lookup</h1>
        <p className="mt-1 text-sm text-slate-400">
          Fetches data from both <span className="text-violet-400 font-medium">Värdefulla Datamängder</span> and{' '}
          <span className="text-teal-400 font-medium">Företagsinformation/v4</span>. Data is cached for 30 days.
        </p>
      </div>

      {/* Search form */}
      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label htmlFor="bv-identifier-input" className="mb-1 block text-xs uppercase tracking-widest text-slate-400">
              Organisation / Person number
            </label>
            <input
              id="bv-identifier-input" type="text" value={identifier}
              onChange={(e) => { setIdentifier(e.target.value); }}
              onBlur={() => setTouched(true)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="5560000001  or  197001011234"
              autoComplete="off" spellCheck={false}
              className={[
                'w-full rounded-xl border bg-background px-4 py-2.5 text-sm text-white placeholder-slate-500 transition',
                'focus:outline-none focus:ring-2',
                validationError ? 'border-red-500 focus:ring-red-500/50'
                  : isValid ? 'border-emerald-500 focus:ring-emerald-500/50'
                  : 'border-border focus:ring-indigo-500',
              ].join(' ')}
            />
            {validationError && <p className="mt-1.5 text-xs text-red-400">{validationError}</p>}
            {!validationError && isValid && (
              <p className="mt-1.5 text-xs text-emerald-400">✓ Valid {IDENTIFIER_TYPE_LABELS[identifierType]}</p>
            )}
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-300">
            <input type="checkbox" checked={forceRefresh} onChange={(e) => setForceRefresh(e.target.checked)} className="rounded" />
            Force Refresh
          </label>
          <button
            onClick={handleSearch} disabled={loading || !identifier.trim()}
            className="rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? 'Searching…' : 'Search'}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-red-700 bg-red-900/30 p-4 text-sm text-red-300">{error}</div>
      )}
      {downloadError && (
        <div className="rounded-xl border border-red-700 bg-red-900/30 p-4 text-sm text-red-300">{downloadError}</div>
      )}

      {/* Results */}
      {nd && (
        <div className="space-y-6">
          {/* Cache / freshness badge */}
          <div className="flex flex-wrap items-center gap-3">
            {isFromCache
              ? <span className="rounded-full bg-emerald-800/60 px-3 py-1 text-xs font-medium text-emerald-300">✓ From cache (age: {ageInDays} days)</span>
              : <span className="rounded-full bg-blue-800/60 px-3 py-1 text-xs font-medium text-blue-300">↻ Fresh from API</span>}
            {nd.sourcePayloadSummary?.hasHighValueDataset && (
              <span className="rounded-full bg-violet-800/50 px-3 py-1 text-xs font-medium text-violet-300">✓ HVD</span>
            )}
            {nd.sourcePayloadSummary?.hasRichOrganisationInformation && (
              <span className="rounded-full bg-teal-800/50 px-3 py-1 text-xs font-medium text-teal-300">✓ Företagsinformation</span>
            )}
            {enrichResult?.result?.retrievedAt && (
              <span className="text-xs text-slate-500">Retrieved: {new Date(enrichResult.result.retrievedAt).toLocaleString()}</span>
            )}
          </div>

          {/* Company Overview (merged) */}
          <SectionCard title="Company Overview">
            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Row label="Organisation Number" value={nd.organisationNumber} />
              <Row label="Legal Name" value={nd.legalName} />
              <Row label="Company Form" value={nd.companyForm} />
              <Row label="Status" value={nd.status} />
              <Row label="Registered" value={nd.registeredAt ? new Date(nd.registeredAt).toLocaleDateString('sv-SE') : null} />
              <Row label="Deregistered" value={nd.deregisteredAt ? new Date(nd.deregisteredAt).toLocaleDateString('sv-SE') : null} />
              <Row label="Industry Code" value={nd.industryCode} />
              <Row label="Country" value={nd.countryCode} />
            </dl>
          </SectionCard>

          {/* Field errors */}
          {nd.fieldErrors && nd.fieldErrors.length > 0 && (
            <div className="rounded-2xl border border-yellow-700/50 bg-yellow-900/20 p-4">
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-widest text-yellow-400">
                ⚠ Partial Data — {nd.fieldErrors.length} field error{nd.fieldErrors.length !== 1 ? 's' : ''}
              </h2>
              <ul className="space-y-1">
                {nd.fieldErrors.map((fe, i) => (
                  <li key={i} className="flex items-center gap-2 text-xs text-yellow-300">
                    <span className="rounded bg-yellow-800/60 px-1.5 py-0.5 font-mono">{fe.field}</span>
                    <span className="text-yellow-500">{fe.errorType}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* HVD section */}
          {hvd && <HvdSection hvd={hvd} />}

          {/* Företagsinformation section */}
          {orgInfo && <ForetagsinfSection orgInfo={orgInfo} />}

          {/* Annual Reports (merged from both APIs) */}
          {hasReports && (
            <AnnualReportsSection
              reports={financialReports}
              hvdDocs={hvdDocs}
              downloadingId={downloadingId}
              onDownload={handleDownload}
            />
          )}
        </div>
      )}

      {/* Snapshots */}
      {snapshots.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-slate-400">Recent Snapshots</h2>
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
                    <td className="py-2 pr-4 text-slate-300">{new Date(s.fetchedAt).toLocaleString()}</td>
                    <td className="py-2 pr-4">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        s.fetchStatus === 'success' ? 'bg-emerald-900/50 text-emerald-300'
                          : s.fetchStatus === 'error' ? 'bg-red-900/50 text-red-300'
                          : 'bg-yellow-900/50 text-yellow-300'}`}>
                        {s.fetchStatus}
                      </span>
                    </td>
                    <td className="py-2 pr-4 text-slate-400">{s.isFromCache ? 'cache' : 'api'}</td>
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

'use client';

import Link from 'next/link';
import { useState } from 'react';
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
interface MappedAddress { adresstyp: string | null; gatuadress: string | null; postnummer: string | null; postort: string | null; land: string | null }
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

// ─── Shared display helpers ───────────────────────────────────────────────────

function fmt(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  try { return new Date(dateStr).toLocaleDateString('sv-SE'); } catch { return dateStr; }
}

function fmtNum(n: number | null | undefined): string {
  if (n == null) return '—';
  return n.toLocaleString('sv-SE');
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
  return (
    <div className="rounded-xl bg-slate-800/40 px-4 py-3 text-sm">
      {addr.adresstyp && (
        <span className="mb-1 inline-block rounded bg-slate-700 px-1.5 py-0.5 text-xs text-slate-300">{addr.adresstyp}</span>
      )}
      <p className="text-white">{addr.gatuadress ?? '—'}</p>
      <p className="text-slate-400">{[addr.postnummer, addr.postort, addr.land].filter(Boolean).join(', ') || '—'}</p>
    </div>
  );
}

// [UNCHANGED: HvdDataSection, V4DataSection, AnnualReportsSection, etc.]

export default function CompanyProfilePage() {
  const params = useParams();
  const orgNumber = typeof params.orgNumber === 'string' ? params.orgNumber : '';

  const { user } = useAuth();
  const canViewSensitive = ['admin', 'audit', 'evidence', 'compliance'].includes(user?.role ?? '');
  const [snapshotLimit, setSnapshotLimit] = useState(10);

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

  const displayName =
    company?.legalName ??
    hvdSection?.namn ??
    v4Section?.organisationsnamn ??
    'Unknown Company';

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

          {/* ... rest of file unchanged ... */}

          {/* Annual reports (HVD dokumentlista) */}
          {documentList && documentList.length > 0 && (
            <AnnualReportsSection documents={documentList} />
          )}

          {/* ... rest unchanged ... */}
        </>
      )}
    </div>
  );
}

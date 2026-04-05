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

// ─── Structured section types (mirrors backend NormalisedCompany sections) ───

interface MappedName { namn: string | null; namnstyp: string | null; sprak: string | null; registreringsdatum: string | null; avregistreringsdatum: string | null }
interface MappedAddress { adresstyp: string | null; gatuadress: string | null; postnummer: string | null; postort: string | null; land: string | null }
interface MappedStatus { status: string | null; statusdatum: string | null }
interface MappedIndustryCode { snikod: string | null; snikodText: string | null }
interface MappedOfficer {
  namn: string | null; personId: string | null; fodelseAr: string | null; nationalitet: string | null;
  roller: Array<{ rollkod: string | null; rollbeskrivning: string | null; rollstatus: string | null; fran: string | null; tom: string | null }>;
}

interface HvdStructuredSection {
  identitetsbeteckning: string | null; namn: string | null; names: MappedName[];
  juridiskForm: string | null; organisationsform: string | null; organisationsdatum: string | null; registreringsdatum: string | null;
  verksamhetsbeskrivning: string | null; naringsgren: MappedIndustryCode[]; statusar: MappedStatus[];
  adresser: MappedAddress[]; postadressOrganisation: MappedAddress | null;
  reklamsparr: string | null; avregistreradOrganisation: string | null;
  avregistreringsorsak: string | null; avregistreringsdatum: string | null;
  pagaendeAvvecklingsEllerOmstruktureringsforfarande: string | null;
  verksamOrganisation: string | null; registreringsland: string | null; organisationsidentitet: string | null;
  rekonstruktionsstatus: string | null; rekonstruktionsdatum: string | null;
}

interface V4StructuredSection {
  identitetsbeteckning: string | null; organisationsnamn: string | null; organisationsform: string | null;
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

// ─── HVD Section ─────────────────────────────────────────────────────────────

function HvdDataSection({ hvd }: { hvd: HvdStructuredSection }) {
  return (
    <SectionCard title="Värdefulla datamängder (HVD)" badge={<SourceBadge label="HVD API" color="violet" />}>
      <div className="space-y-5">
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Row label="Organisation number" value={hvd.identitetsbeteckning} />
          <Row label="Legal name" value={hvd.namn} />
          <Row label="Legal form (Juridisk form)" value={hvd.juridiskForm} />
          <Row label="Company form" value={hvd.organisationsform} />
          <Row label="Organisation date" value={fmt(hvd.organisationsdatum)} />
          <Row label="Registered" value={fmt(hvd.registreringsdatum)} />
          <Row label="Country" value={hvd.registreringsland} />
          <Row label="External identity" value={hvd.organisationsidentitet} />
          <Row label="Active (Verksam)" value={hvd.verksamOrganisation} />
          <Row label="Marketing opt-out" value={hvd.reklamsparr} />
          <Row label="Deregistered" value={hvd.avregistreradOrganisation} />
          {(hvd.avregistreringsdatum || hvd.avregistreringsorsak) && (
            <>
              <Row label="Deregistration date" value={fmt(hvd.avregistreringsdatum)} />
              <Row label="Deregistration reason" value={hvd.avregistreringsorsak} />
            </>
          )}
          {hvd.pagaendeAvvecklingsEllerOmstruktureringsforfarande && (
            <Row label="Pending winding-up / restructuring" value={hvd.pagaendeAvvecklingsEllerOmstruktureringsforfarande} />
          )}
          {(hvd.rekonstruktionsstatus || hvd.rekonstruktionsdatum) && (
            <Row label="Restructuring status" value={`${hvd.rekonstruktionsstatus ?? ''}${hvd.rekonstruktionsdatum ? ` (${fmt(hvd.rekonstruktionsdatum)})` : ''}`.trim() || null} />
          )}
        </dl>

        {hvd.verksamhetsbeskrivning && (
          <div>
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-widest text-slate-500">Business description</h3>
            <p className="text-sm text-slate-300 leading-relaxed">{hvd.verksamhetsbeskrivning}</p>
          </div>
        )}

        {hvd.statusar.length > 0 && (
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-500">Status history</h3>
            <div className="flex flex-wrap gap-2">
              {hvd.statusar.map((s, i) => (
                <span key={i} className="rounded-full bg-slate-700/60 px-3 py-1 text-xs text-slate-300">
                  {s.status ?? '—'}{s.statusdatum ? ` · ${fmt(s.statusdatum)}` : ''}
                </span>
              ))}
            </div>
          </div>
        )}

        {hvd.naringsgren.length > 0 && (
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-500">Industry codes (SNI)</h3>
            <div className="space-y-1">
              {hvd.naringsgren.map((c, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <span className="rounded bg-slate-700 px-1.5 py-0.5 font-mono text-xs text-slate-300">{c.snikod}</span>
                  <span className="text-slate-300">{c.snikodText ?? '—'}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {hvd.names.length > 0 && (
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-500">Registered names</h3>
            <ul className="space-y-1">
              {hvd.names.map((n, i) => (
                <li key={i} className="flex flex-wrap items-center gap-2 text-sm">
                  {n.namnstyp && <span className="rounded bg-slate-700 px-1.5 py-0.5 text-xs text-slate-400">{n.namnstyp}</span>}
                  <span className="text-white">{n.namn ?? '—'}</span>
                  {n.registreringsdatum && <span className="text-xs text-slate-500">reg. {fmt(n.registreringsdatum)}</span>}
                  {n.avregistreringsdatum && <span className="text-xs text-red-400">avr. {fmt(n.avregistreringsdatum)}</span>}
                </li>
              ))}
            </ul>
          </div>
        )}

        {(hvd.adresser.length > 0 || hvd.postadressOrganisation) && (
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-500">Addresses</h3>
            <div className="space-y-2">
              {hvd.postadressOrganisation && (
                <AddressCard addr={{ ...hvd.postadressOrganisation, adresstyp: hvd.postadressOrganisation.adresstyp ?? 'Postadress' }} />
              )}
              {hvd.adresser.map((a, i) => <AddressCard key={i} addr={a} />)}
            </div>
          </div>
        )}
      </div>
    </SectionCard>
  );
}

// ─── V4 Section ───────────────────────────────────────────────────────────────

function V4DataSection({ v4 }: { v4: V4StructuredSection }) {
  const hasFy = !!v4.rakenskapsar;
  const hasShare = !!v4.aktieinformation;
  return (
    <SectionCard title="Företagsinformation (v4)" badge={<SourceBadge label="Företagsinformation API" color="teal" />}>
      <div className="space-y-5">
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Row label="Organisation number" value={v4.identitetsbeteckning} />
          <Row label="Name" value={v4.organisationsnamn} />
          <Row label="Company form" value={v4.organisationsform} />
          <Row label="Organisation date" value={fmt(v4.organisationsdatum)} />
          <Row label="Registered" value={fmt(v4.registreringsdatum)} />
          {v4.hemvistkommun && (
            <Row label="Municipality" value={v4.hemvistkommun.kommunnamn ? `${v4.hemvistkommun.kommunnamn}${v4.hemvistkommun.kommunkod ? ` (${v4.hemvistkommun.kommunkod})` : ''}` : null} />
          )}
        </dl>

        {v4.verksamhetsbeskrivning && (
          <div>
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-widest text-slate-500">Business description</h3>
            <p className="text-sm text-slate-300 leading-relaxed">{v4.verksamhetsbeskrivning}</p>
          </div>
        )}

        {v4.firmateckning && (
          <div>
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-widest text-slate-500">Signatory (Firmateckning)</h3>
            <p className="text-sm text-slate-300">{v4.firmateckning}</p>
            {v4.firmateckningstyp && <p className="mt-0.5 text-xs text-slate-500">{v4.firmateckningstyp}</p>}
          </div>
        )}

        {v4.organisationsstatusar.length > 0 && (
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-500">Status history</h3>
            <div className="flex flex-wrap gap-2">
              {v4.organisationsstatusar.map((s, i) => (
                <span key={i} className="rounded-full bg-slate-700/60 px-3 py-1 text-xs text-slate-300">
                  {s.status ?? '—'}{s.statusdatum ? ` · ${fmt(s.statusdatum)}` : ''}
                </span>
              ))}
            </div>
          </div>
        )}

        {hasFy && (
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-500">Financial year (Räkenskapsår)</h3>
            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Row label="Financial year starts" value={v4.rakenskapsar!.rakenskapsarInleds} />
              <Row label="Financial year ends" value={v4.rakenskapsar!.rakenskapsarAvslutas} />
              {v4.rakenskapsar!.forstaRakenskapsarInleds && <Row label="First year starts" value={v4.rakenskapsar!.forstaRakenskapsarInleds} />}
              {v4.rakenskapsar!.forstaRakenskapsarAvslutas && <Row label="First year ends" value={v4.rakenskapsar!.forstaRakenskapsarAvslutas} />}
            </dl>
          </div>
        )}

        {hasShare && (
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-500">Share capital</h3>
            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Row label="Share capital (SEK)" value={fmtNum(v4.aktieinformation!.aktiekapital)} />
              <Row label="Number of shares" value={fmtNum(v4.aktieinformation!.antalAktier)} />
              <Row label="Quota value" value={v4.aktieinformation!.kvotvarde != null ? fmtNum(v4.aktieinformation!.kvotvarde) : null} />
              {v4.aktieinformation!.aktiekapitalMin != null && <Row label="Min capital" value={fmtNum(v4.aktieinformation!.aktiekapitalMin)} />}
              {v4.aktieinformation!.aktiekapitalMax != null && <Row label="Max capital" value={fmtNum(v4.aktieinformation!.aktiekapitalMax)} />}
              <Row label="Registered" value={fmt(v4.aktieinformation!.registreringsdatum)} />
            </dl>
            {v4.aktieinformation!.aktieslag.length > 0 && (
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
                    {v4.aktieinformation!.aktieslag.map((s, i) => (
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

        {v4.samtligaOrganisationsnamn.length > 0 && (
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-500">All registered names</h3>
            <ul className="space-y-1">
              {v4.samtligaOrganisationsnamn.map((n, i) => (
                <li key={i} className="flex flex-wrap items-center gap-2 text-sm">
                  {n.namnstyp && <span className="rounded bg-slate-700 px-1.5 py-0.5 text-xs text-slate-400">{n.namnstyp}</span>}
                  <span className="text-white">{n.namn ?? '—'}</span>
                  {n.registreringsdatum && <span className="text-xs text-slate-500">reg. {fmt(n.registreringsdatum)}</span>}
                  {n.avregistreringsdatum && <span className="text-xs text-red-400">avr. {fmt(n.avregistreringsdatum)}</span>}
                </li>
              ))}
            </ul>
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
                    <th className="pb-2 pr-4">Role(s)</th>
                    <th className="pb-2 pr-4">Born</th>
                    <th className="pb-2">Nationality</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {v4.funktionarer.map((o, i) => (
                    <tr key={i}>
                      <td className="py-2 pr-4 text-white">{o.namn ?? '—'}</td>
                      <td className="py-2 pr-4 text-slate-300">
                        {o.roller.map((r) => r.rollbeskrivning ?? r.rollkod ?? '').filter(Boolean).join(', ') || '—'}
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

        {v4.adresser.length > 0 && (
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-500">Addresses</h3>
            <div className="space-y-2">
              {v4.adresser.map((a, i) => <AddressCard key={i} addr={a} />)}
            </div>
          </div>
        )}

        {v4.tillstand.length > 0 && (
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-500">Permits & licences (Tillstånd)</h3>
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
                  {v4.tillstand.map((p, i) => (
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

        {v4.finansiellaRapporter.length > 0 && (
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-500">Financial reports</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-widest text-slate-500">
                    <th className="pb-2 pr-4">Report type</th>
                    <th className="pb-2 pr-4">Period</th>
                    <th className="pb-2">Registered</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {v4.finansiellaRapporter.map((r, i) => (
                    <tr key={i}>
                      <td className="py-2 pr-4 text-white">{r.rapporttyp ?? '—'}</td>
                      <td className="py-2 pr-4 text-slate-300">
                        {r.rapporteringsperiodFran ? `${fmt(r.rapporteringsperiodFran)} – ${fmt(r.rapporteringsperiodTom)}` : fmt(r.rapporteringsperiodTom)}
                      </td>
                      <td className="py-2 text-slate-400 text-xs">{fmt(r.registreringsdatum)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {v4.organisationsmarkeringar.length > 0 && (
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-500">Organisation markings</h3>
            <ul className="space-y-1">
              {v4.organisationsmarkeringar.map((m, i) => (
                <li key={i} className="flex flex-wrap items-center gap-2 text-sm">
                  {m.markeringstyp && <span className="rounded bg-slate-700 px-1.5 py-0.5 text-xs text-slate-400">{m.markeringstyp}</span>}
                  {m.text && <span className="text-slate-300">{m.text}</span>}
                  {m.markeringsdatum && <span className="text-xs text-slate-500">{fmt(m.markeringsdatum)}</span>}
                </li>
              ))}
            </ul>
          </div>
        )}

        {v4.bestammelser.length > 0 && (
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-500">Provisions (Bestämmelser)</h3>
            <ul className="space-y-1">
              {v4.bestammelser.map((b, i) => (
                <li key={i} className="text-sm text-slate-300">
                  {b.bestammelsetyp && <span className="mr-2 rounded bg-slate-700 px-1.5 py-0.5 text-xs text-slate-400">{b.bestammelsetyp}</span>}
                  {b.text ?? '—'}
                </li>
              ))}
            </ul>
          </div>
        )}

        {v4.vakanserOchUpplysningar.length > 0 && (
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-500">Vacancies & notices</h3>
            <ul className="space-y-1">
              {v4.vakanserOchUpplysningar.map((v, i) => (
                <li key={i} className="text-sm text-slate-300">
                  {v.typ && <span className="mr-2 rounded bg-slate-700 px-1.5 py-0.5 text-xs text-slate-400">{v.typ}</span>}
                  {v.text ?? '—'}
                </li>
              ))}
            </ul>
          </div>
        )}

        {v4.utlandskFilialagandeOrganisation?.utlandskOrganisationNamn && (
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-500">Foreign branch owner</h3>
            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Row label="Name" value={v4.utlandskFilialagandeOrganisation.utlandskOrganisationNamn} />
              <Row label="Org. ID" value={v4.utlandskFilialagandeOrganisation.utlandskOrganisationIdentitetsbeteckning} />
              <Row label="Country" value={v4.utlandskFilialagandeOrganisation.utlandskOrganisationLand} />
            </dl>
          </div>
        )}

        {v4.ekonomiskPlan && (
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-500">Economic plan</h3>
            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Row label="Type" value={v4.ekonomiskPlan.plantyp} />
              <Row label="Approved" value={fmt(v4.ekonomiskPlan.godkandDatum)} />
              <Row label="Registered" value={fmt(v4.ekonomiskPlan.registreringsdatum)} />
            </dl>
          </div>
        )}
      </div>
    </SectionCard>
  );
}

// ─── Annual Reports Section ───────────────────────────────────────────────────

function AnnualReportsSection({ documents }: { documents: BvDokument[] }) {
  const [downloading, setDownloading] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  async function handleDownload(doc: BvDokument) {
    if (!doc.dokumentId) return;
    setDownloading(doc.dokumentId);
    setDownloadError(null);
    try {
      const { blob, fileName } = await api.bolagsverket.downloadDocument(doc.dokumentId);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Download failed. Please try again.';
      setDownloadError(msg);
    } finally {
      setDownloading(null);
    }
  }

  return (
    <SectionCard
      title="Årsredovisningar (Annual Reports)"
      badge={<SourceBadge label="HVD API" color="violet" />}
    >
      {downloadError && (
        <div className="mb-4 rounded-xl border border-red-700 bg-red-900/30 px-4 py-3 text-sm text-red-300">
          {downloadError}
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-widest text-slate-500">
              <th className="pb-2 pr-4">Report period</th>
              <th className="pb-2 pr-4">Type</th>
              <th className="pb-2 pr-4">Format</th>
              <th className="pb-2 pr-4">Registered</th>
              <th className="pb-2">Download</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {documents.map((doc, i) => {
              const isLoading = downloading === doc.dokumentId;
              const period = doc.rapporteringsperiodTom
                ? new Date(doc.rapporteringsperiodTom).getFullYear().toString()
                : '—';
              const registered = fmt(doc.registreringstidpunkt);
              return (
                <tr key={doc.dokumentId ?? i}>
                  <td className="py-2 pr-4 text-white font-medium">{period}</td>
                  <td className="py-2 pr-4 text-slate-300">{doc.dokumenttyp ?? '—'}</td>
                  <td className="py-2 pr-4">
                    {doc.filformat && (
                      <span className="rounded bg-slate-700 px-1.5 py-0.5 text-xs text-slate-300 uppercase">
                        {doc.filformat}
                      </span>
                    )}
                    {!doc.filformat && <span className="text-slate-500">—</span>}
                  </td>
                  <td className="py-2 pr-4 text-slate-400 text-xs">{registered}</td>
                  <td className="py-2">
                    {doc.dokumentId ? (
                      <button
                        onClick={() => handleDownload(doc)}
                        disabled={!!downloading}
                        title={`Download annual report for ${period}`}
                        className="flex items-center gap-1.5 rounded-lg bg-violet-700/40 px-3 py-1.5 text-xs font-medium text-violet-200 transition hover:bg-violet-700/70 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isLoading ? (
                          <>
                            <svg className="h-3 w-3 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                            Downloading…
                          </>
                        ) : (
                          <>
                            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                            Download
                          </>
                        )}
                      </button>
                    ) : (
                      <span className="text-xs text-slate-500">N/A</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}

// ─── Skeleton helpers ─────────────────────────────────────────────────────────

function SkeletonBlock({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-slate-800 ${className ?? ''}`} />;
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="flex items-start gap-4">
          <SkeletonBlock className="h-14 w-14 shrink-0 rounded-xl" />
          <div className="flex-1 space-y-2">
            <SkeletonBlock className="h-7 w-48" />
            <SkeletonBlock className="h-4 w-32" />
          </div>
        </div>
      </div>
      {/* Tabs skeleton */}
      <SkeletonBlock className="h-10 w-full" />
      {/* Details skeleton */}
      <div className="rounded-2xl border border-border bg-card p-6">
        <SkeletonBlock className="mb-4 h-4 w-28" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* Static skeleton blocks - index key is stable since this list never reorders */}
        {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <SkeletonBlock className="h-3 w-20" />
              <SkeletonBlock className="h-4 w-32" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

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
            legalName={company.legalName}
            orgNumber={company.organisationNumber ?? orgNumber}
            status={company.status}
            countryCode={company.countryCode}
          />

          {/* Metadata row */}
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
              title={cooldownRemaining > 0 ? `Please wait ${cooldownRemaining}s before refreshing again` : 'Fetch fresh data from API (bypasses cache)'}
              aria-label="Refresh company data"
              className="flex items-center gap-2 rounded-xl bg-slate-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {refreshing ? (
                <>
                  <svg
                    className="h-4 w-4 animate-spin"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Refreshing…
                </>
              ) : cooldownRemaining > 0 ? (
                <>
                  <svg
                    className="h-4 w-4"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                  Refresh ({cooldownRemaining}s)
                </>
              ) : (
                <>
                  <svg
                    className="h-4 w-4"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                  Refresh
                </>
              )}
            </button>
          </div>

          {/* Tab navigation */}
          <TabNavigation />

          {/* Details grid */}
          <CompanyDetailsGrid
            orgNumber={company.organisationNumber ?? orgNumber}
            registeredAt={company.registeredAt}
            companyForm={company.companyForm}
            countryCode={company.countryCode}
            businessDescription={company.businessDescription}
          />

          {/* Värdefulla datamängder (HVD) section */}
          {hvdSection && <HvdDataSection hvd={hvdSection} />}

          {/* Företagsinformation v4 section */}
          {v4Section && <V4DataSection v4={v4Section} />}

          {/* Annual reports (HVD dokumentlista) */}
          {documentList && documentList.length > 0 && (
            <AnnualReportsSection documents={documentList} />
          )}

          <div className="grid gap-6 lg:grid-cols-3">
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
              events={changeEvents}
              loading={changeLoading}
              error={changeError}
              onRetry={retryChanges}
              canViewSensitive={canViewSensitive}
            />
          </div>

          <SnapshotHistoryPanel
            snapshots={snapshotHistory}
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

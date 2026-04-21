/**
 * Extract ownership-relevant edges from Bolagsverket Företagsinformation
 * organisation JSON (bv_parsed.fi_organisation_snapshots.raw_item).
 *
 * Bolagsverket does not expose full AB shareholder registers in FI; we ingest
 * partnership-style stakes (insats) and clearly delägare-like engagements.
 */

export type ExtractedOwnershipEdge = {
  dedupeKey: string;
  ownerType: 'person' | 'company';
  ownerName: string;
  ownerOrganisationNumber: string | null;
  ownerPersonnummer: string | null;
  ownedOrganisationNumber: string;
  ownedCompanyName: string;
  /** Legal / economic stake (e.g. HB insats as % of total when inferable). */
  ownershipPercentage: number | null;
  /** Voting / control % when distinct from legal stake (often null from FI). */
  controlPercentage: number | null;
  ownershipType: string;
  ownershipClass: string | null;
  rawEngagement: Record<string, unknown>;
};

const PARTNER_ROLE_HINTS = [
  'delägare',
  'komplementär',
  'bolagsman',
  'medlem',
  'delagare',
  'komplementar',
  'handelsbolag',
  'kommanditbolag',
];

function normDigits(s: string | undefined | null): string {
  return (s ?? '').replace(/\D/g, '');
}

function kodKlartextStr(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'object' && v !== null && 'klartext' in v) {
    const k = (v as { klartext?: unknown }).klartext;
    return typeof k === 'string' ? k : '';
  }
  return '';
}

function kodKlartextKod(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'object' && v !== null && 'kod' in v) {
    const k = (v as { kod?: unknown }).kod;
    return typeof k === 'string' ? k : '';
  }
  return '';
}

export function parseInsatsPercent(insats: unknown): number | null {
  if (insats == null) return null;
  const s = String(insats).trim();
  if (!s) return null;
  const mPct = s.match(/([\d.,]+)\s*%/);
  if (mPct) {
    const n = Number(mPct[1].replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  }
  const mPlain = s.match(/^([\d.,]+)\s*$/);
  if (mPlain) {
    const n = Number(mPlain[1].replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function collectRoleHints(funktionar: Record<string, unknown>): string {
  const parts: string[] = [];
  const roller = funktionar['funktionarsroller'];
  if (Array.isArray(roller)) {
    for (const r of roller) {
      if (r && typeof r === 'object') {
        parts.push(kodKlartextStr(r), kodKlartextKod(r));
      }
    }
  }
  const legacy = funktionar['roller'];
  if (Array.isArray(legacy)) {
    for (const r of legacy) {
      if (r && typeof r === 'object') {
        const o = r as Record<string, unknown>;
        parts.push(String(o['rollbeskrivning'] ?? ''), String(o['rollkod'] ?? ''));
      }
    }
  }
  return parts.join(' ').toLowerCase();
}

function looksLikePartnerRole(funktionar: Record<string, unknown>): boolean {
  const blob = `${collectRoleHints(funktionar)} ${String(funktionar['anteckning'] ?? '').toLowerCase()}`;
  return PARTNER_ROLE_HINTS.some((h) => blob.includes(h));
}

function identityOrgDigits(funktionar: Record<string, unknown>): string | null {
  const id = funktionar['identitet'];
  if (id && typeof id === 'object') {
    const o = id as Record<string, unknown>;
    const raw = o['identitetsbeteckning'];
    if (typeof raw === 'string') {
      const d = normDigits(raw);
      if (d.length === 10) return d;
      if (d.length === 12) return null;
      if (d.length >= 10) return d.slice(0, 10);
    }
  }
  const legacy = funktionar['identitetsbeteckning'];
  if (typeof legacy === 'string') {
    const d = normDigits(legacy);
    if (d.length === 10) return d;
  }
  return null;
}

function identityPersonDigits(funktionar: Record<string, unknown>): string | null {
  const id = funktionar['identitet'];
  if (id && typeof id === 'object') {
    const o = id as Record<string, unknown>;
    const raw = o['identitetsbeteckning'];
    if (typeof raw === 'string') {
      const d = normDigits(raw);
      if (d.length === 12) return d;
    }
  }
  const legacy = funktionar['identitetsbeteckning'];
  if (typeof legacy === 'string') {
    const d = normDigits(legacy);
    if (d.length === 12) return d;
  }
  return null;
}

function ownerDisplayName(funktionar: Record<string, unknown>): string {
  const pn = funktionar['personnamn'] as Record<string, unknown> | undefined;
  if (pn) {
    const fn = String(pn['fornamn'] ?? '').trim();
    const en = String(pn['efternamn'] ?? '').trim();
    const full = `${fn} ${en}`.trim();
    if (full) return full;
  }
  const on = funktionar['organisationsnamn'] as Record<string, unknown> | undefined;
  if (on && typeof on['namn'] === 'string' && on['namn'].trim()) return on['namn'].trim();
  if (typeof funktionar['namn'] === 'string' && funktionar['namn'].trim()) return funktionar['namn'].trim();
  return 'Okänd ägare';
}

function relatedOrgDigits(organisation: Record<string, unknown> | undefined): string | null {
  if (!organisation) return null;
  const id = organisation['identitet'];
  if (id && typeof id === 'object') {
    const raw = (id as Record<string, unknown>)['identitetsbeteckning'];
    if (typeof raw === 'string') {
      const d = normDigits(raw);
      if (d.length >= 10) return d.length === 10 ? d : d.slice(0, 10);
    }
  }
  const legacy = organisation['identitetsbeteckning'];
  if (typeof legacy === 'string') {
    const d = normDigits(legacy);
    if (d.length >= 10) return d.length === 10 ? d : d.slice(0, 10);
  }
  return null;
}

function getEngagementArray(rawItem: Record<string, unknown>): unknown[] {
  const oe = rawItem['organisationsengagemang'];
  if (!oe || typeof oe !== 'object' || Array.isArray(oe)) {
    return [];
  }
  const arr = (oe as Record<string, unknown>)['funktionarsOrganisationsengagemang'];
  return Array.isArray(arr) ? arr : [];
}

function subjectOrgFromRaw(rawItem: Record<string, unknown>, fallback: string): string {
  const id = rawItem['identitet'];
  if (id && typeof id === 'object') {
    const raw = (id as Record<string, unknown>)['identitetsbeteckning'];
    if (typeof raw === 'string') {
      const d = normDigits(raw);
      if (d.length >= 10) return d.length === 10 ? d : d.slice(0, 10);
    }
  }
  if (typeof rawItem['identitetsbeteckning'] === 'string') {
    const d = normDigits(rawItem['identitetsbeteckning']);
    if (d.length >= 10) return d.length === 10 ? d : d.slice(0, 10);
  }
  return normDigits(fallback).slice(0, 10) || fallback;
}

function subjectNameFromRaw(rawItem: Record<string, unknown>): string {
  const on = rawItem['organisationsnamn'] as Record<string, unknown> | undefined;
  if (on && typeof on['namn'] === 'string' && on['namn'].trim()) return on['namn'].trim();
  if (typeof rawItem['namn'] === 'string' && rawItem['namn'].trim()) return rawItem['namn'].trim();
  return '';
}

/**
 * Pull share-class context for lineage (legal share counts vs rostvarde strings).
 */
export function extractAktieslagVotingSummary(rawItem: Record<string, unknown>): Record<string, unknown> | null {
  const ai = rawItem['aktieinformation'] as Record<string, unknown> | undefined;
  if (!ai || typeof ai !== 'object') return null;
  const classes = ai['aktieslag'];
  if (!Array.isArray(classes) || classes.length === 0) return null;
  const rows = classes.map((c, i) => {
    const x = c as Record<string, unknown>;
    const antal = typeof x['antal'] === 'number' ? x['antal'] : x['antalAktier'];
    return {
      index: i,
      namn: x['namn'] ?? x['aktieslagsnamn'] ?? null,
      antal: typeof antal === 'number' ? antal : null,
      rostvarde: x['rostvarde'] ?? null,
    };
  });
  const totalAntal = rows.reduce((s, r) => s + (typeof r.antal === 'number' ? r.antal : 0), 0);
  return {
    totalAntalAktier: totalAntal || null,
    antalAktierCompany: ai['antalAktier'] ?? null,
    classes: rows,
  };
}

export function extractOwnershipEdgesFromFiOrganisationRaw(
  rawItem: Record<string, unknown>,
  organisationsnummer: string,
): ExtractedOwnershipEdge[] {
  const subject = subjectOrgFromRaw(rawItem, organisationsnummer);
  const ownedCompanyName = subjectNameFromRaw(rawItem) || subject;
  const engagements = getEngagementArray(rawItem);
  const out: ExtractedOwnershipEdge[] = [];

  let rank = 0;
  for (const raw of engagements) {
    rank += 1;
    if (!raw || typeof raw !== 'object') continue;
    const e = raw as Record<string, unknown>;
    const funktionar = e['funktionar'];
    if (!funktionar || typeof funktionar !== 'object') continue;
    const f = funktionar as Record<string, unknown>;
    const organisation = e['organisation'] as Record<string, unknown> | undefined;
    const rel = relatedOrgDigits(organisation);
    if (rel && rel !== subject) {
      continue;
    }

    const insPct = parseInsatsPercent(f['insats']);
    const partnerish = looksLikePartnerRole(f) || insPct != null;
    if (!partnerish) continue;

    const orgDigits = identityOrgDigits(f);
    const personDigits = identityPersonDigits(f);
    const ownerType: 'person' | 'company' = orgDigits ? 'company' : 'person';
    const ownerOrganisationNumber = orgDigits;
    const ownerPersonnummer = ownerType === 'person' ? personDigits : null;

    const ownerName = ownerDisplayName(f);
    const legalPct = insPct;
    const controlPct: number | null = null;

    const dedupeKey = `bv.fi.organisationsengagemang|${subject}|${rank}|${ownerType}|${ownerOrganisationNumber ?? ''}|${ownerPersonnummer ?? ''}|${ownerName}`;

    out.push({
      dedupeKey,
      ownerType,
      ownerName,
      ownerOrganisationNumber,
      ownerPersonnummer,
      ownedOrganisationNumber: subject,
      ownedCompanyName,
      ownershipPercentage: legalPct,
      controlPercentage: controlPct,
      ownershipType: 'BOLAGSVERKET_FI_ORGANISATIONSENGAGEMANG',
      ownershipClass: null,
      rawEngagement: e,
    });
  }

  return out;
}

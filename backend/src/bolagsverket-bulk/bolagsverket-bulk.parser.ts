import { createHash } from 'crypto';
import { Injectable } from '@nestjs/common';
import { parse as parseCsv } from 'csv-parse/sync';

export interface ParsedBulkLine {
  sourceIdentityKey: string;
  identityRaw: string | null;
  identityValue: string | null;
  identityType: string | null;
  identityTypeLabel: string | null;
  organisationNumber: string | null;
  personalIdentityNumber: string | null;
  nameProtectionSequenceNumber: string | null;
  registrationCountryLabel: string | null;
  namesRaw: string | null;
  namePrimary: string | null;
  primaryNameTypeCode: string | null;
  primaryNameTypeLabel: string | null;
  namesAll: Array<{
    name: string | null;
    typeCode: string | null;
    typeLabel: string | null;
    registrationDate: string | null;
    extra: string | null;
  }>;
  organisationFormCode: string | null;
  organisationFormLabel: string | null;
  registrationDate: string | null;
  deregistrationDate: string | null;
  deregistrationReasonCode: string | null;
  deregistrationReasonText: string | null;
  deregistrationReasonLabel: string | null;
  restructuringRaw: string | null;
  hasActiveRestructuringOrWindup: boolean;
  activeRestructuringCodes: string[];
  activeRestructuringLabels: string[];
  restructuringEntries: Array<{
    code: string | null;
    label: string | null;
    text: string | null;
    fromDate: string | null;
  }>;
  businessDescription: string | null;
  postalAddressRaw: string | null;
  deliveryAddress: string | null;
  coAddress: string | null;
  postalCode: string | null;
  city: string | null;
  countryCode: string | null;
  postalParseWarning: string | null;
  registrationCountryCode: string | null;
  namnskyddslopnummer: string | null;
  contentHash: string;
  rawColumns: string[];
}

const LEGAL_FORM_LABELS: Record<string, string> = {
  'AB-ORGFO': 'Aktiebolag',
  'HB-ORGFO': 'Handelsbolag',
  'KB-ORGFO': 'Kommanditbolag',
  'E-ORGFO': 'Enskild naringsverksamhet',
};

const IDENTITY_TYPE_LABELS: Record<string, string> = {
  'ORGNR-IDORG': 'Organisationsnummer',
  'PERSON-IDORG': 'Identitetsbeteckning person',
  'SE-LAND': 'Sverige',
};

const NAME_TYPE_LABELS: Record<string, string> = {
  'FORETAGSNAMN-ORGNAM': 'Foretagsnamn',
  'NAMN-ORGNAM': 'Namn',
  'FORNAMN_FRSPRAK-ORGNAM': 'Foretagsnamn pa frammande sprak',
  'SARS_FORNAMN-ORGNAM': 'Sarskilt foretagsnamn',
};

const DEREG_REASON_LABELS: Record<string, string> = {
  'ARSEED-AVORG': 'Arsredovisning saknas',
  'AVREG-AVORG': 'Avregistrerad',
  'KKAV-AVORG': 'Konkurs',
  'LIAV-AVORG': 'Likvidation',
};

const RESTRUCTURING_LABELS: Record<string, string> = {
  'LI-AVOMFO': 'Likvidation',
  'KK-AVOMFO': 'Konkurs',
  'FR-AVOMFO': 'Foretagsrekonstruktion',
  'OM-AVOMFO': 'Ombildning',
};

@Injectable()
export class BolagsverketBulkParser {
  parseDelimitedLine(line: string): string[] {
    const records = parseCsv(line, {
      delimiter: ';',
      quote: '"',
      relax_quotes: true,
      skip_empty_lines: false,
    }) as string[][];
    const cols = records[0] ?? [];
    if (cols.length !== 11) {
      throw new Error(`Expected 11 columns, got ${cols.length}`);
    }
    return cols.map(v => {
      const trimmed = String(v ?? '').trim();
      return trimmed === '' ? '' : trimmed;
    });
  }

  private splitComposite(raw: string | null): string[] {
    if (!raw) return [];
    return raw.split('$').map(v => v.trim()).filter(Boolean);
  }

  private parseIdentity(raw: string | null): {
    value: string | null;
    typeCode: string | null;
    typeLabel: string | null;
    organisationNumber: string | null;
    personalIdentityNumber: string | null;
  } {
    if (!raw) {
      return { value: null, typeCode: null, typeLabel: null, organisationNumber: null, personalIdentityNumber: null };
    }
    const idx = raw.indexOf('$');
    const left = idx >= 0 ? raw.slice(0, idx) : raw;
    const right = idx >= 0 ? raw.slice(idx + 1) : '';
    const value = left.replace(/\D/g, '') || null;
    const typeCode = right.trim() || null;
    const typeLabel = typeCode ? IDENTITY_TYPE_LABELS[typeCode] ?? null : null;
    const organisationNumber = typeCode === 'ORGNR-IDORG' ? value : null;
    const personalIdentityNumber = typeCode === 'PERSON-IDORG' ? value : null;
    return { value, typeCode, typeLabel, organisationNumber, personalIdentityNumber };
  }

  private parseNamePrimary(raw: string | null): string | null {
    const parts = this.splitComposite(raw);
    return parts[0] ?? null;
  }

  private parseAddress(raw: string | null): {
    deliveryAddress: string | null;
    coAddress: string | null;
    city: string | null;
    postalCode: string | null;
    countryCode: string | null;
    warning: string | null;
  } {
    const p = this.splitComposite(raw);
    const p2 = p[2] ?? null;
    const p3 = p[3] ?? null;
    const isPostal = (v: string | null) => !!v && /^\d{5}$/.test(v.replace(/\s/g, ''));
    let city = p2;
    let postalCode = p3;
    let warning: string | null = null;
    if (isPostal(p2) && !isPostal(p3)) {
      postalCode = p2;
      city = p3;
    } else if (!isPostal(p2) && !isPostal(p3) && (p2 || p3)) {
      warning = 'Unable to confidently detect postal code vs city';
    }
    return {
      deliveryAddress: p[0] ?? null,
      coAddress: p[1] ?? null,
      city: city ?? null,
      postalCode: postalCode ?? null,
      countryCode: p[4] ?? null,
      warning,
    };
  }

  private normalizeDate(v: string | null): string | null {
    if (!v) return null;
    const t = v.trim();
    if (!t) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
    return null;
  }

  private parseDeregistrationReason(raw: string | null): { code: string | null; text: string | null } {
    if (!raw) return { code: null, text: null };
    const parts = raw
      .split('$')
      .map(v => v.trim())
      .filter(Boolean);
    if (parts.length === 0) return { code: null, text: null };
    if (parts.length === 1) {
      const only = parts[0] ?? null;
      if (only && only.toUpperCase().endsWith('-AVORG')) return { code: only, text: null };
      return { code: null, text: only };
    }
    const codeCandidate = parts.find(p => p.toUpperCase().endsWith('-AVORG')) ?? null;
    const textCandidate = parts.find(p => p !== codeCandidate) ?? null;
    return {
      code: codeCandidate,
      text: textCandidate,
    };
  }

  private parseNames(raw: string | null): ParsedBulkLine['namesAll'] {
    if (!raw) return [];
    return raw
      .split('|')
      .map(part => part.trim())
      .filter(Boolean)
      .map(part => {
        const bits = part.split('$');
        const name = bits[0]?.trim() || null;
        const typeCode = bits[1]?.trim() || null;
        const registrationDate = this.normalizeDate(bits[2]?.trim() || null);
        const extra = bits.slice(3).join('$').trim() || null;
        return {
          name,
          typeCode,
          typeLabel: typeCode ? NAME_TYPE_LABELS[typeCode] ?? null : null,
          registrationDate,
          extra,
        };
      });
  }

  private parseRestructuring(raw: string | null): ParsedBulkLine['restructuringEntries'] {
    if (!raw) return [];
    return raw
      .split('|')
      .map(part => part.trim())
      .filter(Boolean)
      .map(part => {
        const bits = part.split('$').map(v => v.trim()).filter(Boolean);
        const code = bits[0] ?? null;
        let text: string | null = null;
        let fromDate: string | null = null;
        if (bits.length >= 3) {
          text = bits[1] ?? null;
          fromDate = this.normalizeDate(bits[2] ?? null);
        } else if (bits.length === 2) {
          if (this.normalizeDate(bits[1])) fromDate = this.normalizeDate(bits[1]);
          else text = bits[1] ?? null;
        }
        return {
          code,
          label: code ? RESTRUCTURING_LABELS[code] ?? null : null,
          text,
          fromDate,
        };
      });
  }

  parseLineToStaging(line: string, profileName = 'default_v1'): ParsedBulkLine {
    void profileName;
    const cols = this.parseDelimitedLine(line);
    const pick = (i: number) => (cols[i] && cols[i].trim() ? cols[i].trim() : null);
    const identityRaw = pick(0);
    const namnskydd = pick(1);
    const registrationCountryCode = pick(2);
    const namesRaw = pick(3);
    const organisationFormCode = pick(4);
    const deregistrationDate = this.normalizeDate(pick(5));
    const deregistrationReasonRaw = pick(6);
    const restructuringRaw = pick(7);
    const registrationDate = this.normalizeDate(pick(8));
    const businessDescription = pick(9);
    const postalAddressRaw = pick(10);
    const deregistrationReason = this.parseDeregistrationReason(deregistrationReasonRaw);
    const id = this.parseIdentity(identityRaw);
    const names = this.parseNames(namesRaw);
    const primaryName = names[0] ?? null;
    const restructuringEntries = this.parseRestructuring(restructuringRaw);
    const address = this.parseAddress(postalAddressRaw);
    const sourceIdentityKey = `${id.typeCode ?? ''}:${id.value ?? ''}:${namnskydd ?? ''}`;
    const stableHash = createHash('sha256').update(line, 'utf8').digest('hex');

    return {
      sourceIdentityKey,
      identityRaw,
      identityValue: id.value,
      identityType: id.typeCode,
      identityTypeLabel: id.typeLabel,
      organisationNumber: id.organisationNumber,
      personalIdentityNumber: id.personalIdentityNumber,
      nameProtectionSequenceNumber: namnskydd,
      registrationCountryLabel: registrationCountryCode === 'SE-LAND' ? 'Sverige' : null,
      namesRaw,
      namePrimary: primaryName?.name ?? this.parseNamePrimary(namesRaw),
      primaryNameTypeCode: primaryName?.typeCode ?? null,
      primaryNameTypeLabel: primaryName?.typeLabel ?? null,
      namesAll: names,
      organisationFormCode,
      organisationFormLabel: organisationFormCode ? LEGAL_FORM_LABELS[organisationFormCode] ?? null : null,
      registrationDate,
      deregistrationDate,
      deregistrationReasonCode: deregistrationReason.code,
      deregistrationReasonText: deregistrationReason.text,
      deregistrationReasonLabel: deregistrationReason.code ? DEREG_REASON_LABELS[deregistrationReason.code] ?? null : null,
      restructuringRaw,
      hasActiveRestructuringOrWindup: restructuringEntries.length > 0,
      activeRestructuringCodes: restructuringEntries.map(x => x.code).filter((x): x is string => !!x),
      activeRestructuringLabels: restructuringEntries.map(x => x.label).filter((x): x is string => !!x),
      restructuringEntries,
      businessDescription,
      postalAddressRaw,
      deliveryAddress: address.deliveryAddress,
      coAddress: address.coAddress,
      city: address.city,
      postalCode: address.postalCode,
      countryCode: address.countryCode,
      postalParseWarning: address.warning,
      registrationCountryCode,
      namnskyddslopnummer: namnskydd,
      contentHash: stableHash,
      rawColumns: cols,
    };
  }
}


import { createHash } from 'crypto';
import { Injectable } from '@nestjs/common';

export interface ParsedBulkLine {
  identityRaw: string | null;
  identityValue: string | null;
  identityType: string | null;
  namesRaw: string | null;
  namePrimary: string | null;
  organisationFormCode: string | null;
  registrationDate: string | null;
  deregistrationDate: string | null;
  deregistrationReasonCode: string | null;
  deregistrationReasonText: string | null;
  restructuringRaw: string | null;
  businessDescription: string | null;
  postalAddressRaw: string | null;
  deliveryAddress: string | null;
  coAddress: string | null;
  postalCode: string | null;
  city: string | null;
  countryCode: string | null;
  registrationCountryCode: string | null;
  namnskyddslopnummer: string | null;
  contentHash: string;
}

type FieldKey =
  | 'identityRaw'
  | 'namesRaw'
  | 'organisationFormCode'
  | 'registrationDate'
  | 'deregistrationDate'
  | 'deregistrationReasonCode'
  | 'deregistrationReasonText'
  | 'restructuringRaw'
  | 'businessDescription'
  | 'postalAddressRaw'
  | 'registrationCountryCode';

const PARSER_PROFILES: Record<string, Record<FieldKey, number>> = {
  default_v1: {
    identityRaw: 0,
    namesRaw: 1,
    organisationFormCode: 2,
    registrationDate: 3,
    deregistrationDate: 4,
    deregistrationReasonCode: 5,
    deregistrationReasonText: 6,
    restructuringRaw: 7,
    businessDescription: 8,
    postalAddressRaw: 9,
    registrationCountryCode: 10,
  },
  vendor_2025_alt: {
    identityRaw: 1,
    namesRaw: 2,
    organisationFormCode: 3,
    registrationDate: 6,
    deregistrationDate: 7,
    deregistrationReasonCode: 8,
    deregistrationReasonText: 9,
    restructuringRaw: 10,
    businessDescription: 11,
    postalAddressRaw: 12,
    registrationCountryCode: 13,
  },
};

@Injectable()
export class BolagsverketBulkParser {
  parseDelimitedLine(line: string): string[] {
    const out: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i]!;
      const next = line[i + 1];
      if (ch === '"') {
        if (inQuotes && next === '"') {
          cur += '"';
          i += 1;
          continue;
        }
        inQuotes = !inQuotes;
        continue;
      }
      if (ch === ';' && !inQuotes) {
        out.push(cur);
        cur = '';
        continue;
      }
      cur += ch;
    }
    out.push(cur);
    return out.map(v => v.trim());
  }

  private splitComposite(raw: string | null): string[] {
    if (!raw) return [];
    return raw.split('$').map(v => v.trim()).filter(Boolean);
  }

  private parseIdentity(raw: string | null): { value: string | null; type: string | null; ns: string | null } {
    const parts = this.splitComposite(raw);
    const value = (parts[0] ?? '').replace(/\D/g, '');
    const type = parts[1] ?? null;
    const ns = parts.find(p => p.toUpperCase().includes('NAMNSKYDD')) ?? null;
    return { value: value || null, type, ns };
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
  } {
    const p = this.splitComposite(raw);
    return {
      deliveryAddress: p[0] ?? null,
      coAddress: p[1] ?? null,
      city: p[2] ?? null,
      postalCode: p[3] ?? null,
      countryCode: p[4] ?? null,
    };
  }

  private normalizeDate(v: string | null): string | null {
    if (!v) return null;
    const t = v.trim();
    if (!t) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
    return null;
  }

  parseLineToStaging(line: string, profileName = 'default_v1'): ParsedBulkLine {
    const cols = this.parseDelimitedLine(line);
    const map = PARSER_PROFILES[profileName] ?? PARSER_PROFILES.default_v1;
    const pick = (k: FieldKey) => cols[map[k]] ?? null;
    const identityRaw = pick('identityRaw');
    const namesRaw = pick('namesRaw');
    const organisationFormCode = pick('organisationFormCode');
    const registrationDate = this.normalizeDate(pick('registrationDate'));
    const deregistrationDate = this.normalizeDate(pick('deregistrationDate'));
    const deregistrationReasonCode = pick('deregistrationReasonCode');
    const deregistrationReasonText = pick('deregistrationReasonText');
    const restructuringRaw = pick('restructuringRaw');
    const businessDescription = pick('businessDescription');
    const postalAddressRaw = pick('postalAddressRaw');
    const registrationCountryCode = pick('registrationCountryCode');

    const id = this.parseIdentity(identityRaw);
    const address = this.parseAddress(postalAddressRaw);
    const stableHash = createHash('sha256').update(line, 'utf8').digest('hex');

    return {
      identityRaw,
      identityValue: id.value,
      identityType: id.type,
      namesRaw,
      namePrimary: this.parseNamePrimary(namesRaw),
      organisationFormCode,
      registrationDate,
      deregistrationDate,
      deregistrationReasonCode,
      deregistrationReasonText,
      restructuringRaw,
      businessDescription,
      postalAddressRaw,
      deliveryAddress: address.deliveryAddress,
      coAddress: address.coAddress,
      city: address.city,
      postalCode: address.postalCode,
      countryCode: address.countryCode,
      registrationCountryCode,
      namnskyddslopnummer: id.ns,
      contentHash: stableHash,
    };
  }
}


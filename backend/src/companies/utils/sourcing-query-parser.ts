import { COMPANY_STATUSES, type CompanyStatus } from '../constants/company-list.constants';

/** Subset of list filters produced from natural-language style input (deterministic rules, no LLM). */
export type SourcingParsedFilters = {
  q?: string;
  org_number?: string;
  status?: CompanyStatus;
  company_form_contains?: string;
  deal_mode?: 'founder_exit' | 'distressed' | 'roll_up';
};

export type SourcingParseResult = {
  filters: SourcingParsedFilters;
  /** Human-readable trace of what the parser applied. */
  notes: string[];
};

const ORG_TOKEN = /(?:^|[\s,;])(\d{6}-\d{4}|\d{10}|\d{12})(?=[\s,;]|$)/g;

const STATUS_RULES: Array<{ re: RegExp; status: CompanyStatus; note: string }> = [
  { re: /\b(aktiv|active|registrerad)\b/i, status: 'ACTIVE', note: 'Matched status keyword → ACTIVE' },
  { re: /\b(inaktiv|inactive)\b/i, status: 'INACTIVE', note: 'Matched status keyword → INACTIVE' },
  { re: /\b(konkurs|bankrupt|insolvent)\b/i, status: 'BANKRUPT', note: 'Matched status keyword → BANKRUPT' },
  { re: /\b(likvidation|liquidation)\b/i, status: 'LIQUIDATION', note: 'Matched status keyword → LIQUIDATION' },
  { re: /\b(upplöst|upplost|dissolved|avregistrerad)\b/i, status: 'DISSOLVED', note: 'Matched status keyword → DISSOLVED' },
];

const FORM_RULES: Array<{ re: RegExp; needle: string; note: string }> = [
  { re: /\b(aktiebolag|aktie\s*bolag)\b/i, needle: 'Aktiebolag', note: 'Matched legal form → Aktiebolag' },
  { re: /\b(\bab\b|\bab\.|\bAB\b)/i, needle: 'Aktiebolag', note: 'Matched abbreviation AB → Aktiebolag' },
  { re: /\b(enskild\s*firma|\bef\b|\bef\.)\b/i, needle: 'enskild', note: 'Matched Enskild firma family' },
  { re: /\b(handelsbolag|HB)\b/i, needle: 'Handelsbolag', note: 'Matched Handelsbolag / HB' },
  { re: /\b(kommanditbolag|KB)\b/i, needle: 'Kommanditbolag', note: 'Matched Kommanditbolag / KB' },
  { re: /\b(ekonomisk\s*förening|\bef[\.\s]*förening)\b/i, needle: 'förening', note: 'Matched ekonomisk förening' },
];

const DEAL_MODE_RULES: Array<{
  re: RegExp;
  mode: 'founder_exit' | 'distressed' | 'roll_up';
  note: string;
}> = [
  { re: /\b(founder\s*exit|grundar(exit|e)|ägarskifte)\b/i, mode: 'founder_exit', note: 'Matched deal mode → founder_exit' },
  { re: /\b(distressed|turnaround|rekonstruktion|likviditetskris)\b/i, mode: 'distressed', note: 'Matched deal mode → distressed' },
  { re: /\b(roll[-\s]?up|buy[-\s]?and[-\s]?build|plattformsförvärv)\b/i, mode: 'roll_up', note: 'Matched deal mode → roll_up' },
];

function stripOrgFormatting(s: string): string {
  return s.replace(/\D/g, '');
}

function isAllowedStatus(s: string): s is CompanyStatus {
  return (COMPANY_STATUSES as readonly string[]).includes(s);
}

/**
 * Parse a single line (or short paragraph) of analyst-style text into structured company list filters.
 * Rules: extract Swedish org numbers, status and legal-form keywords, pass remainder as name search `q`.
 */
export function parseSourcingQueryText(raw: string): SourcingParseResult {
  const notes: string[] = [];
  const filters: SourcingParsedFilters = {};
  let working = raw.normalize('NFKC').trim();
  if (!working) {
    return { filters, notes: ['Empty input — no filters applied.'] };
  }

  ORG_TOKEN.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = ORG_TOKEN.exec(working)) !== null) {
    const digits = stripOrgFormatting(m[1]!);
    if (digits.length === 10 || digits.length === 12) {
      if (!filters.org_number) {
        filters.org_number = digits;
        notes.push(`Extracted organisation number ${digits}`);
      }
    }
    working = `${working.slice(0, m.index)} ${working.slice(m.index + m[0].length)}`.replace(/\s+/g, ' ').trim();
    ORG_TOKEN.lastIndex = 0;
  }

  for (const rule of STATUS_RULES) {
    if (rule.re.test(working)) {
      if (!filters.status) {
        filters.status = rule.status;
        notes.push(rule.note);
      }
      working = working.replace(rule.re, ' ').replace(/\s+/g, ' ').trim();
      break;
    }
  }

  for (const rule of FORM_RULES) {
    if (rule.re.test(working)) {
      if (!filters.company_form_contains) {
        filters.company_form_contains = rule.needle;
        notes.push(rule.note);
      }
      working = working.replace(rule.re, ' ').replace(/\s+/g, ' ').trim();
      break;
    }
  }

  for (const rule of DEAL_MODE_RULES) {
    if (rule.re.test(working)) {
      if (!filters.deal_mode) {
        filters.deal_mode = rule.mode;
        notes.push(rule.note);
      }
      working = working.replace(rule.re, ' ').replace(/\s+/g, ' ').trim();
      break;
    }
  }

  const q = working.replace(/[,;]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (q.length >= 2) {
    filters.q = q.slice(0, 255);
    notes.push(`Remaining text used as name search (q)`);
  } else if (!filters.org_number && !filters.status && !filters.company_form_contains && !filters.deal_mode) {
    notes.push('No structured tokens recognised — add org number, status, or legal-form keywords, or a company name fragment.');
  }

  if (filters.status && !isAllowedStatus(filters.status)) {
    delete filters.status;
  }

  return { filters, notes };
}

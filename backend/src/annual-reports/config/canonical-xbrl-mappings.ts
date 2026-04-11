/**
 * Deterministic concept → canonical field mapping. Extend by adding patterns (substring match, case-insensitive).
 * Higher priority wins when multiple rules match the same fact.
 */
export type CanonicalMappingRule = {
  canonicalField: string;
  /** Substrings matched against full concept QName (e.g. `bas:Revenue` or full URI). */
  patterns: string[];
  priority: number;
};

export const HEADER_ORG_RULES: CanonicalMappingRule[] = [
  {
    canonicalField: 'organisation_number_filing',
    patterns: [
      'identitetsbeteckning',
      'organisationnumber',
      'organisation_number',
      'organisationsnummer',
      'registrationnumber',
    ],
    priority: 100,
  },
];

export const HEADER_NAME_RULES: CanonicalMappingRule[] = [
  {
    canonicalField: 'company_name_filing',
    patterns: [
      'foretagsnamn',
      'legalname',
      'legal_name',
      'companyname',
      'entityname',
      'nameofreportingentity',
    ],
    priority: 100,
  },
];

/** Income statement & key P&L */
export const FINANCIAL_RULES: CanonicalMappingRule[] = [
  { canonicalField: 'revenue', patterns: ['netsales', 'netrevenue', 'revenue', 'omsattning', 'rorintakter'], priority: 90 },
  { canonicalField: 'other_operating_income', patterns: ['otheroperatingincome', 'ovriga', 'otherincome'], priority: 70 },
  { canonicalField: 'operating_expenses', patterns: ['operatingexpenses', 'rorelsekostnader', 'totaloperatingexpenses'], priority: 70 },
  { canonicalField: 'personnel_costs', patterns: ['personnelcost', 'personalkostnad', 'employeebenefit'], priority: 80 },
  { canonicalField: 'depreciation_amortization', patterns: ['depreciation', 'amortization', 'avskrivning', 'nedskrivning'], priority: 75 },
  { canonicalField: 'operating_profit', patterns: ['operatingprofit', 'operatingincome', 'rorelseresultat', 'ebit'], priority: 85 },
  { canonicalField: 'financial_result', patterns: ['financialitems', 'finansiell', 'netfinancial', 'resultfromfinancial'], priority: 70 },
  { canonicalField: 'profit_after_financial', patterns: ['profitbeforetax', 'resultatefterfinansiella', 'profitlossbeforetax'], priority: 80 },
  { canonicalField: 'tax_on_profit', patterns: ['incometax', 'taxexpense', 'skatt'], priority: 75 },
  { canonicalField: 'net_profit', patterns: ['profitloss', 'netincome', 'arsresultat', 'profitfortheyear', 'resultat'], priority: 85 },
  { canonicalField: 'appropriations', patterns: ['appropriation', 'disposition'], priority: 60 },
  /* Balance sheet */
  { canonicalField: 'intangible_assets', patterns: ['intangibleassets', 'immateriella'], priority: 75 },
  { canonicalField: 'tangible_assets', patterns: ['propertyplant', 'materiella', 'tangibleassets'], priority: 75 },
  { canonicalField: 'financial_assets', patterns: ['financialassets', 'finansiellatillgangar'], priority: 70 },
  { canonicalField: 'total_fixed_assets', patterns: ['noncurrentassets', 'langfristiga', 'totalfixed'], priority: 65 },
  { canonicalField: 'inventory', patterns: ['inventor', 'varulager'], priority: 80 },
  { canonicalField: 'receivables', patterns: ['tradereceivable', 'kundfordringar', 'receivable'], priority: 70 },
  { canonicalField: 'cash_and_equivalents', patterns: ['cashandcashequivalent', 'kassa', 'likvida'], priority: 85 },
  { canonicalField: 'total_current_assets', patterns: ['currentassets', 'omsattningstillgangar', 'kortfristiga'], priority: 65 },
  { canonicalField: 'total_assets', patterns: ['totalassets', 'summa tillgangar', 'assets'], priority: 50 },
  { canonicalField: 'equity', patterns: ['equity', 'egetkapital', 'totalequity'], priority: 70 },
  { canonicalField: 'share_capital', patterns: ['sharecapital', 'aktiekapital'], priority: 85 },
  { canonicalField: 'unrestricted_equity', patterns: ['unrestrictedequity', 'fritt'], priority: 65 },
  { canonicalField: 'restricted_equity', patterns: ['restrictedequity', 'bundet'], priority: 65 },
  { canonicalField: 'untaxed_reserves', patterns: ['untaxed', 'obeskattade'], priority: 70 },
  { canonicalField: 'provisions', patterns: ['provisions', 'avsattningar'], priority: 70 },
  { canonicalField: 'long_term_liabilities', patterns: ['noncurrentliabilities', 'langfristiga skulder'], priority: 70 },
  { canonicalField: 'short_term_liabilities', patterns: ['currentliabilities', 'kortfristiga skulder'], priority: 70 },
  { canonicalField: 'accounts_payable', patterns: ['tradepayable', 'leverantorsskulder'], priority: 75 },
  { canonicalField: 'tax_liabilities', patterns: ['taxliabilit', 'skatteskulder'], priority: 70 },
  { canonicalField: 'total_equity_and_liabilities', patterns: ['totalliabilit', 'summa skulder', 'equityandliabilit'], priority: 55 },
  /* Cash flow */
  { canonicalField: 'operating_cash_flow', patterns: ['cashflowfromoperating', 'rorelsekapital'], priority: 80 },
  { canonicalField: 'investing_cash_flow', patterns: ['cashflowfrominvesting'], priority: 80 },
  { canonicalField: 'financing_cash_flow', patterns: ['cashflowfromfinancing'], priority: 80 },
  { canonicalField: 'cash_flow_for_year', patterns: ['netincreaseincash', 'forandring likvida'], priority: 70 },
  { canonicalField: 'cash_beginning', patterns: ['cashatbeginning', 'likvida vid arets borjan'], priority: 75 },
  { canonicalField: 'cash_end', patterns: ['cashatend', 'likvida vid arets slut'], priority: 75 },
  /* Other */
  { canonicalField: 'employee_count', patterns: ['numberofemployees', 'antal anstallda', 'employees'], priority: 85 },
  { canonicalField: 'dividends', patterns: ['dividend'], priority: 70 },
  { canonicalField: 'interest_income', patterns: ['interestincome', 'ranteintakter'], priority: 70 },
  { canonicalField: 'interest_expense', patterns: ['interestexpense', 'rantekostnader'], priority: 70 },
];

export const AUDITOR_RULES: CanonicalMappingRule[] = [
  { canonicalField: 'auditor_name', patterns: ['auditorname', 'revisorsnamn', 'signingauditor'], priority: 85 },
  { canonicalField: 'auditor_firm', patterns: ['auditorfirm', 'revisionsbolag', 'auditfirm'], priority: 85 },
  { canonicalField: 'audit_opinion', patterns: ['auditopinion', 'revisionsberattelse', 'auditreport'], priority: 70 },
];

export const NOTE_RULES: CanonicalMappingRule[] = [
  { canonicalField: 'note_disclosure', patterns: ['notetext', 'disclosure', 'footnote', 'textblock'], priority: 50 },
];

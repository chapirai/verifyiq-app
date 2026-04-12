/** Maps normalized canonical financial fields to dashboard statement grouping. */
export type AnnualReportStatementType =
  | 'income_statement'
  | 'balance_sheet'
  | 'cash_flow'
  | 'equity'
  | 'notes'
  | 'metadata'
  | 'audit'
  | 'other';

const INCOME = new Set([
  'revenue',
  'other_operating_income',
  'operating_expenses',
  'personnel_costs',
  'depreciation_amortization',
  'operating_profit',
  'financial_result',
  'profit_after_financial',
  'tax_on_profit',
  'net_profit',
  'appropriations',
  'dividends',
  'interest_income',
  'interest_expense',
]);

const BALANCE = new Set([
  'intangible_assets',
  'tangible_assets',
  'financial_assets',
  'total_fixed_assets',
  'inventory',
  'receivables',
  'cash_and_equivalents',
  'total_current_assets',
  'total_assets',
  'equity',
  'share_capital',
  'unrestricted_equity',
  'restricted_equity',
  'untaxed_reserves',
  'provisions',
  'long_term_liabilities',
  'short_term_liabilities',
  'accounts_payable',
  'tax_liabilities',
  'total_equity_and_liabilities',
]);

const CASH = new Set([
  'operating_cash_flow',
  'investing_cash_flow',
  'financing_cash_flow',
  'cash_flow_for_year',
  'cash_beginning',
  'cash_end',
]);

const EQUITY_STMT = new Set(['share_capital', 'unrestricted_equity', 'restricted_equity']);

export function statementTypeForCanonicalField(field: string): AnnualReportStatementType {
  if (INCOME.has(field)) return 'income_statement';
  if (BALANCE.has(field)) return 'balance_sheet';
  if (CASH.has(field)) return 'cash_flow';
  if (EQUITY_STMT.has(field)) return 'equity';
  if (field === 'employee_count') return 'metadata';
  return 'other';
}

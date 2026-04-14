-- Verify migration + data publication for annual_report_api_financial_rows

-- 1) Table exists
SELECT to_regclass('public.annual_report_api_financial_rows') AS table_name;

-- 2) Check row count by tenant/org/year
SELECT
  tenant_id,
  organisationsnummer,
  fiscal_year,
  COUNT(*) AS row_count
FROM annual_report_api_financial_rows
GROUP BY tenant_id, organisationsnummer, fiscal_year
ORDER BY fiscal_year DESC NULLS LAST, organisationsnummer;

-- 3) Spot-check latest mapped financial rows against source serving table
SELECT
  api.organisationsnummer,
  api.fiscal_year,
  api.statement_type,
  api.value_code,
  api.period_kind,
  api.value_numeric,
  api.value_text,
  fin.value_numeric AS source_value_numeric,
  fin.value_text AS source_value_text
FROM annual_report_api_financial_rows api
JOIN company_annual_report_financials fin
  ON fin.header_id = api.source_header_id
 AND fin.canonical_field = api.value_code
 AND fin.period_kind = api.period_kind
ORDER BY api.created_at DESC
LIMIT 200;

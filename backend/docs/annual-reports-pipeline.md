# Annual report (iXBRL) extraction pipeline

Deterministic ingestion for Bolagsverket-style **ZIP** packages containing **Inline XBRL (XHTML)**. Parsing uses **Arelle** via a Python subprocess (`tools/ixbrl_arelle_extract.py`). There is **no** AI, OCR, or HTML scraping for numeric facts.

## Flow

1. **Register** a ZIP (`POST /api/v1/annual-reports/upload`) or link from a stored Bolagsverket document (`POST .../from-bv-document/:documentId`). Files are deduplicated by `(tenant_id, content_sha256)` and stored in object storage (`annual-reports/{tenantId}/{sha256}.zip`).
2. **Queue** `annual-report-parse` BullMQ job (`parse` by default after upload).
3. **Worker** downloads bytes, **safely unzips** (zip-slip and size limits), writes `annual_report_file_entries`, picks the best **iXBRL** candidate, runs **Arelle**, persists **raw** rows (`annual_report_xbrl_*`), then builds **normalized** serving rows (`company_annual_report_*`).
4. **Statuses** on `annual_report_files`: `pending` → `extracting` → `extracted` → `normalized`, or `failed`.

## Tables (migration `1000000000029`)

| Area | Tables |
|------|--------|
| Ingestion | `annual_report_files`, `annual_report_file_entries`, `annual_report_parse_runs`, `annual_report_parse_errors` |
| Raw XBRL | `annual_report_xbrl_contexts`, `annual_report_xbrl_units`, `annual_report_xbrl_facts`, `annual_report_xbrl_dimensions`, `annual_report_xbrl_labels` |
| Serving | `company_annual_report_headers`, `company_annual_report_financials`, `company_annual_report_auditor`, `company_annual_report_notes_index`, `company_annual_report_periods` |

Reprocessing creates a **new** `annual_report_parse_runs` row and new raw facts keyed by `(parse_run_id, sequence_index)`. Serving headers for the same physical file supersede older rows (`is_superseded`).

## Environment

| Variable | Purpose |
|----------|---------|
| `ARELLE_PYTHON` | Python executable (default `python3`, on Windows often `python`) |
| `ARELLE_EXTRACT_SCRIPT` | Override path to `ixbrl_arelle_extract.py` |
| `ARELLE_EXTRACT_TIMEOUT_MS` | Subprocess timeout (default `300000`) |
| `AR_PARSER_VERSION` | Stored on parse runs / headers (default `1.0.0`) |
| `AR_ZIP_MAX_UNCOMPRESSED_BYTES` | Total uncompressed budget (default 500MB) |
| `AR_ZIP_MAX_ENTRY_BYTES` | Per-entry cap (default 120MB) |
| `AR_ZIP_MAX_ENTRIES` | Max central-directory entries (default 5000) |
| `ANNUAL_REPORT_PARSE_CONCURRENCY` | BullMQ worker concurrency (default `2`) |

Install Arelle in the Python used by the backend:

```bash
cd backend
pip install -r requirements-arelle.txt
```

## API (JWT tenant)

- `POST /api/v1/annual-reports/upload` — multipart field `file`, optional `organisationsnummer`, optional `enqueue=false`
- `POST /api/v1/annual-reports/from-bv-document/:documentId`
- `POST /api/v1/annual-reports/files/:fileId/enqueue-parse` — body `{ "force": true }` to reparse
- `POST /api/v1/annual-reports/jobs/backfill` — enqueue ZIP BV documents (body `limit`)
- `POST /api/v1/annual-reports/files/:fileId/rebuild-serving` — re-run normalization from latest raw parse
- `GET .../companies/:organisationNumber/latest|history|financials`
- `GET .../files/:fileId/meta|detail`

## Extending canonical mappings

Edit `src/annual-reports/config/canonical-xbrl-mappings.ts`: add `FINANCIAL_RULES` (or other rule lists) with `patterns` as **substring** matches against the full concept QName (lowercased). Higher `priority` wins. No values are invented; only tagged facts are considered.

## Raw vs normalized

- **Raw** tables mirror Arelle output (facts, contexts, units, dimensions, labels) per parse run — suitable for re-normalization without re-reading the ZIP.
- **Normalized** tables (`company_annual_report_*`) hold one active header per successful parse (per file, non-superseded) and canonical financial keys with `source_fact_ids` for traceability.

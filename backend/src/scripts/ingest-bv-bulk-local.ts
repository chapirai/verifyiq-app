import 'dotenv/config';
import { createHash } from 'crypto';
import { createReadStream } from 'fs';
import { stat } from 'fs/promises';
import { basename, resolve } from 'path';
import * as readline from 'readline';
import { Client } from 'pg';
import { BolagsverketBulkParser } from '../bolagsverket-bulk/bolagsverket-bulk.parser';

type ParsedArgs = {
  file: string;
  parserProfile: string;
  batchSize: number;
  maxRows: number | null;
  effectiveDate: string | null;
};

type RawRowInput = {
  lineNumber: number;
  rawLine: string;
  parsedOk: boolean;
  parseError: string | null;
};

type StagingRowInput = {
  organisationIdentityRaw: string | null;
  identityValue: string | null;
  identityType: string | null;
  namnskyddslopnummer: string | null;
  registrationCountryCode: string | null;
  organisationNamesRaw: string | null;
  organisationFormCode: string | null;
  deregistrationDate: string | null;
  deregistrationReasonCode: string | null;
  deregistrationReasonText: string | null;
  restructuringRaw: string | null;
  registrationDate: string | null;
  businessDescription: string | null;
  postalAddressRaw: string | null;
  deliveryAddress: string | null;
  coAddress: string | null;
  postalCode: string | null;
  city: string | null;
  countryCode: string | null;
  contentHash: string;
};

function clip(value: string | null | undefined, max: number): string | null {
  if (value == null) return null;
  const v = String(value).trim();
  if (!v) return null;
  return v.length <= max ? v : v.slice(0, max);
}

function parseArgs(argv: string[]): ParsedArgs {
  const get = (flag: string): string | null => {
    const idx = argv.indexOf(flag);
    if (idx < 0) return null;
    return argv[idx + 1] ?? null;
  };
  const file = get('--file') ?? get('-f');
  if (!file) {
    throw new Error('Missing required argument: --file "/absolute/path/to/bulk.txt"');
  }
  const parserProfile = get('--parser-profile') ?? 'default_v1';
  const batchRaw = Number(get('--batch-size') ?? 500);
  const batchSize = Number.isFinite(batchRaw) && batchRaw > 0 ? Math.floor(batchRaw) : 500;
  const maxRowsRaw = get('--max-rows');
  const maxRowsNum = maxRowsRaw == null ? NaN : Number(maxRowsRaw);
  const maxRows =
    maxRowsRaw == null || !Number.isFinite(maxRowsNum) || maxRowsNum <= 0 ? null : Math.floor(maxRowsNum);
  const effectiveDateRaw = get('--effective-date');
  const effectiveDate = effectiveDateRaw && /^\d{4}-\d{2}-\d{2}$/.test(effectiveDateRaw) ? effectiveDateRaw : null;
  return { file: resolve(file), parserProfile, batchSize, maxRows, effectiveDate };
}

async function createPgClient(): Promise<Client> {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  const ssl = process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined;
  if (databaseUrl) {
    const client = new Client({ connectionString: databaseUrl, ssl });
    await client.connect();
    return client;
  }
  const host = process.env.PG_HOST;
  const user = process.env.PG_USER;
  const password = process.env.PG_PASSWORD;
  const database = process.env.PG_DBNAME;
  const port = Number(process.env.PG_PORT ?? 5432);
  if (!host || !user || !password || !database) {
    throw new Error('Missing DB env. Set DATABASE_URL or PG_HOST/PG_PORT/PG_USER/PG_PASSWORD/PG_DBNAME.');
  }
  const client = new Client({ host, user, password, database, port, ssl });
  await client.connect();
  return client;
}

function buildBulkInsert(
  table: string,
  columns: string[],
  rows: unknown[][],
  startingParam = 1,
): { sql: string; values: unknown[] } {
  const values: unknown[] = [];
  const chunks: string[] = [];
  let param = startingParam;
  for (const row of rows) {
    const refs: string[] = [];
    for (const col of row) {
      refs.push(`$${param}`);
      values.push(col);
      param += 1;
    }
    chunks.push(`(${refs.join(', ')})`);
  }
  const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES ${chunks.join(', ')}`;
  return { sql, values };
}

async function flushBatch(
  client: Client,
  fileRunId: string,
  rawRows: RawRowInput[],
  stagingRows: StagingRowInput[],
): Promise<void> {
  if (rawRows.length === 0 && stagingRows.length === 0) return;
  await client.query('BEGIN');
  try {
    if (rawRows.length > 0) {
      const rawValues = rawRows.map(row => [
        fileRunId,
        row.lineNumber,
        row.rawLine,
        row.parsedOk,
        row.parseError,
      ]);
      const q = buildBulkInsert(
        'bv_bulk_raw_rows',
        ['file_run_id', 'line_number', 'raw_line', 'parsed_ok', 'parse_error'],
        rawValues,
      );
      await client.query(q.sql, q.values);
    }
    if (stagingRows.length > 0) {
      const stValues = stagingRows.map(row => [
        fileRunId,
        row.organisationIdentityRaw,
        row.identityValue,
        row.identityType,
        row.namnskyddslopnummer,
        row.registrationCountryCode,
        row.organisationNamesRaw,
        row.organisationFormCode,
        row.deregistrationDate,
        row.deregistrationReasonCode,
        row.deregistrationReasonText,
        row.restructuringRaw,
        row.registrationDate,
        row.businessDescription,
        row.postalAddressRaw,
        row.deliveryAddress,
        row.coAddress,
        row.postalCode,
        row.city,
        row.countryCode,
        row.contentHash,
      ]);
      const q = buildBulkInsert(
        'bv_bulk_companies_staging',
        [
          'file_run_id',
          'organisation_identity_raw',
          'identity_value',
          'identity_type',
          'namnskyddslopnummer',
          'registration_country_code',
          'organisation_names_raw',
          'organisation_form_code',
          'deregistration_date',
          'deregistration_reason_code',
          'deregistration_reason_text',
          'restructuring_raw',
          'registration_date',
          'business_description',
          'postal_address_raw',
          'delivery_address',
          'co_address',
          'postal_code',
          'city',
          'country_code',
          'content_hash',
        ],
        stValues,
      );
      await client.query(q.sql, q.values);
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const txtStats = await stat(args.file);
  if (!txtStats.isFile()) {
    throw new Error(`Not a file: ${args.file}`);
  }

  const parser = new BolagsverketBulkParser();
  const client = await createPgClient();
  const txtSha = createHash('sha256').update(`${args.file}:${txtStats.size}:${txtStats.mtimeMs}`).digest('hex');
  const runFingerprint = createHash('sha256').update(`local-run:${txtSha}:${Date.now()}`).digest('hex');
  const zipSha = runFingerprint;
  const now = new Date();
  const sourceUrl = `file://${args.file.replace(/\\/g, '/')}`;
  const txtObjectKey = `local/${basename(args.file)}`;
  const zipObjectKey = 'local/no-zip';

  let fileRunId = '';
  let lineNumber = 0;
  let parsedOk = 0;
  let parsedFailed = 0;
  let rawBatch: RawRowInput[] = [];
  let stagingBatch: StagingRowInput[] = [];

  try {
    const runRes = await client.query<{ id: string }>(
      `
      INSERT INTO bv_bulk_file_runs
        (source_url, downloaded_at, effective_date, zip_object_key, txt_object_key, zip_sha256, txt_sha256, row_count, parser_profile, status)
      VALUES
        ($1, $2, $3, $4, $5, $6, $7, 0, $8, 'downloaded')
      RETURNING id
      `,
      [sourceUrl, now, args.effectiveDate, zipObjectKey, txtObjectKey, zipSha, txtSha, args.parserProfile],
    );
    fileRunId = runRes.rows[0]?.id ?? '';
    if (!fileRunId) throw new Error('Failed to create bv_bulk_file_runs row');

    await client.query(`UPDATE bv_bulk_file_runs SET status = 'parsed' WHERE id = $1`, [fileRunId]);

    const rl = readline.createInterface({
      input: createReadStream(args.file, { encoding: 'utf8' }),
      crlfDelay: Infinity,
    });

    for await (const raw of rl) {
      const line = String(raw);
      if (!line.trim()) continue;
      lineNumber += 1;
      try {
        const parsed = parser.parseLineToStaging(line, args.parserProfile);
        parsedOk += 1;
        rawBatch.push({ lineNumber, rawLine: line, parsedOk: true, parseError: null });
        stagingBatch.push({
          organisationIdentityRaw: parsed.identityRaw,
          identityValue: clip(parsed.identityValue, 64),
          identityType: clip(parsed.identityType, 64),
          namnskyddslopnummer: clip(parsed.namnskyddslopnummer, 64),
          registrationCountryCode: clip(parsed.registrationCountryCode, 16),
          organisationNamesRaw: parsed.namesRaw,
          organisationFormCode: clip(parsed.organisationFormCode, 64),
          deregistrationDate: parsed.deregistrationDate,
          deregistrationReasonCode: clip(parsed.deregistrationReasonCode, 64),
          deregistrationReasonText: parsed.deregistrationReasonText,
          restructuringRaw: parsed.restructuringRaw,
          registrationDate: parsed.registrationDate,
          businessDescription: parsed.businessDescription,
          postalAddressRaw: parsed.postalAddressRaw,
          deliveryAddress: parsed.deliveryAddress,
          coAddress: parsed.coAddress,
          postalCode: clip(parsed.postalCode, 32),
          city: clip(parsed.city, 255),
          countryCode: clip(parsed.countryCode, 16),
          contentHash: clip(parsed.contentHash, 64) ?? '',
        });
      } catch (err) {
        parsedFailed += 1;
        rawBatch.push({
          lineNumber,
          rawLine: line,
          parsedOk: false,
          parseError: err instanceof Error ? err.message : String(err),
        });
      }

      if (rawBatch.length >= args.batchSize) {
        await flushBatch(client, fileRunId, rawBatch, stagingBatch);
        rawBatch = [];
        stagingBatch = [];
      }
      if (args.maxRows && parsedOk >= args.maxRows) {
        console.log(`BV_BULK_MAX_ROWS_TO_PROCESS(local) active: stopping after ${args.maxRows} parsed rows`);
        break;
      }
    }

    await flushBatch(client, fileRunId, rawBatch, stagingBatch);

    const status = parsedFailed > 0 ? 'failed' : 'parsed';
    const errorMessage =
      parsedFailed > 0
        ? `local_ingest_parse_errors:${parsedFailed}`
        : args.maxRows && parsedOk >= args.maxRows
          ? `test_limit:${args.maxRows}`
          : null;
    await client.query(
      `
      UPDATE bv_bulk_file_runs
      SET row_count = $2,
          status = $3,
          error_message = $4,
          updated_at = NOW()
      WHERE id = $1
      `,
      [fileRunId, lineNumber, status, errorMessage],
    );

    console.log('Local ingest completed');
    console.log(
      JSON.stringify(
        {
          fileRunId,
          file: args.file,
          parserProfile: args.parserProfile,
          lineCount: lineNumber,
          parsedOk,
          parsedFailed,
          status,
        },
        null,
        2,
      ),
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (fileRunId) {
      await client.query(
        `UPDATE bv_bulk_file_runs SET status = 'failed', error_message = $2, updated_at = NOW() WHERE id = $1`,
        [fileRunId, msg],
      );
    }
    throw err;
  } finally {
    await client.end();
  }
}

void main().catch(err => {
  console.error('Local ingest failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});


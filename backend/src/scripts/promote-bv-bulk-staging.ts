import 'dotenv/config';
import { Client } from 'pg';

function getArg(flag: string): string | null {
  const idx = process.argv.indexOf(flag);
  if (idx < 0) return null;
  return process.argv[idx + 1] ?? null;
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

function toStockholmTime(date: Date): string {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Stockholm',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date);
}

async function main(): Promise<void> {
  const runId = getArg('--run-id');
  if (!runId) throw new Error('Missing required --run-id <uuid>');
  const tenantId = (getArg('--tenant-id') ?? process.env.BV_BULK_DEFAULT_TENANT_ID ?? '').trim();
  const allowProductionDb = (getArg('--allow-production-db') ?? '').toLowerCase() === 'true';
  const allowNonLocalRun = (getArg('--allow-non-local-run') ?? '').toLowerCase() === 'true';
  const now = new Date();
  const client = await createPgClient();
  try {
    const guardEnabled = String(process.env.ALLOW_LOCAL_BV_BULK_PROMOTE ?? 'false').toLowerCase() === 'true';
    if (!guardEnabled) {
      throw new Error(
        'Local promote is blocked. Set ALLOW_LOCAL_BV_BULK_PROMOTE=true to confirm intentional local promotion.',
      );
    }
    const dbInfo = await client.query<{ db: string }>('SELECT current_database() AS db');
    const dbName = String(dbInfo.rows[0]?.db ?? '');
    const isLikelyProdDb = /prod|production|live/i.test(dbName);
    if (isLikelyProdDb && !allowProductionDb) {
      throw new Error(
        `Refusing to promote into likely production DB "${dbName}". Pass --allow-production-db true to override explicitly.`,
      );
    }
    const runMeta = await client.query<{ source_url: string; zip_object_key: string; status: string }>(
      `SELECT source_url, zip_object_key, status FROM bv_bulk_file_runs WHERE id = $1`,
      [runId],
    );
    if (runMeta.rowCount === 0) throw new Error(`Run not found: ${runId}`);
    const sourceUrl = String(runMeta.rows[0]?.source_url ?? '');
    const zipObjectKey = String(runMeta.rows[0]?.zip_object_key ?? '');
    if (!allowNonLocalRun && !(sourceUrl.startsWith('file://') || zipObjectKey.startsWith('local/'))) {
      throw new Error(
        `Run ${runId} is not marked local (source_url=${sourceUrl}, zip_object_key=${zipObjectKey}). Pass --allow-non-local-run true to override.`,
      );
    }
    const lockRes = await client.query<{ ok: boolean }>(
      `SELECT pg_try_advisory_lock(880014001::bigint) AS ok`,
    );
    if (!lockRes.rows[0]?.ok) {
      throw new Error('Another local bulk ingest/promote process is running (advisory lock busy).');
    }

    await client.query('BEGIN');

    const upsertedRes = await client.query<{ c: string }>(
      `
      WITH src AS (
        SELECT
          s.identity_value AS organisation_number,
          (COALESCE(s.identity_type, '') || ':' || COALESCE(s.identity_value, '') || ':' || COALESCE(s.namnskyddslopnummer, '')) AS source_identity_key,
          s.identity_value,
          s.identity_type AS identity_type_code,
          CASE
            WHEN s.identity_type = 'ORGNR-IDORG' THEN 'Organisationsnummer'
            WHEN s.identity_type = 'PERSON-IDORG' THEN 'Identitetsbeteckning person'
            ELSE s.identity_type
          END AS identity_type_label,
          CASE WHEN s.identity_type = 'PERSON-IDORG' THEN s.identity_value ELSE NULL END AS personal_identity_number,
          s.namnskyddslopnummer AS name_protection_sequence_number,
          SPLIT_PART(COALESCE(s.organisation_names_raw, ''), '$', 1) AS name_primary,
          s.organisation_names_raw,
          s.organisation_form_code,
          s.registration_date,
          s.deregistration_date,
          s.deregistration_reason_code,
          s.deregistration_reason_text,
          s.restructuring_raw,
          s.business_description,
          s.postal_address_raw,
          s.delivery_address,
          s.co_address,
          s.city,
          s.postal_code,
          s.country_code,
          s.registration_country_code,
          s.content_hash
        FROM bv_bulk_companies_staging s
        WHERE s.file_run_id = $1
          AND s.identity_value IS NOT NULL
          AND TRIM(s.identity_value) <> ''
      ),
      src_dedup AS (
        SELECT DISTINCT ON (organisation_number)
          *
        FROM src
        ORDER BY organisation_number, content_hash DESC NULLS LAST
      ),
      upserted AS (
        INSERT INTO bv_bulk_company_current (
          organisation_number,
          source_identity_key,
          identity_value,
          identity_type_code,
          identity_type_label,
          personal_identity_number,
          name_protection_sequence_number,
          identity_type,
          name_primary,
          name_all_jsonb,
          organisation_form_code,
          organisation_form_text,
          registration_date,
          deregistration_date,
          deregistration_reason_code,
          deregistration_reason_text,
          restructuring_status_jsonb,
          business_description,
          postal_address_jsonb,
          registrations_country_code,
          source_file_run_id,
          source_ingestion_run_id,
          source_last_seen_at,
          first_seen_at,
          last_seen_at,
          current_record_hash,
          is_active,
          is_deregistered,
          seed_state,
          raw_postadress,
          postal_address_line,
          postal_co_address,
          postal_city,
          postal_code,
          postal_country_code,
          registration_country_label,
          updated_at
        )
        SELECT
          src.organisation_number,
          src.source_identity_key,
          src.identity_value,
          src.identity_type_code,
          src.identity_type_label,
          src.personal_identity_number,
          src.name_protection_sequence_number,
          src.identity_type_code,
          NULLIF(src.name_primary, ''),
          '[]'::jsonb,
          src.organisation_form_code,
          src.organisation_form_code,
          src.registration_date,
          src.deregistration_date,
          src.deregistration_reason_code,
          src.deregistration_reason_text,
          jsonb_build_object('raw', src.restructuring_raw),
          src.business_description,
          jsonb_build_object(
            'raw', src.postal_address_raw,
            'deliveryAddress', src.delivery_address,
            'coAddress', src.co_address,
            'postalCode', src.postal_code,
            'city', src.city,
            'countryCode', src.country_code
          ),
          src.registration_country_code,
          $1,
          $1,
          $2,
          $2,
          $2,
          src.content_hash,
          CASE WHEN src.deregistration_date IS NULL THEN TRUE ELSE FALSE END,
          CASE WHEN src.deregistration_date IS NULL THEN FALSE ELSE TRUE END,
          'BULK_ONLY',
          src.postal_address_raw,
          src.delivery_address,
          src.co_address,
          src.city,
          src.postal_code,
          src.country_code,
          CASE WHEN src.registration_country_code = 'SE-LAND' THEN 'Sverige' ELSE src.registration_country_code END,
          NOW()
        FROM src_dedup src
        ON CONFLICT (organisation_number) DO UPDATE SET
          source_identity_key = EXCLUDED.source_identity_key,
          identity_value = EXCLUDED.identity_value,
          identity_type_code = EXCLUDED.identity_type_code,
          identity_type_label = EXCLUDED.identity_type_label,
          personal_identity_number = EXCLUDED.personal_identity_number,
          name_protection_sequence_number = EXCLUDED.name_protection_sequence_number,
          identity_type = EXCLUDED.identity_type,
          name_primary = EXCLUDED.name_primary,
          organisation_form_code = EXCLUDED.organisation_form_code,
          organisation_form_text = EXCLUDED.organisation_form_text,
          registration_date = EXCLUDED.registration_date,
          deregistration_date = EXCLUDED.deregistration_date,
          deregistration_reason_code = EXCLUDED.deregistration_reason_code,
          deregistration_reason_text = EXCLUDED.deregistration_reason_text,
          restructuring_status_jsonb = EXCLUDED.restructuring_status_jsonb,
          business_description = EXCLUDED.business_description,
          postal_address_jsonb = EXCLUDED.postal_address_jsonb,
          registrations_country_code = EXCLUDED.registrations_country_code,
          source_file_run_id = EXCLUDED.source_file_run_id,
          source_ingestion_run_id = EXCLUDED.source_ingestion_run_id,
          source_last_seen_at = EXCLUDED.source_last_seen_at,
          last_seen_at = EXCLUDED.last_seen_at,
          current_record_hash = EXCLUDED.current_record_hash,
          is_active = EXCLUDED.is_active,
          is_deregistered = EXCLUDED.is_deregistered,
          raw_postadress = EXCLUDED.raw_postadress,
          postal_address_line = EXCLUDED.postal_address_line,
          postal_co_address = EXCLUDED.postal_co_address,
          postal_city = EXCLUDED.postal_city,
          postal_code = EXCLUDED.postal_code,
          postal_country_code = EXCLUDED.postal_country_code,
          registration_country_label = EXCLUDED.registration_country_label,
          updated_at = NOW()
        RETURNING organisation_number
      )
      SELECT COUNT(*)::text AS c FROM upserted
      `,
      [runId, now],
    );

    const removedRes = await client.query<{ c: string }>(
      `
      WITH marked AS (
        UPDATE bv_bulk_company_current c
        SET is_active = FALSE,
            last_seen_at = $2,
            updated_at = NOW()
        WHERE c.source_file_run_id IS NOT NULL
          AND c.source_file_run_id <> $1
          AND NOT EXISTS (
            SELECT 1
            FROM bv_bulk_companies_staging s
            WHERE s.file_run_id = $1
              AND s.identity_value = c.organisation_number
          )
        RETURNING c.organisation_number
      )
      SELECT COUNT(*)::text AS c FROM marked
      `,
      [runId, now],
    );

    let seeded = 0;
    if (tenantId) {
      const seededRes = await client.query<{ c: string }>(
        `
        WITH inserted AS (
          INSERT INTO companies (
            id, tenant_id, organisation_number, legal_name, company_form, status, registered_at, country_code, business_description, source_payload_summary, created_at, updated_at
          )
          SELECT
            gen_random_uuid(),
            $2::uuid,
            c.organisation_number,
            COALESCE(c.name_primary, c.organisation_number),
            c.organisation_form_text,
            CASE WHEN c.is_deregistered THEN 'DEREGISTERED' ELSE 'ACTIVE' END,
            CASE WHEN c.registration_date IS NOT NULL THEN c.registration_date::date ELSE NULL END,
            COALESCE(NULLIF(c.registrations_country_code, ''), 'SE'),
            c.business_description,
            jsonb_build_object('depth_source', 'bolagsverket_bulk', 'source_file_run_id', c.source_file_run_id),
            NOW(),
            NOW()
          FROM bv_bulk_company_current c
          WHERE NOT EXISTS (
            SELECT 1 FROM companies x
            WHERE x.tenant_id = $2::uuid
              AND x.organisation_number = c.organisation_number
          )
        )
        SELECT COUNT(*)::text AS c FROM inserted
        `,
        [runId, tenantId],
      );
      seeded = Number(seededRes.rows[0]?.c ?? '0');
    }

    await client.query(
      `UPDATE bv_bulk_file_runs SET status = CASE WHEN status = 'failed' THEN status ELSE 'applied' END, updated_at = NOW() WHERE id = $1`,
      [runId],
    );

    await client.query('COMMIT');

    console.log(
      JSON.stringify(
        {
          runId,
          tenantId: tenantId || null,
          appliedUpserted: Number(upsertedRes.rows[0]?.c ?? '0'),
          removed: Number(removedRes.rows[0]?.c ?? '0'),
          seeded,
          atUtc: now.toISOString(),
          atStockholm: toStockholmTime(now),
        },
        null,
        2,
      ),
    );
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    await client.query(`SELECT pg_advisory_unlock(880014001::bigint)`).catch(() => undefined);
    await client.end();
  }
}

void main().catch((err) => {
  console.error('Promote staging failed:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});


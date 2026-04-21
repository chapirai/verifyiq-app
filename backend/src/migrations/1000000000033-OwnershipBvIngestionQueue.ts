import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Bolagsverket FI → ownership_links pipeline hook:
 * - lineage columns on ownership_links
 * - queue rows after bv_read refresh so Nest can ingest into ownership_links
 */
export class OwnershipBvIngestionQueue1000000000033 implements MigrationInterface {
  name = 'OwnershipBvIngestionQueue1000000000033';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
BEGIN;

ALTER TABLE public.ownership_links
  ADD COLUMN IF NOT EXISTS ingestion_source VARCHAR(96),
  ADD COLUMN IF NOT EXISTS fi_parsed_snapshot_id BIGINT
    REFERENCES bv_parsed.fi_organisation_snapshots(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS dedupe_key VARCHAR(192);

CREATE INDEX IF NOT EXISTS idx_ownership_links_tenant_owned_ingestion_current
  ON public.ownership_links (tenant_id, owned_organisation_number, ingestion_source)
  WHERE is_current = TRUE;

CREATE TABLE IF NOT EXISTS bv_pipeline.ownership_ingest_queue (
  id                  BIGSERIAL PRIMARY KEY,
  tenant_id           UUID NOT NULL,
  organisationsnummer VARCHAR(64) NOT NULL,
  refresh_queue_id    BIGINT REFERENCES bv_pipeline.refresh_queue(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at        TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_bv_ownership_ingest_pending
  ON bv_pipeline.ownership_ingest_queue (processed_at, id)
  WHERE processed_at IS NULL;

DROP PROCEDURE IF EXISTS bv_pipeline.process_refresh_queue(integer, text);

CREATE OR REPLACE PROCEDURE bv_pipeline.process_refresh_queue(p_batch_size integer, p_worker_name text)
LANGUAGE plpgsql AS $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT id, tenant_id, organisationsnummer, lookup_request_id, retry_count, max_retries
    FROM bv_pipeline.refresh_queue
    WHERE (status = 'pending')
       OR (status = 'retry' AND retry_count < max_retries)
    ORDER BY priority DESC, id
    FOR UPDATE SKIP LOCKED
    LIMIT p_batch_size
  LOOP
    UPDATE bv_pipeline.refresh_queue
    SET status = 'processing', locked_at = NOW(), locked_by = p_worker_name, updated_at = NOW()
    WHERE id = r.id;

    BEGIN
      PERFORM bv_read.refresh_company_current_all(r.tenant_id, r.organisationsnummer);

      INSERT INTO bv_pipeline.ownership_ingest_queue (tenant_id, organisationsnummer, refresh_queue_id)
      VALUES (r.tenant_id, r.organisationsnummer, r.id);

      UPDATE bv_pipeline.refresh_queue
      SET status = 'done', last_error = NULL, updated_at = NOW()
      WHERE id = r.id;

      IF r.lookup_request_id IS NOT NULL THEN
        UPDATE bv_pipeline.lookup_requests
        SET status = 'completed', updated_at = NOW()
        WHERE id = r.lookup_request_id;
      END IF;

    EXCEPTION WHEN OTHERS THEN
      UPDATE bv_pipeline.refresh_queue
      SET
        retry_count = bv_pipeline.refresh_queue.retry_count + 1,
        last_error = SQLERRM,
        status = CASE
          WHEN bv_pipeline.refresh_queue.retry_count + 1 >= bv_pipeline.refresh_queue.max_retries THEN 'failed'
          ELSE 'retry'
        END,
        updated_at = NOW()
      WHERE id = r.id;
      IF (SELECT status FROM bv_pipeline.refresh_queue WHERE id = r.id) = 'failed' AND r.lookup_request_id IS NOT NULL THEN
        UPDATE bv_pipeline.lookup_requests
        SET status = 'failed', error_message = SQLERRM, updated_at = NOW()
        WHERE id = r.lookup_request_id;
      END IF;
    END;
  END LOOP;
END;
$$;

COMMIT;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
BEGIN;

DROP PROCEDURE IF EXISTS bv_pipeline.process_refresh_queue(integer, text);

CREATE OR REPLACE PROCEDURE bv_pipeline.process_refresh_queue(p_batch_size integer, p_worker_name text)
LANGUAGE plpgsql AS $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT id, tenant_id, organisationsnummer, lookup_request_id, retry_count, max_retries
    FROM bv_pipeline.refresh_queue
    WHERE (status = 'pending')
       OR (status = 'retry' AND retry_count < max_retries)
    ORDER BY priority DESC, id
    FOR UPDATE SKIP LOCKED
    LIMIT p_batch_size
  LOOP
    UPDATE bv_pipeline.refresh_queue
    SET status = 'processing', locked_at = NOW(), locked_by = p_worker_name, updated_at = NOW()
    WHERE id = r.id;

    BEGIN
      PERFORM bv_read.refresh_company_current_all(r.tenant_id, r.organisationsnummer);
      UPDATE bv_pipeline.refresh_queue
      SET status = 'done', last_error = NULL, updated_at = NOW()
      WHERE id = r.id;

      IF r.lookup_request_id IS NOT NULL THEN
        UPDATE bv_pipeline.lookup_requests
        SET status = 'completed', updated_at = NOW()
        WHERE id = r.lookup_request_id;
      END IF;

    EXCEPTION WHEN OTHERS THEN
      UPDATE bv_pipeline.refresh_queue
      SET
        retry_count = bv_pipeline.refresh_queue.retry_count + 1,
        last_error = SQLERRM,
        status = CASE
          WHEN bv_pipeline.refresh_queue.retry_count + 1 >= bv_pipeline.refresh_queue.max_retries THEN 'failed'
          ELSE 'retry'
        END,
        updated_at = NOW()
      WHERE id = r.id;
      IF (SELECT status FROM bv_pipeline.refresh_queue WHERE id = r.id) = 'failed' AND r.lookup_request_id IS NOT NULL THEN
        UPDATE bv_pipeline.lookup_requests
        SET status = 'failed', error_message = SQLERRM, updated_at = NOW()
        WHERE id = r.lookup_request_id;
      END IF;
    END;
  END LOOP;
END;
$$;

DROP INDEX IF EXISTS bv_pipeline.idx_bv_ownership_ingest_pending;
DROP TABLE IF EXISTS bv_pipeline.ownership_ingest_queue;

DROP INDEX IF EXISTS public.idx_ownership_links_tenant_owned_ingestion_current;

ALTER TABLE public.ownership_links
  DROP COLUMN IF EXISTS dedupe_key,
  DROP COLUMN IF EXISTS fi_parsed_snapshot_id,
  DROP COLUMN IF EXISTS ingestion_source;

COMMIT;
    `);
  }
}

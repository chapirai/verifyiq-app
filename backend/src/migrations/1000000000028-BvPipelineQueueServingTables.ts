import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Queue-driven BV parse/refresh pipeline; replaces bv_read views with physical tables;
 * removes AFTER INSERT trigger on bv_raw_payloads; fixes dispatch for provider_source = bolagsverket.
 */
export class BvPipelineQueueServingTables1000000000028 implements MigrationInterface {
  name = 'BvPipelineQueueServingTables1000000000028';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
BEGIN;

CREATE SCHEMA IF NOT EXISTS bv_pipeline;

-- ── Lookup lifecycle ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bv_pipeline.lookup_requests (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL,
  organisationsnummer   VARCHAR(64) NOT NULL,
  status                VARCHAR(32) NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'parsing', 'refreshing', 'completed', 'failed')),
  correlation_id        UUID,
  error_message         TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bv_lookup_requests_tenant_org
  ON bv_pipeline.lookup_requests (tenant_id, organisationsnummer, created_at DESC);

-- ── Parse queue ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bv_pipeline.parse_queue (
  id                    BIGSERIAL PRIMARY KEY,
  raw_payload_id        UUID NOT NULL REFERENCES public.bv_raw_payloads(id) ON DELETE CASCADE,
  lookup_request_id     UUID REFERENCES bv_pipeline.lookup_requests(id) ON DELETE SET NULL,
  status                VARCHAR(32) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'retry', 'done', 'failed')),
  priority              INTEGER NOT NULL DEFAULT 0,
  retry_count           INTEGER NOT NULL DEFAULT 0,
  max_retries           INTEGER NOT NULL DEFAULT 5,
  last_error            TEXT,
  locked_at             TIMESTAMPTZ,
  locked_by             TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bv_parse_queue_pending
  ON bv_pipeline.parse_queue (status, priority DESC, id)
  WHERE status IN ('pending', 'retry');

-- ── Refresh queue ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bv_pipeline.refresh_queue (
  id                    BIGSERIAL PRIMARY KEY,
  tenant_id             UUID NOT NULL,
  organisationsnummer VARCHAR(64) NOT NULL,
  lookup_request_id     UUID REFERENCES bv_pipeline.lookup_requests(id) ON DELETE SET NULL,
  status                VARCHAR(32) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'retry', 'done', 'failed')),
  priority              INTEGER NOT NULL DEFAULT 0,
  retry_count           INTEGER NOT NULL DEFAULT 0,
  max_retries           INTEGER NOT NULL DEFAULT 5,
  last_error            TEXT,
  locked_at             TIMESTAMPTZ,
  locked_by             TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bv_refresh_queue_pending
  ON bv_pipeline.refresh_queue (status, priority DESC, id)
  WHERE status IN ('pending', 'retry');

-- ── Enqueue (explicit; no trigger) ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION bv_pipeline.enqueue_raw_payload_for_parse(
  p_raw_payload_id uuid,
  p_lookup_request_id uuid DEFAULT NULL,
  p_priority integer DEFAULT 0
)
RETURNS bigint
LANGUAGE plpgsql
AS $$
DECLARE
  v_id bigint;
BEGIN
  INSERT INTO bv_pipeline.parse_queue (raw_payload_id, lookup_request_id, priority, status)
  VALUES (p_raw_payload_id, p_lookup_request_id, p_priority, 'pending')
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- ── Remove trigger-based parse dispatch ─────────────────────────────────────
DROP TRIGGER IF EXISTS trg_bv_raw_payloads_dispatch ON public.bv_raw_payloads;
DROP FUNCTION IF EXISTS bv_parsed.trg_dispatch_raw_payload();

-- ── Fix dispatcher: orchestrated rows use provider_source = bolagsverket ─────
CREATE OR REPLACE FUNCTION bv_parsed.dispatch_raw_payload(p_raw_payload_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_raw public.bv_raw_payloads%rowtype;
BEGIN
  SELECT * INTO v_raw FROM public.bv_raw_payloads WHERE id = p_raw_payload_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Raw payload % not found', p_raw_payload_id;
  END IF;

  BEGIN
    IF v_raw.provider_source IN ('FI_ORGANISATIONER', 'ORCHESTRATED_LOOKUP', 'BV_ORCHESTRATED', 'bolagsverket') THEN
      PERFORM bv_parsed.load_fi_organisation_from_raw(p_raw_payload_id);
    END IF;

    IF v_raw.provider_source IN ('HVD_ORGANISATIONER', 'ORCHESTRATED_LOOKUP', 'BV_ORCHESTRATED', 'bolagsverket') THEN
      PERFORM bv_parsed.load_hvd_organisation_from_raw(p_raw_payload_id);
    END IF;

    IF v_raw.provider_source IN ('HVD_DOKUMENTLISTA') OR (v_raw.content ? 'dokument') THEN
      PERFORM bv_parsed.load_hvd_dokumentlista_from_raw(p_raw_payload_id);
    END IF;

    INSERT INTO bv_parsed.parse_runs (
      raw_payload_id, tenant_id, organisationsnummer, provider_source, parsed_ok, parsed_at
    ) VALUES (
      v_raw.id, v_raw.tenant_id, v_raw.organisationsnummer, v_raw.provider_source, TRUE, NOW()
    )
    ON CONFLICT (raw_payload_id) DO UPDATE
    SET parsed_ok = TRUE, parse_error = NULL, parsed_at = EXCLUDED.parsed_at;

  EXCEPTION WHEN OTHERS THEN
    INSERT INTO bv_parsed.parse_runs (
      raw_payload_id, tenant_id, organisationsnummer, provider_source, parsed_ok, parse_error, parsed_at
    ) VALUES (
      v_raw.id, v_raw.tenant_id, v_raw.organisationsnummer, v_raw.provider_source, FALSE, SQLERRM, NOW()
    )
    ON CONFLICT (raw_payload_id) DO UPDATE
    SET parsed_ok = FALSE, parse_error = EXCLUDED.parse_error, parsed_at = EXCLUDED.parsed_at;
    RAISE;
  END;
END;
$$;

-- ── Replace bv_read views with physical tables ─────────────────────────────
DROP VIEW IF EXISTS bv_read.company_hvd_documents_current CASCADE;
DROP VIEW IF EXISTS bv_read.company_fi_reports_current CASCADE;
DROP VIEW IF EXISTS bv_read.company_officers_current CASCADE;
DROP VIEW IF EXISTS bv_read.company_overview_current CASCADE;

CREATE SCHEMA IF NOT EXISTS bv_read;

CREATE TABLE bv_read.company_overview_current (
  tenant_id UUID NOT NULL,
  organisationsnummer VARCHAR(64) NOT NULL,
  organisationsnamn VARCHAR(255),
  organisationsform_klartext VARCHAR(255),
  organisationsdatum_registreringsdatum DATE,
  organisationsdatum_bildat_datum DATE,
  verksamhetsbeskrivning TEXT,
  hemvist_kommun_klartext VARCHAR(128),
  hemvist_lan_klartext VARCHAR(128),
  rakenskapsar_inleds VARCHAR(16),
  rakenskapsar_avslutas VARCHAR(16),
  aktiekapital_belopp NUMERIC(20,2),
  aktiekapital_valuta VARCHAR(16),
  antal_aktier NUMERIC(20,2),
  verksam_organisation_kod VARCHAR(16),
  registreringsland_klartext VARCHAR(128),
  organisationsadress_postadress VARCHAR(255),
  organisationsadress_postnummer VARCHAR(32),
  organisationsadress_postort VARCHAR(128),
  organisationsadress_epost VARCHAR(255),
  firmateckning_klartext TEXT,
  antal_valda_ledamoter INTEGER,
  antal_valda_suppleanter INTEGER,
  identitet_typ_klartext VARCHAR(255),
  data_refreshed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (tenant_id, organisationsnummer)
);

CREATE TABLE bv_read.company_officers_current (
  tenant_id UUID NOT NULL,
  organisationsnummer VARCHAR(64) NOT NULL,
  funktionar_id BIGINT NOT NULL,
  fi_funktionar_roll_id BIGINT NOT NULL DEFAULT 0,
  fornamn VARCHAR(128),
  efternamn VARCHAR(128),
  identitetsbeteckning VARCHAR(64),
  postadress_adress VARCHAR(255),
  postadress_postnummer VARCHAR(32),
  postadress_postort VARCHAR(128),
  roll_kod VARCHAR(64),
  roll_klartext VARCHAR(255),
  data_refreshed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (tenant_id, organisationsnummer, funktionar_id, fi_funktionar_roll_id)
);

CREATE TABLE bv_read.company_fi_reports_current (
  tenant_id UUID NOT NULL,
  organisationsnummer VARCHAR(64) NOT NULL,
  report_id BIGINT NOT NULL,
  rapporttyp_kod VARCHAR(64),
  rapporttyp_klartext VARCHAR(255),
  period_from DATE,
  period_tom DATE,
  ankom_datum DATE,
  registrerad_datum DATE,
  innehaller_koncernredovisning BOOLEAN,
  vinstutdelning_belopp NUMERIC(20,2),
  vinstutdelning_valuta_kod VARCHAR(16),
  vinstutdelning_beslutad_datum DATE,
  data_refreshed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (tenant_id, organisationsnummer, report_id)
);

CREATE TABLE bv_read.company_hvd_documents_current (
  tenant_id UUID NOT NULL,
  organisationsnummer VARCHAR(64) NOT NULL,
  dokument_id VARCHAR(128) NOT NULL,
  filformat VARCHAR(64),
  registreringstidpunkt DATE,
  rapporteringsperiod_tom DATE,
  data_refreshed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (tenant_id, organisationsnummer, dokument_id)
);

CREATE TABLE bv_read.company_fi_cases_current (
  tenant_id UUID NOT NULL,
  organisationsnummer VARCHAR(64) NOT NULL,
  arende_rank INTEGER NOT NULL,
  arendenummer VARCHAR(64),
  avslutat_tidpunkt TIMESTAMPTZ,
  arendetyp VARCHAR(128),
  status VARCHAR(128),
  data_refreshed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (tenant_id, organisationsnummer, arende_rank)
);

CREATE TABLE bv_read.company_share_capital_current (
  tenant_id UUID NOT NULL,
  organisationsnummer VARCHAR(64) NOT NULL,
  aktiekapital_belopp NUMERIC(20,2),
  aktiekapital_valuta VARCHAR(16),
  antal_aktier NUMERIC(20,2),
  kvotvarde_belopp NUMERIC(20,6),
  kvotvarde_valuta VARCHAR(16),
  aktiekapital_grans_lagst NUMERIC(20,2),
  aktiekapital_grans_hogst NUMERIC(20,2),
  antal_aktier_grans_lagst NUMERIC(20,2),
  antal_aktier_grans_hogst NUMERIC(20,2),
  aktiegranser_valuta VARCHAR(16),
  data_refreshed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (tenant_id, organisationsnummer)
);

CREATE TABLE bv_read.company_engagements_current (
  tenant_id UUID NOT NULL,
  organisationsnummer VARCHAR(64) NOT NULL,
  engagement_rank INTEGER NOT NULL,
  related_organisation_name VARCHAR(512),
  related_organisation_number VARCHAR(64),
  engagement_type_kod VARCHAR(64),
  engagement_type_klartext VARCHAR(255),
  role_kod VARCHAR(64),
  role_klartext VARCHAR(255),
  person_or_organisation_name VARCHAR(512),
  data_refreshed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (tenant_id, organisationsnummer, engagement_rank)
);

CREATE INDEX IF NOT EXISTS idx_bv_read_overview_tenant ON bv_read.company_overview_current (tenant_id);
CREATE INDEX IF NOT EXISTS idx_bv_read_officers_tenant ON bv_read.company_officers_current (tenant_id);
CREATE INDEX IF NOT EXISTS idx_bv_read_reports_tenant ON bv_read.company_fi_reports_current (tenant_id);
CREATE INDEX IF NOT EXISTS idx_bv_read_docs_tenant ON bv_read.company_hvd_documents_current (tenant_id);

-- ── Refresh functions (per slice + all) ─────────────────────────────────────
CREATE OR REPLACE FUNCTION bv_read.refresh_company_overview_current(p_tenant uuid, p_org varchar)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM bv_read.company_overview_current
  WHERE tenant_id = p_tenant AND organisationsnummer = p_org;
  INSERT INTO bv_read.company_overview_current (
    tenant_id, organisationsnummer, organisationsnamn, organisationsform_klartext,
    organisationsdatum_registreringsdatum, organisationsdatum_bildat_datum, verksamhetsbeskrivning,
    hemvist_kommun_klartext, hemvist_lan_klartext, rakenskapsar_inleds, rakenskapsar_avslutas,
    aktiekapital_belopp, aktiekapital_valuta, antal_aktier,
    verksam_organisation_kod, registreringsland_klartext,
    organisationsadress_postadress, organisationsadress_postnummer, organisationsadress_postort, organisationsadress_epost,
    firmateckning_klartext, antal_valda_ledamoter, antal_valda_suppleanter, identitet_typ_klartext,
    data_refreshed_at
  )
  SELECT
    fi.tenant_id,
    fi.organisationsnummer,
    fi.organisationsnamn,
    fi.organisationsform_klartext,
    fi.organisationsdatum_registreringsdatum,
    fi.organisationsdatum_bildat_datum,
    fi.verksamhetsbeskrivning,
    fi.hemvist_kommun_klartext,
    fi.hemvist_lan_klartext,
    fi.rakenskapsar_inleds,
    fi.rakenskapsar_avslutas,
    fi.aktiekapital_belopp,
    fi.aktiekapital_valuta,
    fi.antal_aktier,
    hvd.verksam_organisation_kod,
    hvd.registreringsland_klartext,
    fi.organisationsadress_postadress,
    fi.organisationsadress_postnummer,
    fi.organisationsadress_postort,
    fi.organisationsadress_epost,
    fi.firmateckning_klartext,
    fi.antal_valda_ledamoter,
    fi.antal_valda_suppleanter,
    fi.identitet_typ_klartext,
    NOW()
  FROM bv_parsed.v_fi_organisation_latest fi
  LEFT JOIN bv_parsed.v_hvd_organisation_latest hvd
    ON hvd.organisationsnummer = fi.organisationsnummer AND hvd.tenant_id = fi.tenant_id
  WHERE fi.tenant_id = p_tenant AND fi.organisationsnummer = p_org;
END;
$$;

CREATE OR REPLACE FUNCTION bv_read.refresh_company_officers_current(p_tenant uuid, p_org varchar)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM bv_read.company_officers_current
  WHERE tenant_id = p_tenant AND organisationsnummer = p_org;
  INSERT INTO bv_read.company_officers_current (
    tenant_id, organisationsnummer, funktionar_id, fi_funktionar_roll_id,
    fornamn, efternamn, identitetsbeteckning,
    postadress_adress, postadress_postnummer, postadress_postort,
    roll_kod, roll_klartext, data_refreshed_at
  )
  SELECT
    f.tenant_id,
    f.organisationsnummer,
    fun.id,
    COALESCE(r.id, 0),
    fun.fornamn,
    fun.efternamn,
    fun.identitetsbeteckning,
    fun.postadress_adress,
    fun.postadress_postnummer,
    fun.postadress_postort,
    r.roll_kod,
    r.roll_klartext,
    NOW()
  FROM bv_parsed.v_fi_organisation_latest f
  JOIN bv_parsed.fi_funktionarer fun ON fun.fi_organisation_snapshot_id = f.id
  LEFT JOIN bv_parsed.fi_funktionar_roller r ON r.fi_funktionar_id = fun.id
  WHERE f.tenant_id = p_tenant AND f.organisationsnummer = p_org;
END;
$$;

CREATE OR REPLACE FUNCTION bv_read.refresh_company_fi_reports_current(p_tenant uuid, p_org varchar)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM bv_read.company_fi_reports_current
  WHERE tenant_id = p_tenant AND organisationsnummer = p_org;
  INSERT INTO bv_read.company_fi_reports_current (
    tenant_id, organisationsnummer, report_id, rapporttyp_kod, rapporttyp_klartext,
    period_from, period_tom, ankom_datum, registrerad_datum, innehaller_koncernredovisning,
    vinstutdelning_belopp, vinstutdelning_valuta_kod, vinstutdelning_beslutad_datum, data_refreshed_at
  )
  SELECT
    f.tenant_id,
    f.organisationsnummer,
    r.id,
    r.rapporttyp_kod,
    r.rapporttyp_klartext,
    r.period_from,
    r.period_tom,
    r.ankom_datum,
    r.registrerad_datum,
    r.innehaller_koncernredovisning,
    r.vinstutdelning_belopp,
    r.vinstutdelning_valuta_kod,
    r.vinstutdelning_beslutad_datum,
    NOW()
  FROM bv_parsed.v_fi_organisation_latest f
  JOIN bv_parsed.fi_finansiella_rapport_arenden a ON a.fi_organisation_snapshot_id = f.id
  JOIN bv_parsed.fi_finansiella_rapporter r ON r.fi_finansiell_rapport_arende_id = a.id
  WHERE f.tenant_id = p_tenant AND f.organisationsnummer = p_org;
END;
$$;

CREATE OR REPLACE FUNCTION bv_read.refresh_company_hvd_documents_current(p_tenant uuid, p_org varchar)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM bv_read.company_hvd_documents_current
  WHERE tenant_id = p_tenant AND organisationsnummer = p_org;
  INSERT INTO bv_read.company_hvd_documents_current (
    tenant_id, organisationsnummer, dokument_id, filformat, registreringstidpunkt, rapporteringsperiod_tom, data_refreshed_at
  )
  SELECT d.tenant_id, d.organisationsnummer, d.dokument_id, d.filformat, d.registreringstidpunkt, d.rapporteringsperiod_tom, NOW()
  FROM bv_parsed.v_hvd_dokument_latest d
  WHERE d.tenant_id = p_tenant AND d.organisationsnummer = p_org;
END;
$$;

CREATE OR REPLACE FUNCTION bv_read.refresh_company_fi_cases_current(p_tenant uuid, p_org varchar)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM bv_read.company_fi_cases_current WHERE tenant_id = p_tenant AND organisationsnummer = p_org;
  INSERT INTO bv_read.company_fi_cases_current (
    tenant_id, organisationsnummer, arende_rank, arendenummer, avslutat_tidpunkt, arendetyp, status, data_refreshed_at
  )
  SELECT p_tenant, p_org, s.rk, s.arendenummer, s.avslutat_tidpunkt, s.arendetyp, NULL::varchar, NOW()
  FROM (
    SELECT row_number() OVER (ORDER BY src_pri, arendenummer) AS rk,
           arendenummer, avslutat_tidpunkt, arendetyp, src_pri
    FROM (
      SELECT f.arendenummer, f.arende_avslutat_tidpunkt AS avslutat_tidpunkt, 'Organisation'::varchar AS arendetyp, 0 AS src_pri
      FROM bv_parsed.v_fi_organisation_latest f
      WHERE f.tenant_id = p_tenant AND f.organisationsnummer = p_org AND f.arendenummer IS NOT NULL
      UNION ALL
      SELECT a.arendenummer, a.avslutat_tidpunkt, 'Finansiell rapport'::varchar, 1
      FROM bv_parsed.fi_finansiella_rapport_arenden a
      JOIN bv_parsed.v_fi_organisation_latest f ON f.id = a.fi_organisation_snapshot_id
      WHERE f.tenant_id = p_tenant AND f.organisationsnummer = p_org
    ) u
  ) s;
END;
$$;

CREATE OR REPLACE FUNCTION bv_read.refresh_company_share_capital_current(p_tenant uuid, p_org varchar)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM bv_read.company_share_capital_current WHERE tenant_id = p_tenant AND organisationsnummer = p_org;
  INSERT INTO bv_read.company_share_capital_current (
    tenant_id, organisationsnummer, aktiekapital_belopp, aktiekapital_valuta, antal_aktier,
    kvotvarde_belopp, kvotvarde_valuta, aktiekapital_grans_lagst, aktiekapital_grans_hogst,
    antal_aktier_grans_lagst, antal_aktier_grans_hogst, aktiegranser_valuta, data_refreshed_at
  )
  SELECT
    f.tenant_id, f.organisationsnummer,
    f.aktiekapital_belopp, f.aktiekapital_valuta, f.antal_aktier,
    f.kvotvarde_belopp, f.kvotvarde_valuta,
    f.aktiekapital_grans_lagst, f.aktiekapital_grans_hogst,
    f.antal_aktier_grans_lagst, f.antal_aktier_grans_hogst, f.aktiegranser_valuta,
    NOW()
  FROM bv_parsed.v_fi_organisation_latest f
  WHERE f.tenant_id = p_tenant AND f.organisationsnummer = p_org;
END;
$$;

CREATE OR REPLACE FUNCTION bv_read.refresh_company_engagements_current(p_tenant uuid, p_org varchar)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM bv_read.company_engagements_current WHERE tenant_id = p_tenant AND organisationsnummer = p_org;
  INSERT INTO bv_read.company_engagements_current (
    tenant_id, organisationsnummer, engagement_rank,
    related_organisation_name, related_organisation_number,
    engagement_type_kod, engagement_type_klartext, role_kod, role_klartext,
    person_or_organisation_name, data_refreshed_at
  )
  SELECT
    p_tenant,
    p_org,
    ordinality::int,
    COALESCE(e->'organisation'->'organisationsnamn'->>'namn', e->'organisation'->>'namn'),
    COALESCE(e->'organisation'->'identitet'->>'identitetsbeteckning', e->'organisation'->>'identitetsbeteckning'),
    NULL, NULL, NULL, NULL,
    COALESCE(
      TRIM(CONCAT(e->'funktionar'->'personnamn'->>'fornamn', ' ', e->'funktionar'->'personnamn'->>'efternamn')),
      e->'funktionar'->'organisationsnamn'->>'namn',
      e->'funktionar'->>'namn'
    ),
    NOW()
  FROM bv_parsed.v_fi_organisation_latest f,
       jsonb_array_elements(COALESCE(f.raw_item->'organisationsengagemang'->'funktionarsOrganisationsengagemang', '[]'::jsonb))
         WITH ORDINALITY AS t(e, ordinality)
  WHERE f.tenant_id = p_tenant AND f.organisationsnummer = p_org;
END;
$$;

CREATE OR REPLACE FUNCTION bv_read.refresh_company_current_all(p_tenant uuid, p_org varchar)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM bv_read.refresh_company_overview_current(p_tenant, p_org);
  PERFORM bv_read.refresh_company_officers_current(p_tenant, p_org);
  PERFORM bv_read.refresh_company_fi_reports_current(p_tenant, p_org);
  PERFORM bv_read.refresh_company_hvd_documents_current(p_tenant, p_org);
  PERFORM bv_read.refresh_company_fi_cases_current(p_tenant, p_org);
  PERFORM bv_read.refresh_company_share_capital_current(p_tenant, p_org);
  PERFORM bv_read.refresh_company_engagements_current(p_tenant, p_org);
END;
$$;

-- ── Worker procedures (CALL from app / ops) ─────────────────────────────────
CREATE OR REPLACE PROCEDURE bv_pipeline.process_parse_queue(p_batch_size integer, p_worker_name text)
LANGUAGE plpgsql AS $$
DECLARE
  r RECORD;
  v_tenant uuid;
  v_org varchar;
BEGIN
  FOR r IN
    SELECT id, raw_payload_id, lookup_request_id, retry_count, max_retries
    FROM bv_pipeline.parse_queue
    WHERE (status = 'pending')
       OR (status = 'retry' AND retry_count < max_retries)
    ORDER BY priority DESC, id
    FOR UPDATE SKIP LOCKED
    LIMIT p_batch_size
  LOOP
    UPDATE bv_pipeline.parse_queue
    SET status = 'processing', locked_at = NOW(), locked_by = p_worker_name, updated_at = NOW()
    WHERE id = r.id;

    IF r.lookup_request_id IS NOT NULL THEN
      UPDATE bv_pipeline.lookup_requests
      SET status = 'parsing', updated_at = NOW()
      WHERE id = r.lookup_request_id AND status IN ('queued', 'parsing');
    END IF;

    BEGIN
      PERFORM bv_parsed.dispatch_raw_payload(r.raw_payload_id);

      SELECT tenant_id, organisationsnummer INTO v_tenant, v_org
      FROM public.bv_raw_payloads WHERE id = r.raw_payload_id;

      UPDATE bv_pipeline.parse_queue
      SET status = 'done', last_error = NULL, updated_at = NOW()
      WHERE id = r.id;

      INSERT INTO bv_pipeline.refresh_queue (tenant_id, organisationsnummer, lookup_request_id, status, priority)
      VALUES (v_tenant, v_org, r.lookup_request_id, 'pending', 0);

    EXCEPTION WHEN OTHERS THEN
      UPDATE bv_pipeline.parse_queue
      SET
        retry_count = bv_pipeline.parse_queue.retry_count + 1,
        last_error = SQLERRM,
        status = CASE
          WHEN bv_pipeline.parse_queue.retry_count + 1 >= bv_pipeline.parse_queue.max_retries THEN 'failed'
          ELSE 'retry'
        END,
        updated_at = NOW()
      WHERE id = r.id;
      IF (SELECT status FROM bv_pipeline.parse_queue WHERE id = r.id) = 'failed' AND r.lookup_request_id IS NOT NULL THEN
        UPDATE bv_pipeline.lookup_requests
        SET status = 'failed', error_message = SQLERRM, updated_at = NOW()
        WHERE id = r.lookup_request_id;
      END IF;
    END;
  END LOOP;
END;
$$;

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

COMMIT;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
BEGIN;

DROP PROCEDURE IF EXISTS bv_pipeline.process_refresh_queue(integer, text);
DROP PROCEDURE IF EXISTS bv_pipeline.process_parse_queue(integer, text);

DROP FUNCTION IF EXISTS bv_read.refresh_company_current_all(uuid, varchar);
DROP FUNCTION IF EXISTS bv_read.refresh_company_engagements_current(uuid, varchar);
DROP FUNCTION IF EXISTS bv_read.refresh_company_share_capital_current(uuid, varchar);
DROP FUNCTION IF EXISTS bv_read.refresh_company_fi_cases_current(uuid, varchar);
DROP FUNCTION IF EXISTS bv_read.refresh_company_hvd_documents_current(uuid, varchar);
DROP FUNCTION IF EXISTS bv_read.refresh_company_fi_reports_current(uuid, varchar);
DROP FUNCTION IF EXISTS bv_read.refresh_company_officers_current(uuid, varchar);
DROP FUNCTION IF EXISTS bv_read.refresh_company_overview_current(uuid, varchar);

DROP TABLE IF EXISTS bv_read.company_engagements_current;
DROP TABLE IF EXISTS bv_read.company_share_capital_current;
DROP TABLE IF EXISTS bv_read.company_fi_cases_current;
DROP TABLE IF EXISTS bv_read.company_hvd_documents_current;
DROP TABLE IF EXISTS bv_read.company_fi_reports_current;
DROP TABLE IF EXISTS bv_read.company_officers_current;
DROP TABLE IF EXISTS bv_read.company_overview_current;

DROP FUNCTION IF EXISTS bv_pipeline.enqueue_raw_payload_for_parse(uuid, uuid, integer);

DROP TABLE IF EXISTS bv_pipeline.refresh_queue;
DROP TABLE IF EXISTS bv_pipeline.parse_queue;
DROP TABLE IF EXISTS bv_pipeline.lookup_requests;
DROP SCHEMA IF EXISTS bv_pipeline;

-- Restore dispatch without bolagsverket + trigger (match 0026)
CREATE OR REPLACE FUNCTION bv_parsed.dispatch_raw_payload(p_raw_payload_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_raw public.bv_raw_payloads%rowtype;
BEGIN
  SELECT * INTO v_raw FROM public.bv_raw_payloads WHERE id = p_raw_payload_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Raw payload % not found', p_raw_payload_id;
  END IF;
  BEGIN
    IF v_raw.provider_source IN ('FI_ORGANISATIONER', 'ORCHESTRATED_LOOKUP', 'BV_ORCHESTRATED') THEN
      PERFORM bv_parsed.load_fi_organisation_from_raw(p_raw_payload_id);
    END IF;
    IF v_raw.provider_source IN ('HVD_ORGANISATIONER', 'ORCHESTRATED_LOOKUP', 'BV_ORCHESTRATED') THEN
      PERFORM bv_parsed.load_hvd_organisation_from_raw(p_raw_payload_id);
    END IF;
    IF v_raw.provider_source IN ('HVD_DOKUMENTLISTA') OR (v_raw.content ? 'dokument') THEN
      PERFORM bv_parsed.load_hvd_dokumentlista_from_raw(p_raw_payload_id);
    END IF;
    INSERT INTO bv_parsed.parse_runs (
      raw_payload_id, tenant_id, organisationsnummer, provider_source, parsed_ok, parsed_at
    ) VALUES (
      v_raw.id, v_raw.tenant_id, v_raw.organisationsnummer, v_raw.provider_source, TRUE, NOW()
    )
    ON CONFLICT (raw_payload_id) DO UPDATE
    SET parsed_ok = TRUE, parse_error = NULL, parsed_at = EXCLUDED.parsed_at;
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO bv_parsed.parse_runs (
      raw_payload_id, tenant_id, organisationsnummer, provider_source, parsed_ok, parse_error, parsed_at
    ) VALUES (
      v_raw.id, v_raw.tenant_id, v_raw.organisationsnummer, v_raw.provider_source, FALSE, SQLERRM, NOW()
    )
    ON CONFLICT (raw_payload_id) DO UPDATE
    SET parsed_ok = FALSE, parse_error = EXCLUDED.parse_error, parsed_at = EXCLUDED.parsed_at;
    RAISE;
  END;
END;
$$;

CREATE OR REPLACE FUNCTION bv_parsed.trg_dispatch_raw_payload()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM bv_parsed.dispatch_raw_payload(NEW.id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_bv_raw_payloads_dispatch
AFTER INSERT ON public.bv_raw_payloads
FOR EACH ROW
EXECUTE FUNCTION bv_parsed.trg_dispatch_raw_payload();

-- Restore views from 0027
CREATE SCHEMA IF NOT EXISTS bv_read;

CREATE OR REPLACE VIEW bv_read.company_overview_current AS
SELECT
    fi.tenant_id,
    fi.organisationsnummer,
    fi.organisationsnamn,
    fi.organisationsform_klartext,
    fi.organisationsdatum_registreringsdatum,
    fi.organisationsdatum_bildat_datum,
    fi.verksamhetsbeskrivning,
    fi.hemvist_kommun_klartext,
    fi.hemvist_lan_klartext,
    fi.rakenskapsar_inleds,
    fi.rakenskapsar_avslutas,
    fi.aktiekapital_belopp,
    fi.aktiekapital_valuta,
    fi.antal_aktier,
    hvd.verksam_organisation_kod,
    hvd.registreringsland_klartext
FROM bv_parsed.v_fi_organisation_latest fi
LEFT JOIN bv_parsed.v_hvd_organisation_latest hvd
  ON hvd.organisationsnummer = fi.organisationsnummer
 AND hvd.tenant_id = fi.tenant_id;

CREATE OR REPLACE VIEW bv_read.company_officers_current AS
SELECT
    f.tenant_id,
    f.organisationsnummer,
    fun.id AS funktionar_id,
    fun.fornamn,
    fun.efternamn,
    fun.identitetsbeteckning,
    fun.postadress_adress,
    fun.postadress_postnummer,
    fun.postadress_postort,
    r.roll_kod,
    r.roll_klartext
FROM bv_parsed.v_fi_organisation_latest f
JOIN bv_parsed.fi_funktionarer fun ON fun.fi_organisation_snapshot_id = f.id
LEFT JOIN bv_parsed.fi_funktionar_roller r ON r.fi_funktionar_id = fun.id;

CREATE OR REPLACE VIEW bv_read.company_fi_reports_current AS
SELECT
    f.tenant_id,
    f.organisationsnummer,
    r.id AS report_id,
    r.rapporttyp_kod,
    r.rapporttyp_klartext,
    r.period_from,
    r.period_tom,
    r.ankom_datum,
    r.registrerad_datum,
    r.innehaller_koncernredovisning,
    r.vinstutdelning_belopp,
    r.vinstutdelning_valuta_kod,
    r.vinstutdelning_beslutad_datum
FROM bv_parsed.v_fi_organisation_latest f
JOIN bv_parsed.fi_finansiella_rapport_arenden a ON a.fi_organisation_snapshot_id = f.id
JOIN bv_parsed.fi_finansiella_rapporter r ON r.fi_finansiell_rapport_arende_id = a.id;

CREATE OR REPLACE VIEW bv_read.company_hvd_documents_current AS
SELECT
    d.tenant_id,
    d.organisationsnummer,
    d.dokument_id,
    d.filformat,
    d.registreringstidpunkt,
    d.rapporteringsperiod_tom
FROM bv_parsed.v_hvd_dokument_latest d;

COMMIT;
    `);
  }
}

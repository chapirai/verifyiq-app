import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBvParsedPayloadTables1000000000026 implements MigrationInterface {
  name = 'AddBvParsedPayloadTables1000000000026';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
BEGIN;

CREATE SCHEMA IF NOT EXISTS bv_parsed;

-- =========================================================
-- 1. Helper functions
-- =========================================================

CREATE OR REPLACE FUNCTION bv_parsed.try_date(p_text text)
RETURNS date
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF p_text IS NULL OR btrim(p_text) = '' THEN
    RETURN NULL;
  END IF;
  RETURN p_text::date;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION bv_parsed.try_timestamptz(p_text text)
RETURNS timestamptz
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF p_text IS NULL OR btrim(p_text) = '' THEN
    RETURN NULL;
  END IF;
  RETURN p_text::timestamptz;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION bv_parsed.try_numeric(p_text text)
RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF p_text IS NULL OR btrim(p_text) = '' THEN
    RETURN NULL;
  END IF;
  RETURN p_text::numeric;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$;

-- =========================================================
-- 2. Parse audit
-- =========================================================

CREATE TABLE IF NOT EXISTS bv_parsed.parse_runs (
  parse_run_id         BIGSERIAL PRIMARY KEY,
  raw_payload_id       UUID NOT NULL UNIQUE
                         REFERENCES bv_raw_payloads(id) ON DELETE CASCADE,
  tenant_id            UUID,
  organisationsnummer  VARCHAR(64),
  provider_source      VARCHAR(64),
  parsed_ok            BOOLEAN NOT NULL DEFAULT FALSE,
  parse_error          TEXT,
  parsed_at            TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bv_parsed_parse_runs_tenant_org
  ON bv_parsed.parse_runs (tenant_id, organisationsnummer, parsed_at DESC);

-- =========================================================
-- 3. HVD organisation parsed snapshots
-- =========================================================

CREATE TABLE IF NOT EXISTS bv_parsed.hvd_organisation_snapshots (
  id                                BIGSERIAL PRIMARY KEY,
  raw_payload_id                    UUID NOT NULL
                                      REFERENCES bv_raw_payloads(id) ON DELETE CASCADE,
  tenant_id                         UUID NOT NULL,
  organisationsnummer               VARCHAR(64) NOT NULL,
  snapshot_id                       UUID
                                      REFERENCES bolagsverket_fetch_snapshots(id) ON DELETE SET NULL,
  provider_source                   VARCHAR(64) NOT NULL,
  payload_created_at                TIMESTAMPTZ NOT NULL,
  source_index                      INTEGER NOT NULL DEFAULT 1,

  juridisk_form_kod                 VARCHAR(32),
  juridisk_form_klartext            VARCHAR(255),
  organisationsform_kod             VARCHAR(32),
  organisationsform_klartext        VARCHAR(255),
  registreringsland_kod             VARCHAR(16),
  registreringsland_klartext        VARCHAR(128),
  organisationsdatum_registreringsdatum DATE,
  verksam_organisation_kod          VARCHAR(16),
  verksamhetsbeskrivning            TEXT,

  postadress_utdelningsadress       VARCHAR(255),
  postadress_postnummer             VARCHAR(32),
  postadress_postort                VARCHAR(128),
  postadress_land                   VARCHAR(128),

  raw_item                          JSONB NOT NULL,
  created_at                        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_bv_parsed_hvd_org_raw_idx
    UNIQUE (raw_payload_id, source_index)
);

CREATE INDEX IF NOT EXISTS idx_bv_parsed_hvd_org_latest
  ON bv_parsed.hvd_organisation_snapshots (tenant_id, organisationsnummer, payload_created_at DESC);

CREATE TABLE IF NOT EXISTS bv_parsed.hvd_organisation_names (
  id                                BIGSERIAL PRIMARY KEY,
  hvd_organisation_snapshot_id      BIGINT NOT NULL
                                      REFERENCES bv_parsed.hvd_organisation_snapshots(id) ON DELETE CASCADE,
  source_index                      INTEGER NOT NULL,
  namn                              VARCHAR(255),
  registreringsdatum                DATE,
  organisationsnamntyp_kod          VARCHAR(64),
  organisationsnamntyp_klartext     VARCHAR(255),
  verksamhetsbeskrivning_sarskilt_foretagsnamn TEXT,
  raw_item                          JSONB NOT NULL,
  created_at                        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_bv_parsed_hvd_org_name
    UNIQUE (hvd_organisation_snapshot_id, source_index)
);

CREATE TABLE IF NOT EXISTS bv_parsed.hvd_organisation_sni (
  id                                BIGSERIAL PRIMARY KEY,
  hvd_organisation_snapshot_id      BIGINT NOT NULL
                                      REFERENCES bv_parsed.hvd_organisation_snapshots(id) ON DELETE CASCADE,
  source_index                      INTEGER NOT NULL,
  sni_kod                           VARCHAR(32),
  sni_klartext                      VARCHAR(255),
  raw_item                          JSONB NOT NULL,
  created_at                        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_bv_parsed_hvd_org_sni
    UNIQUE (hvd_organisation_snapshot_id, source_index)
);

-- =========================================================
-- 4. FI organisation parsed snapshots
-- =========================================================

CREATE TABLE IF NOT EXISTS bv_parsed.fi_organisation_snapshots (
  id                                BIGSERIAL PRIMARY KEY,
  raw_payload_id                    UUID NOT NULL
                                      REFERENCES bv_raw_payloads(id) ON DELETE CASCADE,
  tenant_id                         UUID NOT NULL,
  organisationsnummer               VARCHAR(64) NOT NULL,
  snapshot_id                       UUID
                                      REFERENCES bolagsverket_fetch_snapshots(id) ON DELETE SET NULL,
  provider_source                   VARCHAR(64) NOT NULL,
  payload_created_at                TIMESTAMPTZ NOT NULL,
  source_index                      INTEGER NOT NULL DEFAULT 1,

  arendenummer                      VARCHAR(64),
  arende_avslutat_tidpunkt          TIMESTAMPTZ,

  identitet_typ_kod                 VARCHAR(64),
  identitet_typ_klartext            VARCHAR(255),

  organisationsnamn                 VARCHAR(255),
  organisationsnamn_typ_kod         VARCHAR(64),
  organisationsnamn_typ_klartext    VARCHAR(255),

  organisationsform_kod             VARCHAR(32),
  organisationsform_klartext        VARCHAR(255),

  organisationsdatum_registreringsdatum DATE,
  organisationsdatum_bildat_datum   DATE,

  hemvist_typ                       VARCHAR(32),
  hemvist_lan_kod                   VARCHAR(16),
  hemvist_lan_klartext              VARCHAR(128),
  hemvist_kommun_kod                VARCHAR(16),
  hemvist_kommun_klartext           VARCHAR(128),

  rakenskapsar_inleds               VARCHAR(16),
  rakenskapsar_avslutas             VARCHAR(16),

  verksamhetsbeskrivning            TEXT,

  organisationsadress_postadress    VARCHAR(255),
  organisationsadress_postnummer    VARCHAR(32),
  organisationsadress_postort       VARCHAR(128),
  organisationsadress_epost         VARCHAR(255),

  firmateckning_klartext            TEXT,

  antal_valda_ledamoter             INTEGER,
  antal_valda_suppleanter           INTEGER,

  aktiekapital_belopp               NUMERIC(20,2),
  aktiekapital_valuta               VARCHAR(16),
  antal_aktier                      NUMERIC(20,2),
  kvotvarde_belopp                  NUMERIC(20,6),
  kvotvarde_valuta                  VARCHAR(16),
  aktiekapital_grans_lagst          NUMERIC(20,2),
  aktiekapital_grans_hogst          NUMERIC(20,2),
  antal_aktier_grans_lagst          NUMERIC(20,2),
  antal_aktier_grans_hogst          NUMERIC(20,2),
  aktiegranser_valuta               VARCHAR(16),

  raw_item                          JSONB NOT NULL,
  created_at                        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_bv_parsed_fi_org_raw_idx
    UNIQUE (raw_payload_id, source_index)
);

CREATE INDEX IF NOT EXISTS idx_bv_parsed_fi_org_latest
  ON bv_parsed.fi_organisation_snapshots (tenant_id, organisationsnummer, payload_created_at DESC);

CREATE TABLE IF NOT EXISTS bv_parsed.fi_organisation_names (
  id                                BIGSERIAL PRIMARY KEY,
  fi_organisation_snapshot_id       BIGINT NOT NULL
                                      REFERENCES bv_parsed.fi_organisation_snapshots(id) ON DELETE CASCADE,
  source_index                      INTEGER NOT NULL,
  namn                              VARCHAR(255),
  typ_kod                           VARCHAR(64),
  typ_klartext                      VARCHAR(255),
  registreringsdatum                DATE,
  raw_item                          JSONB NOT NULL,
  created_at                        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_bv_parsed_fi_org_name
    UNIQUE (fi_organisation_snapshot_id, source_index)
);

CREATE TABLE IF NOT EXISTS bv_parsed.fi_funktionarer (
  id                                BIGSERIAL PRIMARY KEY,
  fi_organisation_snapshot_id       BIGINT NOT NULL
                                      REFERENCES bv_parsed.fi_organisation_snapshots(id) ON DELETE CASCADE,
  source_index                      INTEGER NOT NULL,
  fornamn                           VARCHAR(128),
  efternamn                         VARCHAR(128),
  identitetsbeteckning              VARCHAR(64),
  identitet_typ_kod                 VARCHAR(64),
  identitet_typ_klartext            VARCHAR(255),
  postadress_adress                 VARCHAR(255),
  postadress_postnummer             VARCHAR(32),
  postadress_postort                VARCHAR(128),
  raw_item                          JSONB NOT NULL,
  created_at                        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_bv_parsed_fi_funktionar
    UNIQUE (fi_organisation_snapshot_id, source_index)
);

CREATE INDEX IF NOT EXISTS idx_bv_parsed_fi_funktionarer_person
  ON bv_parsed.fi_funktionarer (identitetsbeteckning);

CREATE TABLE IF NOT EXISTS bv_parsed.fi_funktionar_roller (
  id                                BIGSERIAL PRIMARY KEY,
  fi_funktionar_id                  BIGINT NOT NULL
                                      REFERENCES bv_parsed.fi_funktionarer(id) ON DELETE CASCADE,
  source_index                      INTEGER NOT NULL,
  roll_kod                          VARCHAR(64),
  roll_klartext                     VARCHAR(255),
  raw_item                          JSONB NOT NULL,
  created_at                        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_bv_parsed_fi_funktionar_roll
    UNIQUE (fi_funktionar_id, source_index)
);

CREATE TABLE IF NOT EXISTS bv_parsed.fi_finansiella_rapport_arenden (
  id                                BIGSERIAL PRIMARY KEY,
  fi_organisation_snapshot_id       BIGINT NOT NULL
                                      REFERENCES bv_parsed.fi_organisation_snapshots(id) ON DELETE CASCADE,
  source_index                      INTEGER NOT NULL,
  arendenummer                      VARCHAR(64),
  avslutat_tidpunkt                 TIMESTAMPTZ,
  raw_item                          JSONB NOT NULL,
  created_at                        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_bv_parsed_fi_fin_rapport_arende
    UNIQUE (fi_organisation_snapshot_id, source_index)
);

CREATE TABLE IF NOT EXISTS bv_parsed.fi_finansiella_rapporter (
  id                                BIGSERIAL PRIMARY KEY,
  fi_finansiell_rapport_arende_id   BIGINT NOT NULL
                                      REFERENCES bv_parsed.fi_finansiella_rapport_arenden(id) ON DELETE CASCADE,
  source_index                      INTEGER NOT NULL,
  rapporttyp_kod                    VARCHAR(64),
  rapporttyp_klartext               VARCHAR(255),
  ankom_datum                       DATE,
  handlaggning_avslutad_datum       DATE,
  registrerad_datum                 DATE,
  innehaller_koncernredovisning     BOOLEAN,
  period_from                       DATE,
  period_tom                        DATE,
  vinstutdelning_beslutad_datum     DATE,
  vinstutdelning_valuta_kod         VARCHAR(16),
  vinstutdelning_valuta_klartext    VARCHAR(64),
  vinstutdelning_belopp             NUMERIC(20,2),
  raw_item                          JSONB NOT NULL,
  created_at                        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_bv_parsed_fi_fin_rapport
    UNIQUE (fi_finansiell_rapport_arende_id, source_index)
);

-- =========================================================
-- 5. HVD dokumentlista parsed snapshots
-- =========================================================

CREATE TABLE IF NOT EXISTS bv_parsed.hvd_dokumentlista_snapshots (
  id                                BIGSERIAL PRIMARY KEY,
  raw_payload_id                    UUID NOT NULL UNIQUE
                                      REFERENCES bv_raw_payloads(id) ON DELETE CASCADE,
  tenant_id                         UUID NOT NULL,
  organisationsnummer               VARCHAR(64) NOT NULL,
  snapshot_id                       UUID
                                      REFERENCES bolagsverket_fetch_snapshots(id) ON DELETE SET NULL,
  provider_source                   VARCHAR(64) NOT NULL,
  payload_created_at                TIMESTAMPTZ NOT NULL,
  raw_payload                       JSONB NOT NULL,
  created_at                        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bv_parsed_hvd_doclist_latest
  ON bv_parsed.hvd_dokumentlista_snapshots (tenant_id, organisationsnummer, payload_created_at DESC);

CREATE TABLE IF NOT EXISTS bv_parsed.hvd_dokument (
  id                                BIGSERIAL PRIMARY KEY,
  hvd_dokumentlista_snapshot_id     BIGINT NOT NULL
                                      REFERENCES bv_parsed.hvd_dokumentlista_snapshots(id) ON DELETE CASCADE,
  source_index                      INTEGER NOT NULL,
  dokument_id                       VARCHAR(128) NOT NULL,
  filformat                         VARCHAR(64),
  registreringstidpunkt             DATE,
  rapporteringsperiod_tom           DATE,
  raw_item                          JSONB NOT NULL,
  created_at                        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_bv_parsed_hvd_dokument_idx
    UNIQUE (hvd_dokumentlista_snapshot_id, source_index),
  CONSTRAINT uq_bv_parsed_hvd_dokument_docid
    UNIQUE (hvd_dokumentlista_snapshot_id, dokument_id)
);

CREATE INDEX IF NOT EXISTS idx_bv_parsed_hvd_dokument_docid
  ON bv_parsed.hvd_dokument (dokument_id);

-- =========================================================
-- 6. Latest views required by read layer
-- =========================================================

CREATE OR REPLACE VIEW bv_parsed.v_fi_organisation_latest AS
WITH ranked AS (
  SELECT s.*,
         row_number() OVER (
           PARTITION BY s.tenant_id, s.organisationsnummer
           ORDER BY s.payload_created_at DESC, s.id DESC
         ) AS rn
  FROM bv_parsed.fi_organisation_snapshots s
)
SELECT *
FROM ranked
WHERE rn = 1;

CREATE OR REPLACE VIEW bv_parsed.v_hvd_organisation_latest AS
WITH ranked AS (
  SELECT s.*,
         row_number() OVER (
           PARTITION BY s.tenant_id, s.organisationsnummer
           ORDER BY s.payload_created_at DESC, s.id DESC
         ) AS rn
  FROM bv_parsed.hvd_organisation_snapshots s
)
SELECT *
FROM ranked
WHERE rn = 1;

CREATE OR REPLACE VIEW bv_parsed.v_hvd_dokument_latest AS
WITH ranked AS (
  SELECT s.*,
         row_number() OVER (
           PARTITION BY s.tenant_id, s.organisationsnummer
           ORDER BY s.payload_created_at DESC, s.id DESC
         ) AS rn
  FROM bv_parsed.hvd_dokumentlista_snapshots s
)
SELECT
  r.tenant_id,
  r.organisationsnummer,
  d.dokument_id,
  d.filformat,
  d.registreringstidpunkt,
  d.rapporteringsperiod_tom
FROM ranked r
JOIN bv_parsed.hvd_dokument d
  ON d.hvd_dokumentlista_snapshot_id = r.id
WHERE r.rn = 1;

-- =========================================================
-- 7. Loader functions
-- =========================================================

CREATE OR REPLACE FUNCTION bv_parsed.load_hvd_organisation_from_raw(p_raw_payload_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_raw public.bv_raw_payloads%rowtype;
  v_org jsonb;
  v_idx integer;
  v_snapshot_id bigint;
BEGIN
  SELECT *
  INTO v_raw
  FROM public.bv_raw_payloads
  WHERE id = p_raw_payload_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Raw payload % not found', p_raw_payload_id;
  END IF;

  IF v_raw.content->'highValueDataset'->'organisationer' IS NULL THEN
    RETURN;
  END IF;

  FOR v_org, v_idx IN
    SELECT value, ordinality::int
    FROM jsonb_array_elements(v_raw.content->'highValueDataset'->'organisationer') WITH ORDINALITY
  LOOP
    INSERT INTO bv_parsed.hvd_organisation_snapshots (
      raw_payload_id,
      tenant_id,
      organisationsnummer,
      snapshot_id,
      provider_source,
      payload_created_at,
      source_index,
      juridisk_form_kod,
      juridisk_form_klartext,
      organisationsform_kod,
      organisationsform_klartext,
      registreringsland_kod,
      registreringsland_klartext,
      organisationsdatum_registreringsdatum,
      verksam_organisation_kod,
      verksamhetsbeskrivning,
      postadress_utdelningsadress,
      postadress_postnummer,
      postadress_postort,
      postadress_land,
      raw_item
    )
    VALUES (
      v_raw.id,
      v_raw.tenant_id,
      COALESCE(v_org->'organisationsidentitet'->>'identitetsbeteckning', v_raw.organisationsnummer),
      v_raw.snapshot_id,
      v_raw.provider_source,
      v_raw.created_at,
      v_idx,
      v_org->'juridiskForm'->>'kod',
      v_org->'juridiskForm'->>'klartext',
      v_org->'organisationsform'->>'kod',
      v_org->'organisationsform'->>'klartext',
      v_org->'registreringsland'->>'kod',
      v_org->'registreringsland'->>'klartext',
      bv_parsed.try_date(v_org->'organisationsdatum'->>'registreringsdatum'),
      v_org->'verksamOrganisation'->>'kod',
      v_org->'verksamhetsbeskrivning'->>'beskrivning',
      v_org->'postadressOrganisation'->'postadress'->>'utdelningsadress',
      v_org->'postadressOrganisation'->'postadress'->>'postnummer',
      v_org->'postadressOrganisation'->'postadress'->>'postort',
      v_org->'postadressOrganisation'->'postadress'->>'land',
      v_org
    )
    ON CONFLICT (raw_payload_id, source_index) DO NOTHING
    RETURNING id INTO v_snapshot_id;

    IF v_snapshot_id IS NULL THEN
      SELECT id
      INTO v_snapshot_id
      FROM bv_parsed.hvd_organisation_snapshots
      WHERE raw_payload_id = v_raw.id
        AND source_index = v_idx;
    END IF;

    INSERT INTO bv_parsed.hvd_organisation_names (
      hvd_organisation_snapshot_id,
      source_index,
      namn,
      registreringsdatum,
      organisationsnamntyp_kod,
      organisationsnamntyp_klartext,
      verksamhetsbeskrivning_sarskilt_foretagsnamn,
      raw_item
    )
    SELECT
      v_snapshot_id,
      ordinality::int,
      x->>'namn',
      bv_parsed.try_date(x->>'registreringsdatum'),
      x->'organisationsnamntyp'->>'kod',
      x->'organisationsnamntyp'->>'klartext',
      x->>'verksamhetsbeskrivningSarskiltForetagsnamn',
      x
    FROM jsonb_array_elements(COALESCE(v_org->'organisationsnamn'->'organisationsnamnLista','[]'::jsonb)) WITH ORDINALITY AS t(x, ordinality)
    ON CONFLICT DO NOTHING;

    INSERT INTO bv_parsed.hvd_organisation_sni (
      hvd_organisation_snapshot_id,
      source_index,
      sni_kod,
      sni_klartext,
      raw_item
    )
    SELECT
      v_snapshot_id,
      ordinality::int,
      x->>'kod',
      x->>'klartext',
      x
    FROM jsonb_array_elements(COALESCE(v_org->'naringsgrenOrganisation'->'sni','[]'::jsonb)) WITH ORDINALITY AS t(x, ordinality)
    ON CONFLICT DO NOTHING;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION bv_parsed.load_fi_organisation_from_raw(p_raw_payload_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_raw public.bv_raw_payloads%rowtype;
  v_org jsonb;
  v_idx integer;
  v_snapshot_id bigint;
  v_fun jsonb;
  v_fun_id bigint;
BEGIN
  SELECT *
  INTO v_raw
  FROM public.bv_raw_payloads
  WHERE id = p_raw_payload_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Raw payload % not found', p_raw_payload_id;
  END IF;

  IF v_raw.content->'organisationInformation' IS NULL THEN
    RETURN;
  END IF;

  FOR v_org, v_idx IN
    SELECT value, ordinality::int
    FROM jsonb_array_elements(v_raw.content->'organisationInformation') WITH ORDINALITY
  LOOP
    INSERT INTO bv_parsed.fi_organisation_snapshots (
      raw_payload_id,
      tenant_id,
      organisationsnummer,
      snapshot_id,
      provider_source,
      payload_created_at,
      source_index,
      arendenummer,
      arende_avslutat_tidpunkt,
      identitet_typ_kod,
      identitet_typ_klartext,
      organisationsnamn,
      organisationsnamn_typ_kod,
      organisationsnamn_typ_klartext,
      organisationsform_kod,
      organisationsform_klartext,
      organisationsdatum_registreringsdatum,
      organisationsdatum_bildat_datum,
      hemvist_typ,
      hemvist_lan_kod,
      hemvist_lan_klartext,
      hemvist_kommun_kod,
      hemvist_kommun_klartext,
      rakenskapsar_inleds,
      rakenskapsar_avslutas,
      verksamhetsbeskrivning,
      organisationsadress_postadress,
      organisationsadress_postnummer,
      organisationsadress_postort,
      organisationsadress_epost,
      firmateckning_klartext,
      antal_valda_ledamoter,
      antal_valda_suppleanter,
      aktiekapital_belopp,
      aktiekapital_valuta,
      antal_aktier,
      kvotvarde_belopp,
      kvotvarde_valuta,
      aktiekapital_grans_lagst,
      aktiekapital_grans_hogst,
      antal_aktier_grans_lagst,
      antal_aktier_grans_hogst,
      aktiegranser_valuta,
      raw_item
    )
    VALUES (
      v_raw.id,
      v_raw.tenant_id,
      COALESCE(v_org->'identitet'->>'identitetsbeteckning', v_raw.organisationsnummer),
      v_raw.snapshot_id,
      v_raw.provider_source,
      v_raw.created_at,
      v_idx,
      v_org->'arende'->>'arendenummer',
      bv_parsed.try_timestamptz(v_org->'arende'->>'avslutatTidpunkt'),
      v_org->'identitet'->'typ'->>'kod',
      v_org->'identitet'->'typ'->>'klartext',
      v_org->'organisationsnamn'->>'namn',
      v_org->'organisationsnamn'->'typ'->>'kod',
      v_org->'organisationsnamn'->'typ'->>'klartext',
      v_org->'organisationsform'->>'kod',
      v_org->'organisationsform'->>'klartext',
      bv_parsed.try_date(v_org->'organisationsdatum'->>'registreringsdatum'),
      bv_parsed.try_date(v_org->'organisationsdatum'->>'bildatDatum'),
      v_org->'hemvistkommun'->>'typ',
      v_org->'hemvistkommun'->'lanForHemvistkommun'->>'kod',
      v_org->'hemvistkommun'->'lanForHemvistkommun'->>'klartext',
      v_org->'hemvistkommun'->'kommun'->>'kod',
      v_org->'hemvistkommun'->'kommun'->>'klartext',
      v_org->'rakenskapsar'->>'rakenskapsarInleds',
      v_org->'rakenskapsar'->>'rakenskapsarAvslutas',
      v_org->>'verksamhetsbeskrivning',
      v_org->'organisationsadresser'->'postadress'->>'adress',
      v_org->'organisationsadresser'->'postadress'->>'postnummer',
      v_org->'organisationsadresser'->'postadress'->>'postort',
      v_org->'organisationsadresser'->>'epostadress',
      v_org->'firmateckning'->>'klartext',
      NULLIF(v_org->'antalValdaFunktionarer'->>'ledamoter','')::integer,
      NULLIF(v_org->'antalValdaFunktionarer'->>'suppleanter','')::integer,
      bv_parsed.try_numeric(v_org->'aktieinformation'->'aktiekapital'->>'belopp'),
      v_org->'aktieinformation'->'aktiekapital'->>'valuta',
      bv_parsed.try_numeric(v_org->'aktieinformation'->>'antalAktier'),
      bv_parsed.try_numeric(v_org->'aktieinformation'->'kvotvarde'->>'belopp'),
      v_org->'aktieinformation'->'kvotvarde'->>'valuta',
      bv_parsed.try_numeric(v_org->'aktieinformation'->'aktiegranser'->'aktiekapitalGranser'->>'lagst'),
      bv_parsed.try_numeric(v_org->'aktieinformation'->'aktiegranser'->'aktiekapitalGranser'->>'hogst'),
      bv_parsed.try_numeric(v_org->'aktieinformation'->'aktiegranser'->'antalAktierGranser'->>'lagst'),
      bv_parsed.try_numeric(v_org->'aktieinformation'->'aktiegranser'->'antalAktierGranser'->>'hogst'),
      v_org->'aktieinformation'->'aktiegranser'->>'valuta',
      v_org
    )
    ON CONFLICT (raw_payload_id, source_index) DO NOTHING
    RETURNING id INTO v_snapshot_id;

    IF v_snapshot_id IS NULL THEN
      SELECT id
      INTO v_snapshot_id
      FROM bv_parsed.fi_organisation_snapshots
      WHERE raw_payload_id = v_raw.id
        AND source_index = v_idx;
    END IF;

    INSERT INTO bv_parsed.fi_organisation_names (
      fi_organisation_snapshot_id,
      source_index,
      namn,
      typ_kod,
      typ_klartext,
      registreringsdatum,
      raw_item
    )
    SELECT
      v_snapshot_id,
      ordinality::int,
      x->>'namn',
      x->'typ'->>'kod',
      x->'typ'->>'klartext',
      bv_parsed.try_date(x->>'registreringsdatum'),
      x
    FROM jsonb_array_elements(COALESCE(v_org->'samtligaOrganisationsnamn','[]'::jsonb)) WITH ORDINALITY AS t(x, ordinality)
    ON CONFLICT DO NOTHING;

    FOR v_fun IN
      SELECT value
      FROM jsonb_array_elements(COALESCE(v_org->'funktionarer','[]'::jsonb))
    LOOP
      INSERT INTO bv_parsed.fi_funktionarer (
        fi_organisation_snapshot_id,
        source_index,
        fornamn,
        efternamn,
        identitetsbeteckning,
        identitet_typ_kod,
        identitet_typ_klartext,
        postadress_adress,
        postadress_postnummer,
        postadress_postort,
        raw_item
      )
      VALUES (
        v_snapshot_id,
        COALESCE(
          (
            SELECT max(source_index) + 1
            FROM bv_parsed.fi_funktionarer
            WHERE fi_organisation_snapshot_id = v_snapshot_id
          ),
          1
        ),
        v_fun->'personnamn'->>'fornamn',
        v_fun->'personnamn'->>'efternamn',
        v_fun->'identitet'->>'identitetsbeteckning',
        v_fun->'identitet'->'typ'->>'kod',
        v_fun->'identitet'->'typ'->>'klartext',
        v_fun->'postadress'->>'adress',
        v_fun->'postadress'->>'postnummer',
        v_fun->'postadress'->>'postort',
        v_fun
      )
      RETURNING id INTO v_fun_id;

      INSERT INTO bv_parsed.fi_funktionar_roller (
        fi_funktionar_id,
        source_index,
        roll_kod,
        roll_klartext,
        raw_item
      )
      SELECT
        v_fun_id,
        ordinality::int,
        x->>'kod',
        x->>'klartext',
        x
      FROM jsonb_array_elements(COALESCE(v_fun->'funktionarsroller','[]'::jsonb)) WITH ORDINALITY AS t(x, ordinality)
      ON CONFLICT DO NOTHING;
    END LOOP;

    INSERT INTO bv_parsed.fi_finansiella_rapport_arenden (
      fi_organisation_snapshot_id,
      source_index,
      arendenummer,
      avslutat_tidpunkt,
      raw_item
    )
    SELECT
      v_snapshot_id,
      ordinality::int,
      x->'arende'->>'arendenummer',
      bv_parsed.try_timestamptz(x->'arende'->>'avslutatTidpunkt'),
      x
    FROM jsonb_array_elements(COALESCE(v_org->'finansiellaRapporter','[]'::jsonb)) WITH ORDINALITY AS t(x, ordinality)
    ON CONFLICT DO NOTHING;

    INSERT INTO bv_parsed.fi_finansiella_rapporter (
      fi_finansiell_rapport_arende_id,
      source_index,
      rapporttyp_kod,
      rapporttyp_klartext,
      ankom_datum,
      handlaggning_avslutad_datum,
      registrerad_datum,
      innehaller_koncernredovisning,
      period_from,
      period_tom,
      vinstutdelning_beslutad_datum,
      vinstutdelning_valuta_kod,
      vinstutdelning_valuta_klartext,
      vinstutdelning_belopp,
      raw_item
    )
    SELECT
      a.id,
      rr.ordinality::int,
      rr.x->'rapportTyp'->>'kod',
      rr.x->'rapportTyp'->>'klartext',
      bv_parsed.try_date(rr.x->>'ankomDatum'),
      bv_parsed.try_date(rr.x->>'handlaggningAvslutadDatum'),
      bv_parsed.try_date(rr.x->>'registreradDatum'),
      CASE WHEN rr.x ? 'innehallerKoncernredovisning' THEN (rr.x->>'innehallerKoncernredovisning')::boolean ELSE NULL END,
      bv_parsed.try_date(rr.x->'rapporteringsperiod'->>'periodFrom'),
      bv_parsed.try_date(rr.x->'rapporteringsperiod'->>'periodTom'),
      bv_parsed.try_date(rr.x->'vinstutdelning'->>'beslutadDatum'),
      rr.x->'vinstutdelning'->'valuta'->>'kod',
      rr.x->'vinstutdelning'->'valuta'->>'klartext',
      bv_parsed.try_numeric(rr.x->'vinstutdelning'->>'belopp'),
      rr.x
    FROM bv_parsed.fi_finansiella_rapport_arenden a
    JOIN LATERAL jsonb_array_elements(COALESCE(a.raw_item->'rapporter','[]'::jsonb)) WITH ORDINALITY AS rr(x, ordinality) ON TRUE
    WHERE a.fi_organisation_snapshot_id = v_snapshot_id
    ON CONFLICT DO NOTHING;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION bv_parsed.load_hvd_dokumentlista_from_raw(p_raw_payload_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_raw public.bv_raw_payloads%rowtype;
  v_snapshot_id bigint;
BEGIN
  SELECT *
  INTO v_raw
  FROM public.bv_raw_payloads
  WHERE id = p_raw_payload_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Raw payload % not found', p_raw_payload_id;
  END IF;

  IF v_raw.content->'dokument' IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO bv_parsed.hvd_dokumentlista_snapshots (
    raw_payload_id,
    tenant_id,
    organisationsnummer,
    snapshot_id,
    provider_source,
    payload_created_at,
    raw_payload
  )
  VALUES (
    v_raw.id,
    v_raw.tenant_id,
    v_raw.organisationsnummer,
    v_raw.snapshot_id,
    v_raw.provider_source,
    v_raw.created_at,
    v_raw.content
  )
  ON CONFLICT (raw_payload_id) DO NOTHING
  RETURNING id INTO v_snapshot_id;

  IF v_snapshot_id IS NULL THEN
    SELECT id
    INTO v_snapshot_id
    FROM bv_parsed.hvd_dokumentlista_snapshots
    WHERE raw_payload_id = v_raw.id;
  END IF;

  INSERT INTO bv_parsed.hvd_dokument (
    hvd_dokumentlista_snapshot_id,
    source_index,
    dokument_id,
    filformat,
    registreringstidpunkt,
    rapporteringsperiod_tom,
    raw_item
  )
  SELECT
    v_snapshot_id,
    ordinality::int,
    x->>'dokumentId',
    x->>'filformat',
    bv_parsed.try_date(x->>'registreringstidpunkt'),
    bv_parsed.try_date(x->>'rapporteringsperiodTom'),
    x
  FROM jsonb_array_elements(v_raw.content->'dokument') WITH ORDINALITY AS t(x, ordinality)
  ON CONFLICT DO NOTHING;
END;
$$;

-- =========================================================
-- 8. Dispatcher
-- =========================================================

CREATE OR REPLACE FUNCTION bv_parsed.dispatch_raw_payload(p_raw_payload_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_raw public.bv_raw_payloads%rowtype;
BEGIN
  SELECT *
  INTO v_raw
  FROM public.bv_raw_payloads
  WHERE id = p_raw_payload_id;

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
      raw_payload_id,
      tenant_id,
      organisationsnummer,
      provider_source,
      parsed_ok,
      parsed_at
    )
    VALUES (
      v_raw.id,
      v_raw.tenant_id,
      v_raw.organisationsnummer,
      v_raw.provider_source,
      TRUE,
      NOW()
    )
    ON CONFLICT (raw_payload_id) DO UPDATE
    SET parsed_ok = TRUE,
        parse_error = NULL,
        parsed_at = EXCLUDED.parsed_at;

  EXCEPTION WHEN OTHERS THEN
    INSERT INTO bv_parsed.parse_runs (
      raw_payload_id,
      tenant_id,
      organisationsnummer,
      provider_source,
      parsed_ok,
      parse_error,
      parsed_at
    )
    VALUES (
      v_raw.id,
      v_raw.tenant_id,
      v_raw.organisationsnummer,
      v_raw.provider_source,
      FALSE,
      SQLERRM,
      NOW()
    )
    ON CONFLICT (raw_payload_id) DO UPDATE
    SET parsed_ok = FALSE,
        parse_error = EXCLUDED.parse_error,
        parsed_at = EXCLUDED.parsed_at;

    RAISE;
  END;
END;
$$;

-- =========================================================
-- 9. Trigger
-- =========================================================

CREATE OR REPLACE FUNCTION bv_parsed.trg_dispatch_raw_payload()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM bv_parsed.dispatch_raw_payload(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bv_raw_payloads_dispatch ON bv_raw_payloads;

CREATE TRIGGER trg_bv_raw_payloads_dispatch
AFTER INSERT ON bv_raw_payloads
FOR EACH ROW
EXECUTE FUNCTION bv_parsed.trg_dispatch_raw_payload();

-- =========================================================
-- 10. Backfill existing raw rows
-- =========================================================

CREATE OR REPLACE FUNCTION bv_parsed.backfill_all_raw_payloads()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT id
    FROM bv_raw_payloads
    ORDER BY created_at, id
  LOOP
    BEGIN
      PERFORM bv_parsed.dispatch_raw_payload(r.id);
    EXCEPTION WHEN OTHERS THEN
      NULL;
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

DROP TRIGGER IF EXISTS trg_bv_raw_payloads_dispatch ON bv_raw_payloads;
DROP FUNCTION IF EXISTS bv_parsed.trg_dispatch_raw_payload();
DROP FUNCTION IF EXISTS bv_parsed.backfill_all_raw_payloads();
DROP FUNCTION IF EXISTS bv_parsed.dispatch_raw_payload(uuid);
DROP FUNCTION IF EXISTS bv_parsed.load_hvd_dokumentlista_from_raw(uuid);
DROP FUNCTION IF EXISTS bv_parsed.load_fi_organisation_from_raw(uuid);
DROP FUNCTION IF EXISTS bv_parsed.load_hvd_organisation_from_raw(uuid);

DROP VIEW IF EXISTS bv_parsed.v_hvd_dokument_latest;
DROP VIEW IF EXISTS bv_parsed.v_hvd_organisation_latest;
DROP VIEW IF EXISTS bv_parsed.v_fi_organisation_latest;

DROP TABLE IF EXISTS bv_parsed.hvd_dokument;
DROP TABLE IF EXISTS bv_parsed.hvd_dokumentlista_snapshots;

DROP TABLE IF EXISTS bv_parsed.fi_finansiella_rapporter;
DROP TABLE IF EXISTS bv_parsed.fi_finansiella_rapport_arenden;
DROP TABLE IF EXISTS bv_parsed.fi_funktionar_roller;
DROP TABLE IF EXISTS bv_parsed.fi_funktionarer;
DROP TABLE IF EXISTS bv_parsed.fi_organisation_names;
DROP TABLE IF EXISTS bv_parsed.fi_organisation_snapshots;

DROP TABLE IF EXISTS bv_parsed.hvd_organisation_sni;
DROP TABLE IF EXISTS bv_parsed.hvd_organisation_names;
DROP TABLE IF EXISTS bv_parsed.hvd_organisation_snapshots;

DROP TABLE IF EXISTS bv_parsed.parse_runs;

DROP FUNCTION IF EXISTS bv_parsed.try_numeric(text);
DROP FUNCTION IF EXISTS bv_parsed.try_timestamptz(text);
DROP FUNCTION IF EXISTS bv_parsed.try_date(text);

DROP SCHEMA IF EXISTS bv_parsed;

COMMIT;
    `);
  }
}
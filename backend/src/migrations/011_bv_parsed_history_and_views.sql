BEGIN;

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

CREATE TABLE IF NOT EXISTS bv_parsed.hvd_organisation_snapshots (
  id                                BIGSERIAL PRIMARY KEY,
  raw_payload_id                    UUID NOT NULL
                                      REFERENCES public.bv_raw_payloads(id) ON DELETE CASCADE,
  tenant_id                         UUID NOT NULL,
  organisationsnummer               VARCHAR(64) NOT NULL,
  snapshot_id                       UUID
                                      REFERENCES public.bolagsverket_fetch_snapshots(id) ON DELETE SET NULL,
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
  ON bv_parsed.hvd_organisation_snapshots (tenant_id, organisationsnummer, payload_created_at DESC, id DESC);

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

CREATE TABLE IF NOT EXISTS bv_parsed.fi_organisation_snapshots (
  id                                BIGSERIAL PRIMARY KEY,
  raw_payload_id                    UUID NOT NULL
                                      REFERENCES public.bv_raw_payloads(id) ON DELETE CASCADE,
  tenant_id                         UUID NOT NULL,
  organisationsnummer               VARCHAR(64) NOT NULL,
  snapshot_id                       UUID
                                      REFERENCES public.bolagsverket_fetch_snapshots(id) ON DELETE SET NULL,
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
  ON bv_parsed.fi_organisation_snapshots (tenant_id, organisationsnummer, payload_created_at DESC, id DESC);

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

CREATE TABLE IF NOT EXISTS bv_parsed.hvd_dokumentlista_snapshots (
  id                                BIGSERIAL PRIMARY KEY,
  raw_payload_id                    UUID NOT NULL UNIQUE
                                      REFERENCES public.bv_raw_payloads(id) ON DELETE CASCADE,
  tenant_id                         UUID NOT NULL,
  organisationsnummer               VARCHAR(64) NOT NULL,
  snapshot_id                       UUID
                                      REFERENCES public.bolagsverket_fetch_snapshots(id) ON DELETE SET NULL,
  provider_source                   VARCHAR(64) NOT NULL,
  payload_created_at                TIMESTAMPTZ NOT NULL,
  raw_payload                       JSONB NOT NULL,
  created_at                        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bv_parsed_hvd_doclist_latest
  ON bv_parsed.hvd_dokumentlista_snapshots (tenant_id, organisationsnummer, payload_created_at DESC, id DESC);

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
  d.id AS hvd_dokument_id,
  d.dokument_id,
  d.filformat,
  d.registreringstidpunkt,
  d.rapporteringsperiod_tom
FROM ranked r
JOIN bv_parsed.hvd_dokument d
  ON d.hvd_dokumentlista_snapshot_id = r.id
WHERE r.rn = 1;

CREATE INDEX IF NOT EXISTS idx_bv_parsed_fi_org_lookup
  ON bv_parsed.fi_organisation_snapshots (tenant_id, organisationsnummer, payload_created_at DESC);

CREATE INDEX IF NOT EXISTS idx_bv_parsed_funktionarer_lookup
  ON bv_parsed.fi_funktionarer (fi_organisation_snapshot_id);

CREATE INDEX IF NOT EXISTS idx_bv_parsed_reports_lookup
  ON bv_parsed.fi_finansiella_rapporter (fi_finansiell_rapport_arende_id);

CREATE INDEX IF NOT EXISTS idx_bv_parsed_documents_lookup
  ON bv_parsed.hvd_dokument (hvd_dokumentlista_snapshot_id);

COMMIT;

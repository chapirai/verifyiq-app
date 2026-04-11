BEGIN;

DROP VIEW IF EXISTS bv_read.company_hvd_documents_current CASCADE;
DROP VIEW IF EXISTS bv_read.company_fi_reports_current CASCADE;
DROP VIEW IF EXISTS bv_read.company_officers_current CASCADE;
DROP VIEW IF EXISTS bv_read.company_overview_current CASCADE;

CREATE TABLE IF NOT EXISTS bv_read.company_overview_current (
  tenant_id                               UUID NOT NULL,
  organisationsnummer                     VARCHAR(64) NOT NULL,
  latest_fi_raw_payload_id                UUID,
  latest_hvd_raw_payload_id               UUID,
  latest_snapshot_id                      UUID,
  latest_provider_source                  VARCHAR(64),
  data_refreshed_at                       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  organisationsnamn                       VARCHAR(255),
  organisationsnamn_typ_kod               VARCHAR(64),
  organisationsnamn_typ_klartext          VARCHAR(255),
  juridisk_form_kod                       VARCHAR(32),
  juridisk_form_klartext                  VARCHAR(255),
  organisationsform_kod                   VARCHAR(32),
  organisationsform_klartext              VARCHAR(255),
  registreringsland_kod                   VARCHAR(16),
  registreringsland_klartext              VARCHAR(128),
  registreringsdatum                      DATE,
  bildat_datum                            DATE,
  hemvist_typ                             VARCHAR(32),
  hemvist_lan_kod                         VARCHAR(16),
  hemvist_lan_klartext                    VARCHAR(128),
  hemvist_kommun_kod                      VARCHAR(16),
  hemvist_kommun_klartext                 VARCHAR(128),
  rakenskapsar_inleds                     VARCHAR(16),
  rakenskapsar_avslutas                   VARCHAR(16),
  verksamhetsbeskrivning                  TEXT,
  organisationsadress_postadress          VARCHAR(255),
  organisationsadress_postnummer          VARCHAR(32),
  organisationsadress_postort             VARCHAR(128),
  organisationsadress_epost               VARCHAR(255),
  postadress_utdelningsadress             VARCHAR(255),
  postadress_postnummer                   VARCHAR(32),
  postadress_postort                      VARCHAR(128),
  postadress_land                         VARCHAR(128),
  firmateckning_klartext                  TEXT,
  antal_valda_ledamoter                   INTEGER,
  antal_valda_suppleanter                 INTEGER,
  aktiekapital_belopp                     NUMERIC(20,2),
  aktiekapital_valuta                     VARCHAR(16),
  antal_aktier                            NUMERIC(20,2),
  kvotvarde_belopp                        NUMERIC(20,6),
  kvotvarde_valuta                        VARCHAR(16),
  aktiekapital_grans_lagst                NUMERIC(20,2),
  aktiekapital_grans_hogst                NUMERIC(20,2),
  antal_aktier_grans_lagst                NUMERIC(20,2),
  antal_aktier_grans_hogst                NUMERIC(20,2),
  aktiegranser_valuta                     VARCHAR(16),
  verksam_organisation_kod                VARCHAR(16),
  source_freshness_fi_payload_created_at  TIMESTAMPTZ,
  source_freshness_hvd_payload_created_at TIMESTAMPTZ,
  PRIMARY KEY (tenant_id, organisationsnummer)
);

CREATE TABLE IF NOT EXISTS bv_read.company_officers_current (
  tenant_id                               UUID NOT NULL,
  organisationsnummer                     VARCHAR(64) NOT NULL,
  officer_rank                            INTEGER NOT NULL,
  fi_organisation_snapshot_id             BIGINT,
  funktionar_id                           BIGINT,
  fornamn                                 VARCHAR(128),
  efternamn                               VARCHAR(128),
  identitetsbeteckning                    VARCHAR(64),
  identitet_typ_kod                       VARCHAR(64),
  identitet_typ_klartext                  VARCHAR(255),
  postadress_adress                       VARCHAR(255),
  postadress_postnummer                   VARCHAR(32),
  postadress_postort                      VARCHAR(128),
  roller_json                             JSONB,
  data_refreshed_at                       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (tenant_id, organisationsnummer, officer_rank)
);

CREATE TABLE IF NOT EXISTS bv_read.company_fi_reports_current (
  tenant_id                               UUID NOT NULL,
  organisationsnummer                     VARCHAR(64) NOT NULL,
  report_rank                             INTEGER NOT NULL,
  fi_organisation_snapshot_id             BIGINT,
  fi_finansiell_rapport_arende_id         BIGINT,
  fi_finansiell_rapport_id                BIGINT,
  arendenummer                            VARCHAR(64),
  avslutat_tidpunkt                       TIMESTAMPTZ,
  rapporttyp_kod                          VARCHAR(64),
  rapporttyp_klartext                     VARCHAR(255),
  ankom_datum                             DATE,
  handlaggning_avslutad_datum             DATE,
  registrerad_datum                       DATE,
  innehaller_koncernredovisning           BOOLEAN,
  period_from                             DATE,
  period_tom                              DATE,
  vinstutdelning_beslutad_datum           DATE,
  vinstutdelning_valuta_kod               VARCHAR(16),
  vinstutdelning_valuta_klartext          VARCHAR(64),
  vinstutdelning_belopp                   NUMERIC(20,2),
  data_refreshed_at                       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (tenant_id, organisationsnummer, report_rank)
);

CREATE TABLE IF NOT EXISTS bv_read.company_hvd_documents_current (
  tenant_id                               UUID NOT NULL,
  organisationsnummer                     VARCHAR(64) NOT NULL,
  document_rank                           INTEGER NOT NULL,
  hvd_dokumentlista_snapshot_id           BIGINT,
  hvd_dokument_id                         BIGINT,
  dokument_id                             VARCHAR(128),
  filformat                               VARCHAR(64),
  registreringstidpunkt                   DATE,
  rapporteringsperiod_tom                 DATE,
  data_refreshed_at                       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (tenant_id, organisationsnummer, document_rank)
);

CREATE INDEX IF NOT EXISTS idx_bv_read_company_overview_refresh
  ON bv_read.company_overview_current (data_refreshed_at DESC);

CREATE INDEX IF NOT EXISTS idx_bv_read_company_officers_lookup
  ON bv_read.company_officers_current (tenant_id, organisationsnummer);

CREATE INDEX IF NOT EXISTS idx_bv_read_company_fi_reports_lookup
  ON bv_read.company_fi_reports_current (tenant_id, organisationsnummer);

CREATE INDEX IF NOT EXISTS idx_bv_read_company_hvd_documents_lookup
  ON bv_read.company_hvd_documents_current (tenant_id, organisationsnummer);

CREATE OR REPLACE FUNCTION bv_read.refresh_company_overview_current(
  p_tenant_id uuid,
  p_organisationsnummer varchar
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_fi bv_parsed.v_fi_organisation_latest%rowtype;
  v_hvd bv_parsed.v_hvd_organisation_latest%rowtype;
BEGIN
  SELECT *
  INTO v_fi
  FROM bv_parsed.v_fi_organisation_latest
  WHERE tenant_id = p_tenant_id
    AND organisationsnummer = p_organisationsnummer;

  SELECT *
  INTO v_hvd
  FROM bv_parsed.v_hvd_organisation_latest
  WHERE tenant_id = p_tenant_id
    AND organisationsnummer = p_organisationsnummer;

  INSERT INTO bv_read.company_overview_current (
    tenant_id,
    organisationsnummer,
    latest_fi_raw_payload_id,
    latest_hvd_raw_payload_id,
    latest_snapshot_id,
    latest_provider_source,
    data_refreshed_at,
    organisationsnamn,
    organisationsnamn_typ_kod,
    organisationsnamn_typ_klartext,
    juridisk_form_kod,
    juridisk_form_klartext,
    organisationsform_kod,
    organisationsform_klartext,
    registreringsland_kod,
    registreringsland_klartext,
    registreringsdatum,
    bildat_datum,
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
    postadress_utdelningsadress,
    postadress_postnummer,
    postadress_postort,
    postadress_land,
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
    verksam_organisation_kod,
    source_freshness_fi_payload_created_at,
    source_freshness_hvd_payload_created_at
  )
  VALUES (
    p_tenant_id,
    p_organisationsnummer,
    v_fi.raw_payload_id,
    v_hvd.raw_payload_id,
    COALESCE(v_fi.snapshot_id, v_hvd.snapshot_id),
    COALESCE(v_fi.provider_source, v_hvd.provider_source),
    NOW(),
    v_fi.organisationsnamn,
    v_fi.organisationsnamn_typ_kod,
    v_fi.organisationsnamn_typ_klartext,
    v_hvd.juridisk_form_kod,
    v_hvd.juridisk_form_klartext,
    COALESCE(v_fi.organisationsform_kod, v_hvd.organisationsform_kod),
    COALESCE(v_fi.organisationsform_klartext, v_hvd.organisationsform_klartext),
    v_hvd.registreringsland_kod,
    v_hvd.registreringsland_klartext,
    COALESCE(v_fi.organisationsdatum_registreringsdatum, v_hvd.organisationsdatum_registreringsdatum),
    v_fi.organisationsdatum_bildat_datum,
    v_fi.hemvist_typ,
    v_fi.hemvist_lan_kod,
    v_fi.hemvist_lan_klartext,
    v_fi.hemvist_kommun_kod,
    v_fi.hemvist_kommun_klartext,
    v_fi.rakenskapsar_inleds,
    v_fi.rakenskapsar_avslutas,
    COALESCE(v_fi.verksamhetsbeskrivning, v_hvd.verksamhetsbeskrivning),
    v_fi.organisationsadress_postadress,
    v_fi.organisationsadress_postnummer,
    v_fi.organisationsadress_postort,
    v_fi.organisationsadress_epost,
    v_hvd.postadress_utdelningsadress,
    v_hvd.postadress_postnummer,
    v_hvd.postadress_postort,
    v_hvd.postadress_land,
    v_fi.firmateckning_klartext,
    v_fi.antal_valda_ledamoter,
    v_fi.antal_valda_suppleanter,
    v_fi.aktiekapital_belopp,
    v_fi.aktiekapital_valuta,
    v_fi.antal_aktier,
    v_fi.kvotvarde_belopp,
    v_fi.kvotvarde_valuta,
    v_fi.aktiekapital_grans_lagst,
    v_fi.aktiekapital_grans_hogst,
    v_fi.antal_aktier_grans_lagst,
    v_fi.antal_aktier_grans_hogst,
    v_fi.aktiegranser_valuta,
    v_hvd.verksam_organisation_kod,
    v_fi.payload_created_at,
    v_hvd.payload_created_at
  )
  ON CONFLICT (tenant_id, organisationsnummer) DO UPDATE
  SET latest_fi_raw_payload_id = EXCLUDED.latest_fi_raw_payload_id,
      latest_hvd_raw_payload_id = EXCLUDED.latest_hvd_raw_payload_id,
      latest_snapshot_id = EXCLUDED.latest_snapshot_id,
      latest_provider_source = EXCLUDED.latest_provider_source,
      data_refreshed_at = EXCLUDED.data_refreshed_at,
      organisationsnamn = EXCLUDED.organisationsnamn,
      organisationsnamn_typ_kod = EXCLUDED.organisationsnamn_typ_kod,
      organisationsnamn_typ_klartext = EXCLUDED.organisationsnamn_typ_klartext,
      juridisk_form_kod = EXCLUDED.juridisk_form_kod,
      juridisk_form_klartext = EXCLUDED.juridisk_form_klartext,
      organisationsform_kod = EXCLUDED.organisationsform_kod,
      organisationsform_klartext = EXCLUDED.organisationsform_klartext,
      registreringsland_kod = EXCLUDED.registreringsland_kod,
      registreringsland_klartext = EXCLUDED.registreringsland_klartext,
      registreringsdatum = EXCLUDED.registreringsdatum,
      bildat_datum = EXCLUDED.bildat_datum,
      hemvist_typ = EXCLUDED.hemvist_typ,
      hemvist_lan_kod = EXCLUDED.hemvist_lan_kod,
      hemvist_lan_klartext = EXCLUDED.hemvist_lan_klartext,
      hemvist_kommun_kod = EXCLUDED.hemvist_kommun_kod,
      hemvist_kommun_klartext = EXCLUDED.hemvist_kommun_klartext,
      rakenskapsar_inleds = EXCLUDED.rakenskapsar_inleds,
      rakenskapsar_avslutas = EXCLUDED.rakenskapsar_avslutas,
      verksamhetsbeskrivning = EXCLUDED.verksamhetsbeskrivning,
      organisationsadress_postadress = EXCLUDED.organisationsadress_postadress,
      organisationsadress_postnummer = EXCLUDED.organisationsadress_postnummer,
      organisationsadress_postort = EXCLUDED.organisationsadress_postort,
      organisationsadress_epost = EXCLUDED.organisationsadress_epost,
      postadress_utdelningsadress = EXCLUDED.postadress_utdelningsadress,
      postadress_postnummer = EXCLUDED.postadress_postnummer,
      postadress_postort = EXCLUDED.postadress_postort,
      postadress_land = EXCLUDED.postadress_land,
      firmateckning_klartext = EXCLUDED.firmateckning_klartext,
      antal_valda_ledamoter = EXCLUDED.antal_valda_ledamoter,
      antal_valda_suppleanter = EXCLUDED.antal_valda_suppleanter,
      aktiekapital_belopp = EXCLUDED.aktiekapital_belopp,
      aktiekapital_valuta = EXCLUDED.aktiekapital_valuta,
      antal_aktier = EXCLUDED.antal_aktier,
      kvotvarde_belopp = EXCLUDED.kvotvarde_belopp,
      kvotvarde_valuta = EXCLUDED.kvotvarde_valuta,
      aktiekapital_grans_lagst = EXCLUDED.aktiekapital_grans_lagst,
      aktiekapital_grans_hogst = EXCLUDED.aktiekapital_grans_hogst,
      antal_aktier_grans_lagst = EXCLUDED.antal_aktier_grans_lagst,
      antal_aktier_grans_hogst = EXCLUDED.antal_aktier_grans_hogst,
      aktiegranser_valuta = EXCLUDED.aktiegranser_valuta,
      verksam_organisation_kod = EXCLUDED.verksam_organisation_kod,
      source_freshness_fi_payload_created_at = EXCLUDED.source_freshness_fi_payload_created_at,
      source_freshness_hvd_payload_created_at = EXCLUDED.source_freshness_hvd_payload_created_at;
END;
$$;

CREATE OR REPLACE FUNCTION bv_read.refresh_company_officers_current(
  p_tenant_id uuid,
  p_organisationsnummer varchar
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_fi_snapshot_id bigint;
BEGIN
  SELECT id
  INTO v_fi_snapshot_id
  FROM bv_parsed.v_fi_organisation_latest
  WHERE tenant_id = p_tenant_id
    AND organisationsnummer = p_organisationsnummer;

  DELETE FROM bv_read.company_officers_current
  WHERE tenant_id = p_tenant_id
    AND organisationsnummer = p_organisationsnummer;

  IF v_fi_snapshot_id IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO bv_read.company_officers_current (
    tenant_id,
    organisationsnummer,
    officer_rank,
    fi_organisation_snapshot_id,
    funktionar_id,
    fornamn,
    efternamn,
    identitetsbeteckning,
    identitet_typ_kod,
    identitet_typ_klartext,
    postadress_adress,
    postadress_postnummer,
    postadress_postort,
    roller_json,
    data_refreshed_at
  )
  SELECT
    p_tenant_id,
    p_organisationsnummer,
    row_number() OVER (ORDER BY f.source_index, f.id),
    f.fi_organisation_snapshot_id,
    f.id,
    f.fornamn,
    f.efternamn,
    f.identitetsbeteckning,
    f.identitet_typ_kod,
    f.identitet_typ_klartext,
    f.postadress_adress,
    f.postadress_postnummer,
    f.postadress_postort,
    COALESCE(
      (
        SELECT jsonb_agg(
                 jsonb_build_object(
                   'roll_kod', r.roll_kod,
                   'roll_klartext', r.roll_klartext
                 )
                 ORDER BY r.source_index
               )
        FROM bv_parsed.fi_funktionar_roller r
        WHERE r.fi_funktionar_id = f.id
      ),
      '[]'::jsonb
    ),
    NOW()
  FROM bv_parsed.fi_funktionarer f
  WHERE f.fi_organisation_snapshot_id = v_fi_snapshot_id
  ORDER BY f.source_index, f.id;
END;
$$;

CREATE OR REPLACE FUNCTION bv_read.refresh_company_fi_reports_current(
  p_tenant_id uuid,
  p_organisationsnummer varchar
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_fi_snapshot_id bigint;
BEGIN
  SELECT id
  INTO v_fi_snapshot_id
  FROM bv_parsed.v_fi_organisation_latest
  WHERE tenant_id = p_tenant_id
    AND organisationsnummer = p_organisationsnummer;

  DELETE FROM bv_read.company_fi_reports_current
  WHERE tenant_id = p_tenant_id
    AND organisationsnummer = p_organisationsnummer;

  IF v_fi_snapshot_id IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO bv_read.company_fi_reports_current (
    tenant_id,
    organisationsnummer,
    report_rank,
    fi_organisation_snapshot_id,
    fi_finansiell_rapport_arende_id,
    fi_finansiell_rapport_id,
    arendenummer,
    avslutat_tidpunkt,
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
    data_refreshed_at
  )
  SELECT
    p_tenant_id,
    p_organisationsnummer,
    row_number() OVER (
      ORDER BY fr.registrerad_datum DESC NULLS LAST,
               fr.period_tom DESC NULLS LAST,
               fr.id DESC
    ),
    v_fi_snapshot_id,
    a.id,
    fr.id,
    a.arendenummer,
    a.avslutat_tidpunkt,
    fr.rapporttyp_kod,
    fr.rapporttyp_klartext,
    fr.ankom_datum,
    fr.handlaggning_avslutad_datum,
    fr.registrerad_datum,
    fr.innehaller_koncernredovisning,
    fr.period_from,
    fr.period_tom,
    fr.vinstutdelning_beslutad_datum,
    fr.vinstutdelning_valuta_kod,
    fr.vinstutdelning_valuta_klartext,
    fr.vinstutdelning_belopp,
    NOW()
  FROM bv_parsed.fi_finansiella_rapport_arenden a
  JOIN bv_parsed.fi_finansiella_rapporter fr
    ON fr.fi_finansiell_rapport_arende_id = a.id
  WHERE a.fi_organisation_snapshot_id = v_fi_snapshot_id
  ORDER BY fr.registrerad_datum DESC NULLS LAST,
           fr.period_tom DESC NULLS LAST,
           fr.id DESC;
END;
$$;

CREATE OR REPLACE FUNCTION bv_read.refresh_company_hvd_documents_current(
  p_tenant_id uuid,
  p_organisationsnummer varchar
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_snapshot_id bigint;
BEGIN
  SELECT id
  INTO v_snapshot_id
  FROM (
    SELECT s.*,
           row_number() OVER (
             PARTITION BY s.tenant_id, s.organisationsnummer
             ORDER BY s.payload_created_at DESC, s.id DESC
           ) AS rn
    FROM bv_parsed.hvd_dokumentlista_snapshots s
    WHERE s.tenant_id = p_tenant_id
      AND s.organisationsnummer = p_organisationsnummer
  ) q
  WHERE q.rn = 1;

  DELETE FROM bv_read.company_hvd_documents_current
  WHERE tenant_id = p_tenant_id
    AND organisationsnummer = p_organisationsnummer;

  IF v_snapshot_id IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO bv_read.company_hvd_documents_current (
    tenant_id,
    organisationsnummer,
    document_rank,
    hvd_dokumentlista_snapshot_id,
    hvd_dokument_id,
    dokument_id,
    filformat,
    registreringstidpunkt,
    rapporteringsperiod_tom,
    data_refreshed_at
  )
  SELECT
    p_tenant_id,
    p_organisationsnummer,
    row_number() OVER (
      ORDER BY d.registreringstidpunkt DESC NULLS LAST,
               d.rapporteringsperiod_tom DESC NULLS LAST,
               d.id DESC
    ),
    v_snapshot_id,
    d.id,
    d.dokument_id,
    d.filformat,
    d.registreringstidpunkt,
    d.rapporteringsperiod_tom,
    NOW()
  FROM bv_parsed.hvd_dokument d
  WHERE d.hvd_dokumentlista_snapshot_id = v_snapshot_id
  ORDER BY d.registreringstidpunkt DESC NULLS LAST,
           d.rapporteringsperiod_tom DESC NULLS LAST,
           d.id DESC;
END;
$$;

CREATE OR REPLACE FUNCTION bv_read.refresh_company_current_all(
  p_tenant_id uuid,
  p_organisationsnummer varchar
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM bv_read.refresh_company_overview_current(p_tenant_id, p_organisationsnummer);
  PERFORM bv_read.refresh_company_officers_current(p_tenant_id, p_organisationsnummer);
  PERFORM bv_read.refresh_company_fi_reports_current(p_tenant_id, p_organisationsnummer);
  PERFORM bv_read.refresh_company_hvd_documents_current(p_tenant_id, p_organisationsnummer);
END;
$$;

COMMIT;

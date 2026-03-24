import { MigrationInterface, QueryRunner } from 'typeorm';

export class BolagsverketSchema1000000000002 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`-- =============================================================================
-- Migration 002: Bolagsverket Complete Schema
--
-- Captures 100% of data from:
--   /organisationer         – High-value org dataset
--   /organisationsinformation (v4) – Extended org details
--   /dokumentlista          – Financial document metadata
--   /personer               – Individual person records
--
-- Design principles:
--   • Multi-tenant: every table carries tenant_id
--   • KodKlartext pattern: all coded fields store both kod + klartext
--   • JSONB for complex/nested structures; normalised columns for queries
--   • Full audit trail via bolagsverket_api_calls
--   • Historical tables for status, share-capital, officers
--   • Idempotent (IF NOT EXISTS / DO NOTHING)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. API Audit Trail
--    Stores every outbound Bolagsverket HTTP call with its X-Request-Id
--    correlation header so any response can be replayed / audited.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bolagsverket_api_calls (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  -- Which Bolagsverket endpoint was called (e.g. 'organisationer', 'personer')
  endpoint          VARCHAR(128) NOT NULL,
  -- HTTP method (GET / POST)
  http_method       VARCHAR(16)  NOT NULL DEFAULT 'GET',
  -- Full URL path + query string
  request_url       TEXT         NOT NULL,
  -- X-Request-Id header sent with the call
  correlation_id    VARCHAR(128),
  -- Organisation / person number looked up, for fast joins
  subject_id        VARCHAR(64),
  -- Raw JSON sent in the request body (if any)
  request_payload   JSONB        NOT NULL DEFAULT '{}'::jsonb,
  -- Complete raw JSON response from Bolagsverket
  response_payload  JSONB        NOT NULL DEFAULT '{}'::jsonb,
  http_status_code  INTEGER,
  -- Duration in milliseconds
  duration_ms       INTEGER,
  error_message     TEXT,
  called_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_bv_api_calls_tenant_subject
  ON bolagsverket_api_calls (tenant_id, subject_id, called_at DESC);
CREATE INDEX IF NOT EXISTS idx_bv_api_calls_correlation
  ON bolagsverket_api_calls (correlation_id);

-- ---------------------------------------------------------------------------
-- 2. Core Organisation Record
--    One row per unique organisationsnummer × tenant.
--    Links back to companies.id so Bolagsverket data enriches the core entity.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bolagsverket_organisationer (
  id                      UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  company_id              UUID         REFERENCES companies(id) ON DELETE SET NULL,
  -- Swedish organisation number, 10 digits without hyphen
  organisationsnummer     VARCHAR(20)  NOT NULL,
  -- GD-number assigned by Bolagsverket internally
  gd_nummer               VARCHAR(32),
  -- Current legal / trading name
  namn                    VARCHAR(255),

  -- Legal form (organisationsform) – KodKlartext
  organisationsform_kod       VARCHAR(32),
  organisationsform_klartext  VARCHAR(255),

  -- Tax-agency legal form (juridiskForm) – KodKlartext
  juridisk_form_kod           VARCHAR(32),
  juridisk_form_klartext      VARCHAR(255),

  -- Registration country – KodKlartext
  registreringsland_kod       VARCHAR(8),
  registreringsland_klartext  VARCHAR(128),

  -- Land (county/region of principal office) – KodKlartext
  lan_kod                 VARCHAR(8),
  lan_klartext            VARCHAR(128),

  -- Key dates (organisationsdatum block)
  registreringsdatum      DATE,
  avregistreringsdatum    DATE,
  bildningsdatum          DATE,
  -- Date the company data was last refreshed from Bolagsverket
  senast_uppdaterad       TIMESTAMPTZ,

  -- Current aggregate status (derived from organisationsstatusar)
  aktuell_status_kod      VARCHAR(64),
  aktuell_status_klartext VARCHAR(255),

  -- Store the entire raw /organisationer response for this org
  raw_payload             JSONB        NOT NULL DEFAULT '{}'::jsonb,

  api_call_id             UUID         REFERENCES bolagsverket_api_calls(id) ON DELETE SET NULL,
  created_at              TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  UNIQUE (tenant_id, organisationsnummer)
);
CREATE INDEX IF NOT EXISTS idx_bv_org_tenant_orgnr
  ON bolagsverket_organisationer (tenant_id, organisationsnummer);

-- ---------------------------------------------------------------------------
-- 3. Business Names  (organisationsnamn)
--    A company can have multiple names over time (main, secondary, trade).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bolagsverket_organisationsnamn (
  id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  organisation_id     UUID         NOT NULL REFERENCES bolagsverket_organisationer(id) ON DELETE CASCADE,
  namn                VARCHAR(255) NOT NULL,
  -- Name type: FIRMA, BIFIRMA, TRADINGNAME, etc. – KodKlartext
  namntyp_kod         VARCHAR(64),
  namntyp_klartext    VARCHAR(255),
  registreringsdatum  DATE,
  avregistreringsdatum DATE,
  -- Whether this is the currently active name
  ar_aktuellt         BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_bv_org_namn_org
  ON bolagsverket_organisationsnamn (organisation_id);

-- ---------------------------------------------------------------------------
-- 4. Organisation Status Timeline  (organisationsstatusar)
--    Each status transition event: registered, deregistered, restructuring, etc.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bolagsverket_organisationsstatusar (
  id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  organisation_id     UUID         NOT NULL REFERENCES bolagsverket_organisationer(id) ON DELETE CASCADE,
  -- Status code – KodKlartext
  status_kod          VARCHAR(64)  NOT NULL,
  status_klartext     VARCHAR(255),
  -- When this status became active / ended
  fran_datum          DATE,
  till_datum          DATE,
  -- Whether this is the currently active status
  ar_aktuellt         BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_bv_status_org
  ON bolagsverket_organisationsstatusar (organisation_id, fran_datum DESC);

-- ---------------------------------------------------------------------------
-- 5. Addresses  (postadress / besöksadress / kommunorganisationsadresser)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bolagsverket_organisationsadresser (
  id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  organisation_id     UUID         NOT NULL REFERENCES bolagsverket_organisationer(id) ON DELETE CASCADE,
  -- Address type: POSTADRESS, BESOKSADRESS, KOMMUNADRESS, etc.
  adresstyp           VARCHAR(64)  NOT NULL,
  -- Address components
  co_adress           VARCHAR(255),
  gatuadress          VARCHAR(255),
  box_nummer          VARCHAR(64),
  postnummer          VARCHAR(16),
  postort             VARCHAR(128),
  -- Country – KodKlartext
  land_kod            VARCHAR(8),
  land_klartext       VARCHAR(128),
  -- For kommunorganisationsadresser: region + municipality codes
  region_kod          VARCHAR(8),
  region_klartext     VARCHAR(128),
  kommun_kod          VARCHAR(8),
  kommun_klartext     VARCHAR(128),
  ar_aktuellt         BOOLEAN      NOT NULL DEFAULT TRUE,
  registreringsdatum  DATE,
  avregistreringsdatum DATE,
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_bv_adresser_org
  ON bolagsverket_organisationsadresser (organisation_id, adresstyp);

-- ---------------------------------------------------------------------------
-- 6. Domicile  (hemvist – HEMVIST dataset)
--    Region + municipality where the company has its registered seat.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bolagsverket_hemvist (
  id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  organisation_id     UUID         NOT NULL REFERENCES bolagsverket_organisationer(id) ON DELETE CASCADE,
  -- Region (county) – KodKlartext
  region_kod          VARCHAR(8),
  region_klartext     VARCHAR(128),
  -- Municipality – KodKlartext
  kommun_kod          VARCHAR(8),
  kommun_klartext     VARCHAR(128),
  registreringsdatum  DATE,
  ar_aktuellt         BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (organisation_id)
);

-- ---------------------------------------------------------------------------
-- 7. Business Activity Description  (verksamhetsbeskrivning)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bolagsverket_verksamhetsbeskrivning (
  id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  organisation_id     UUID         NOT NULL REFERENCES bolagsverket_organisationer(id) ON DELETE CASCADE,
  beskrivning         TEXT         NOT NULL,
  registreringsdatum  DATE,
  ar_aktuellt         BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_bv_verks_org
  ON bolagsverket_verksamhetsbeskrivning (organisation_id);

-- ---------------------------------------------------------------------------
-- 8. Industry Classification  (näringsbeskrivning / SNI codes)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bolagsverket_naringsbeskrivning (
  id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  organisation_id     UUID         NOT NULL REFERENCES bolagsverket_organisationer(id) ON DELETE CASCADE,
  -- SNI code – KodKlartext
  sni_kod             VARCHAR(16)  NOT NULL,
  sni_klartext        VARCHAR(255),
  -- Whether this is the primary SNI code
  ar_huvud            BOOLEAN      NOT NULL DEFAULT FALSE,
  registreringsdatum  DATE,
  ar_aktuellt         BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_bv_naring_org
  ON bolagsverket_naringsbeskrivning (organisation_id);
CREATE INDEX IF NOT EXISTS idx_bv_naring_sni
  ON bolagsverket_naringsbeskrivning (sni_kod);

-- ---------------------------------------------------------------------------
-- 9. Officers / Board Members  (funktionärer)
--    One row per person–organisation–role appointment.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bolagsverket_funktionarer (
  id                      UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  organisation_id         UUID         NOT NULL REFERENCES bolagsverket_organisationer(id) ON DELETE CASCADE,
  -- Officer's identifier (personnummer 12 digits, samordningsnummer, or org-number for legal-entity officers)
  identitetsbeteckning    VARCHAR(32),
  -- Type of ID: PERSONNUMMER, SAMORDNINGSNUMMER, ORGANISATIONSNUMMER
  identitetstyp           VARCHAR(32),
  fornamn                 VARCHAR(128),
  efternamn               VARCHAR(128),
  -- Full name for legal-entity officers
  namn                    VARCHAR(255),
  -- Country of residence/domicile – KodKlartext
  land_kod                VARCHAR(8),
  land_klartext           VARCHAR(128),
  -- Appointment / removal dates
  utsedd_datum            DATE,
  avgangen_datum          DATE,
  ar_aktuellt             BOOLEAN      NOT NULL DEFAULT TRUE,
  -- All roles held by this officer at this organisation (JSONB array of KodKlartext objects)
  roller                  JSONB        NOT NULL DEFAULT '[]'::jsonb,
  -- Signatory authority type at time of appointment (ENSAM, TILLSAMMANS, LÖPANDE, FULLMAKT)
  firmateckningstyp       VARCHAR(64),
  created_at              TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_bv_funk_org
  ON bolagsverket_funktionarer (organisation_id, ar_aktuellt);
CREATE INDEX IF NOT EXISTS idx_bv_funk_person
  ON bolagsverket_funktionarer (identitetsbeteckning);

-- ---------------------------------------------------------------------------
-- 10. Officer Roles  (funktionärsroller)
--     Detailed role rows when an officer holds multiple roles simultaneously.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bolagsverket_funktionarroller (
  id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  funktionar_id       UUID         NOT NULL REFERENCES bolagsverket_funktionarer(id) ON DELETE CASCADE,
  -- Role type – KodKlartext (e.g. STYRELSELEDAMOT, VD, REVISOR, SUPPLEANT)
  roll_kod            VARCHAR(64)  NOT NULL,
  roll_klartext       VARCHAR(255),
  utsedd_datum        DATE,
  avgangen_datum      DATE,
  ar_aktuellt         BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_bv_roll_funk
  ON bolagsverket_funktionarroller (funktionar_id);

-- ---------------------------------------------------------------------------
-- 11. Signatory Power Rules  (firmateckning)
--     High-level rules per organisation (can sign alone, together, etc.)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bolagsverket_firmateckning (
  id                      UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  organisation_id         UUID         NOT NULL REFERENCES bolagsverket_organisationer(id) ON DELETE CASCADE,
  -- Rule type – KodKlartext: ENSAM, TILLSAMMANS, LÖPANDE (VD day-to-day), FULLMAKT
  typ_kod                 VARCHAR(64)  NOT NULL,
  typ_klartext            VARCHAR(255),
  -- Free-text description of the rule (e.g. "Two board members jointly")
  beskrivning             TEXT,
  registreringsdatum      DATE,
  ar_aktuellt             BOOLEAN      NOT NULL DEFAULT TRUE,
  -- Store complex nested rule details as JSONB
  regel_detaljer          JSONB        NOT NULL DEFAULT '{}'::jsonb,
  created_at              TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_bv_firma_org
  ON bolagsverket_firmateckning (organisation_id);

-- ---------------------------------------------------------------------------
-- 12. Signatory Power Combinations  (firmateckningskombinationer)
--     Each row is one specific combination (e.g. "Person A + Person B together").
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bolagsverket_firmateckning_kombinationer (
  id                      UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  firmateckning_id        UUID         NOT NULL REFERENCES bolagsverket_firmateckning(id) ON DELETE CASCADE,
  kombination_nummer      INTEGER,
  -- JSON array of person identifiers in this combination
  personer                JSONB        NOT NULL DEFAULT '[]'::jsonb,
  -- Full combination detail as JSONB for flexibility
  kombination_detaljer    JSONB        NOT NULL DEFAULT '{}'::jsonb,
  created_at              TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_bv_firma_komb
  ON bolagsverket_firmateckning_kombinationer (firmateckning_id);

-- ---------------------------------------------------------------------------
-- 13. Share Capital  (aktieinformation)
--     One row per organisation representing current share-capital state.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bolagsverket_aktieinformation (
  id                          UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                   UUID           NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  organisation_id             UUID           NOT NULL REFERENCES bolagsverket_organisationer(id) ON DELETE CASCADE,
  -- Share capital in SEK
  aktiekapital                NUMERIC(20, 2),
  -- Min / max limits on share capital
  aktiekapital_min            NUMERIC(20, 2),
  aktiekapital_max            NUMERIC(20, 2),
  -- Total number of shares
  antal_aktier                BIGINT,
  antal_aktier_min            BIGINT,
  antal_aktier_max            BIGINT,
  -- Quota value (aktiens kvotvärde)
  kvotevarde                  NUMERIC(20, 6),
  -- Currency – KodKlartext
  valuta_kod                  VARCHAR(8)     DEFAULT 'SEK',
  valuta_klartext             VARCHAR(64),
  registreringsdatum          DATE,
  ar_aktuellt                 BOOLEAN        NOT NULL DEFAULT TRUE,
  -- Full raw aktieinformation block
  raw_payload                 JSONB          NOT NULL DEFAULT '{}'::jsonb,
  created_at                  TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  UNIQUE (organisation_id)
);

-- ---------------------------------------------------------------------------
-- 14. Share Classes  (aktieslag)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bolagsverket_aktieslag (
  id                      UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID           NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  aktieinformation_id     UUID           NOT NULL REFERENCES bolagsverket_aktieinformation(id) ON DELETE CASCADE,
  -- Share class type – KodKlartext (A, B, C, preference shares, etc.)
  slag_kod                VARCHAR(64),
  slag_klartext           VARCHAR(255),
  antal                   BIGINT,
  antal_min               BIGINT,
  antal_max               BIGINT,
  -- Votes per share
  roster_per_aktie        NUMERIC(10, 4),
  kvotevarde              NUMERIC(20, 6),
  ar_aktuellt             BOOLEAN        NOT NULL DEFAULT TRUE,
  created_at              TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_bv_aktieslag_info
  ON bolagsverket_aktieslag (aktieinformation_id);

-- ---------------------------------------------------------------------------
-- 15. Share Capital Limits  (aktiegränser)
--     Separate limit rows when Bolagsverket provides a dedicated limits block.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bolagsverket_aktiegranser (
  id                      UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID           NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  aktieinformation_id     UUID           NOT NULL REFERENCES bolagsverket_aktieinformation(id) ON DELETE CASCADE,
  -- Limit type – KodKlartext (AKTIEKAPITAL_MIN, AKTIEKAPITAL_MAX, ANTAL_MIN, ANTAL_MAX, etc.)
  grans_typ_kod           VARCHAR(64),
  grans_typ_klartext      VARCHAR(255),
  varde                   NUMERIC(20, 6),
  created_at              TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- 16. Share Capital Historical Changes
--     Tracks every registered change to share capital over the company's lifetime.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bolagsverket_aktiekapital_forandringar (
  id                      UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID           NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  organisation_id         UUID           NOT NULL REFERENCES bolagsverket_organisationer(id) ON DELETE CASCADE,
  -- Change type – KodKlartext (EMISSION, NEDSATTNING, etc.)
  forandring_typ_kod      VARCHAR(64),
  forandring_typ_klartext VARCHAR(255),
  aktiekapital_fore       NUMERIC(20, 2),
  aktiekapital_efter      NUMERIC(20, 2),
  antal_aktier_fore       BIGINT,
  antal_aktier_efter      BIGINT,
  registreringsdatum      DATE,
  raw_payload             JSONB          NOT NULL DEFAULT '{}'::jsonb,
  created_at              TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_bv_ak_forandr_org
  ON bolagsverket_aktiekapital_forandringar (organisation_id, registreringsdatum DESC);

-- ---------------------------------------------------------------------------
-- 17. Board Size Limits  (styrelsegränser)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bolagsverket_styrelsegranser (
  id                          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                   UUID         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  organisation_id             UUID         NOT NULL REFERENCES bolagsverket_organisationer(id) ON DELETE CASCADE,
  -- Applies to: STYRELSELEDAMOTER, SUPPLEANTER, etc. – KodKlartext
  roll_typ_kod                VARCHAR(64),
  roll_typ_klartext           VARCHAR(255),
  antal_min                   INTEGER,
  antal_max                   INTEGER,
  ar_aktuellt                 BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at                  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (organisation_id, roll_typ_kod)
);

-- ---------------------------------------------------------------------------
-- 18. Financial Reports  (finansiellaRapporter)
--     Annual reports, profit distributions, interim reports, etc.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bolagsverket_finansiella_rapporter (
  id                          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                   UUID         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  organisation_id             UUID         NOT NULL REFERENCES bolagsverket_organisationer(id) ON DELETE CASCADE,
  -- Report type – KodKlartext (ARSREDOVISNING, VINSTUTDELNING, DELARSRAPPORT, etc.)
  rapport_typ_kod             VARCHAR(64)  NOT NULL,
  rapport_typ_klartext        VARCHAR(255),
  -- The accounting period this report covers
  rapporteringsperiod_fran    DATE,
  rapporteringsperiod_till    DATE,
  -- Date report was filed / received by Bolagsverket
  inkom_datum                 DATE,
  registreringsdatum          DATE,
  -- Status of the filing – KodKlartext
  status_kod                  VARCHAR(64),
  status_klartext             VARCHAR(255),
  -- Bolagsverket document id (links to dokumentlista)
  dokument_id                 VARCHAR(128),
  raw_payload                 JSONB        NOT NULL DEFAULT '{}'::jsonb,
  created_at                  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_bv_fin_rap_org
  ON bolagsverket_finansiella_rapporter (organisation_id, rapporteringsperiod_till DESC);

-- ---------------------------------------------------------------------------
-- 19. Accounting Periods  (räkenskapsår)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bolagsverket_rakenskapsperioder (
  id                          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                   UUID         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  organisation_id             UUID         NOT NULL REFERENCES bolagsverket_organisationer(id) ON DELETE CASCADE,
  period_fran                 DATE         NOT NULL,
  period_till                 DATE         NOT NULL,
  -- First year (brutet räkenskapsår) flag
  ar_forsta                   BOOLEAN      NOT NULL DEFAULT FALSE,
  -- Whether this is the current/active period
  ar_aktuellt                 BOOLEAN      NOT NULL DEFAULT FALSE,
  registreringsdatum          DATE,
  created_at                  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_bv_rak_org
  ON bolagsverket_rakenskapsperioder (organisation_id, period_till DESC);

-- ---------------------------------------------------------------------------
-- 20. Permits / Licenses  (tillstånd)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bolagsverket_tillstand (
  id                          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                   UUID         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  organisation_id             UUID         NOT NULL REFERENCES bolagsverket_organisationer(id) ON DELETE CASCADE,
  -- Permit type – KodKlartext
  tillstand_typ_kod           VARCHAR(64),
  tillstand_typ_klartext      VARCHAR(255),
  -- Issuing authority – KodKlartext
  utfardare_kod               VARCHAR(64),
  utfardare_klartext          VARCHAR(255),
  -- Permit status – KodKlartext (GILTIGT, ATERKALLAT, AVSLUTAT, etc.)
  status_kod                  VARCHAR(64),
  status_klartext             VARCHAR(255),
  giltigt_fran                DATE,
  giltigt_till                DATE,
  registreringsdatum          DATE,
  avregistreringsdatum        DATE,
  ar_aktuellt                 BOOLEAN      NOT NULL DEFAULT TRUE,
  -- Additional permit detail
  raw_payload                 JSONB        NOT NULL DEFAULT '{}'::jsonb,
  created_at                  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_bv_tillstand_org
  ON bolagsverket_tillstand (organisation_id, ar_aktuellt);

-- ---------------------------------------------------------------------------
-- 21. Articles of Association  (bestämmelser)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bolagsverket_bestammelser (
  id                          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                   UUID         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  organisation_id             UUID         NOT NULL REFERENCES bolagsverket_organisationer(id) ON DELETE CASCADE,
  -- Type of article – KodKlartext
  bestammelse_typ_kod         VARCHAR(64),
  bestammelse_typ_klartext    VARCHAR(255),
  -- Free text of the article clause
  text                        TEXT,
  -- Date this clause was adopted / registered
  antagen_datum               DATE,
  registreringsdatum          DATE,
  ar_aktuellt                 BOOLEAN      NOT NULL DEFAULT TRUE,
  raw_payload                 JSONB        NOT NULL DEFAULT '{}'::jsonb,
  created_at                  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_bv_best_org
  ON bolagsverket_bestammelser (organisation_id);

-- ---------------------------------------------------------------------------
-- 22. Authorizations  (bemyndiganden)
--     Board resolutions authorising share capital modifications, etc.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bolagsverket_bemyndiganden (
  id                          UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                   UUID           NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  organisation_id             UUID           NOT NULL REFERENCES bolagsverket_organisationer(id) ON DELETE CASCADE,
  -- Authorization type – KodKlartext
  bemyndigande_typ_kod        VARCHAR(64),
  bemyndigande_typ_klartext   VARCHAR(255),
  -- Upper limit on shares authorised
  max_antal_aktier            BIGINT,
  max_aktiekapital            NUMERIC(20, 2),
  -- Valid window
  giltigt_fran                DATE,
  giltigt_till                DATE,
  registreringsdatum          DATE,
  ar_aktuellt                 BOOLEAN        NOT NULL DEFAULT TRUE,
  raw_payload                 JSONB          NOT NULL DEFAULT '{}'::jsonb,
  created_at                  TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- 23. Debt Instruments  (skuldebrev)
--     Convertibles, subscription options, warrant programmes.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bolagsverket_skuldebrev (
  id                          UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                   UUID           NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  organisation_id             UUID           NOT NULL REFERENCES bolagsverket_organisationer(id) ON DELETE CASCADE,
  -- Instrument type – KodKlartext (KONVERTIBEL, TECKNINGSOPTION, SKULDEBREV, etc.)
  instrument_typ_kod          VARCHAR(64),
  instrument_typ_klartext     VARCHAR(255),
  -- Nominal value of issuance
  nominellt_belopp            NUMERIC(20, 2),
  valuta_kod                  VARCHAR(8)     DEFAULT 'SEK',
  -- Conversion / exercise window
  konverterings_fran          DATE,
  konverterings_till          DATE,
  registreringsdatum          DATE,
  ar_aktuellt                 BOOLEAN        NOT NULL DEFAULT TRUE,
  raw_payload                 JSONB          NOT NULL DEFAULT '{}'::jsonb,
  created_at                  TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- 24. Cases / Matters  (ärende)
--     Bolagsverket case numbers linked to registrations or changes.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bolagsverket_arenden (
  id                          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                   UUID         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  organisation_id             UUID         NOT NULL REFERENCES bolagsverket_organisationer(id) ON DELETE CASCADE,
  arende_nummer               VARCHAR(64),
  -- Case type – KodKlartext
  arende_typ_kod              VARCHAR(64),
  arende_typ_klartext         VARCHAR(255),
  -- Case status – KodKlartext
  status_kod                  VARCHAR(64),
  status_klartext             VARCHAR(255),
  inkommen_datum              DATE,
  beslutad_datum              DATE,
  registreringsdatum          DATE,
  raw_payload                 JSONB        NOT NULL DEFAULT '{}'::jsonb,
  created_at                  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_bv_arenden_org
  ON bolagsverket_arenden (organisation_id);

-- ---------------------------------------------------------------------------
-- 25. Organisation Markings  (organisationsmarkeringar)
--     System markings such as LAGER (shelf company), VILANDE, etc.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bolagsverket_organisationsmarkeringar (
  id                          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                   UUID         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  organisation_id             UUID         NOT NULL REFERENCES bolagsverket_organisationer(id) ON DELETE CASCADE,
  -- Marking type – KodKlartext
  markering_kod               VARCHAR(64)  NOT NULL,
  markering_klartext          VARCHAR(255),
  satt_datum                  DATE,
  borttagen_datum             DATE,
  ar_aktuellt                 BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at                  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_bv_markeringar_org
  ON bolagsverket_organisationsmarkeringar (organisation_id, ar_aktuellt);

-- ---------------------------------------------------------------------------
-- 26. Economic Plan  (ekonomiskPlan)
--     Specific to tenant-owner associations (BRF) – Bostadsrättsförening.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bolagsverket_ekonomisk_plan (
  id                          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                   UUID         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  organisation_id             UUID         NOT NULL REFERENCES bolagsverket_organisationer(id) ON DELETE CASCADE,
  -- Plan status – KodKlartext
  status_kod                  VARCHAR(64),
  status_klartext             VARCHAR(255),
  plan_datum                  DATE,
  registreringsdatum          DATE,
  -- Full plan detail including valuations, apartments, etc.
  raw_payload                 JSONB        NOT NULL DEFAULT '{}'::jsonb,
  created_at                  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (organisation_id)
);

-- ---------------------------------------------------------------------------
-- 27. Foreign Branch Owning Organisation  (utländskFilialagandeOrganisation)
--     When the company is a Swedish branch of a foreign legal entity.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bolagsverket_utlandsk_filial (
  id                          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                   UUID         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  organisation_id             UUID         NOT NULL REFERENCES bolagsverket_organisationer(id) ON DELETE CASCADE,
  -- Foreign parent company name
  utlandsk_namn               VARCHAR(255),
  -- Country of incorporation – KodKlartext
  land_kod                    VARCHAR(8),
  land_klartext               VARCHAR(128),
  -- Foreign registration number in home country
  utlandsk_registreringsnummer VARCHAR(64),
  -- Legal form in home country – KodKlartext
  juridisk_form_kod           VARCHAR(64),
  juridisk_form_klartext      VARCHAR(255),
  raw_payload                 JSONB        NOT NULL DEFAULT '{}'::jsonb,
  created_at                  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (organisation_id)
);

-- ---------------------------------------------------------------------------
-- 28. Vacancies & Notifications  (vakanser & upplysningar)
--     Board vacancies and Bolagsverket system notifications.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bolagsverket_vakanser_upplysningar (
  id                          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                   UUID         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  organisation_id             UUID         NOT NULL REFERENCES bolagsverket_organisationer(id) ON DELETE CASCADE,
  -- Type – KodKlartext (VAKANS, UPPLYSNING)
  typ_kod                     VARCHAR(64)  NOT NULL,
  typ_klartext                VARCHAR(255),
  -- Role type for vacancy – KodKlartext
  roll_kod                    VARCHAR(64),
  roll_klartext               VARCHAR(255),
  -- Free text notification
  text                        TEXT,
  registreringsdatum          DATE,
  ar_aktuellt                 BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at                  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_bv_vakans_org
  ON bolagsverket_vakanser_upplysningar (organisation_id);

-- ---------------------------------------------------------------------------
-- 29. Miscellaneous Notes  (övrig organisationsinformation)
--     Free-text notes attached to an organisation record.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bolagsverket_ovrig_information (
  id                          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                   UUID         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  organisation_id             UUID         NOT NULL REFERENCES bolagsverket_organisationer(id) ON DELETE CASCADE,
  informationstyp             VARCHAR(128),
  text                        TEXT,
  registreringsdatum          DATE,
  created_at                  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- 30. Cross-Company Engagement  (organisationsengagemang)
--     Officers' roles / involvements in OTHER companies.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bolagsverket_organisationsengagemang (
  id                              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                       UUID         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  -- The person (identified by their functionary record in this or any org)
  identitetsbeteckning            VARCHAR(32)  NOT NULL,
  identitetstyp                   VARCHAR(32),
  -- The other organisation where the person has a role
  engagerad_organisationsnummer   VARCHAR(20)  NOT NULL,
  engagerad_organisations_namn    VARCHAR(255),
  -- Role – KodKlartext
  roll_kod                        VARCHAR(64),
  roll_klartext                   VARCHAR(255),
  -- Legal form of the other company – KodKlartext
  juridisk_form_kod               VARCHAR(32),
  juridisk_form_klartext          VARCHAR(255),
  utsedd_datum                    DATE,
  avgangen_datum                  DATE,
  ar_aktuellt                     BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at                      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_bv_eng_person
  ON bolagsverket_organisationsengagemang (identitetsbeteckning);
CREATE INDEX IF NOT EXISTS idx_bv_eng_other_org
  ON bolagsverket_organisationsengagemang (engagerad_organisationsnummer);

-- ---------------------------------------------------------------------------
-- 31. Document List  (/dokumentlista)
--     Metadata about annual reports and financial documents available for download.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bolagsverket_dokumentlista (
  id                          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                   UUID         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  organisation_id             UUID         REFERENCES bolagsverket_organisationer(id) ON DELETE SET NULL,
  organisationsnummer         VARCHAR(20)  NOT NULL,
  -- Bolagsverket's internal document identifier
  dokument_id                 VARCHAR(128) NOT NULL,
  -- File format – KodKlartext (PDF, XBRL, etc.)
  filformat_kod               VARCHAR(32),
  filformat_klartext          VARCHAR(128),
  -- Report type – KodKlartext (ARSREDOVISNING, DELARSRAPPORT, etc.)
  rapport_typ_kod             VARCHAR(64),
  rapport_typ_klartext        VARCHAR(255),
  -- The accounting period this document covers
  rapporteringsperiod_fran    DATE,
  rapporteringsperiod_till    DATE,
  registrerad_tidpunkt        TIMESTAMPTZ,
  -- URL / download reference if available
  nedladdnings_url            TEXT,
  raw_payload                 JSONB        NOT NULL DEFAULT '{}'::jsonb,
  created_at                  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, dokument_id)
);
CREATE INDEX IF NOT EXISTS idx_bv_dokument_org
  ON bolagsverket_dokumentlista (organisationsnummer, rapporteringsperiod_till DESC);

-- ---------------------------------------------------------------------------
-- 32. Persons  (/personer)
--     Individual records from the Bolagsverket persons API.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bolagsverket_personer (
  id                          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                   UUID         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  -- 12-digit personnummer (YYYYMMDDXXXX) or samordningsnummer
  identitetsbeteckning        VARCHAR(32)  NOT NULL,
  identitetstyp               VARCHAR(32)  NOT NULL DEFAULT 'PERSONNUMMER',
  fornamn                     VARCHAR(128),
  efternamn                   VARCHAR(128),
  -- Whether this person is deceased (dödsbo)
  ar_dodsbo                   BOOLEAN      NOT NULL DEFAULT FALSE,
  dodsbo_datum                DATE,
  -- Insolvency proceeding type – KodKlartext
  insolvensforfarande_kod     VARCHAR(64),
  insolvensforfarande_klartext VARCHAR(255),
  -- Bankruptcy trustee name (if in bankruptcy)
  konkursforvaltare_namn      VARCHAR(255),
  -- Full raw /personer response
  raw_payload                 JSONB        NOT NULL DEFAULT '{}'::jsonb,
  api_call_id                 UUID         REFERENCES bolagsverket_api_calls(id) ON DELETE SET NULL,
  created_at                  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, identitetsbeteckning)
);
CREATE INDEX IF NOT EXISTS idx_bv_person_tenant_id
  ON bolagsverket_personer (tenant_id, identitetsbeteckning);

-- ---------------------------------------------------------------------------
-- 33. Personal Bankruptcy  (personligKonkurs / insolvensförfarande)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bolagsverket_personlig_konkurs (
  id                          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                   UUID         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  person_id                   UUID         NOT NULL REFERENCES bolagsverket_personer(id) ON DELETE CASCADE,
  -- Proceeding type – KodKlartext (KONKURS, SKULDSANERING, FORETAGSREKONSTRUKTION, etc.)
  forfarande_typ_kod          VARCHAR(64)  NOT NULL,
  forfarande_typ_klartext     VARCHAR(255),
  -- Status – KodKlartext
  status_kod                  VARCHAR(64),
  status_klartext             VARCHAR(255),
  -- Court (tingsrätt) – KodKlartext
  domstol_kod                 VARCHAR(64),
  domstol_klartext            VARCHAR(255),
  -- Bankruptcy case number
  mal_nummer                  VARCHAR(64),
  besluts_datum               DATE,
  avslutat_datum              DATE,
  ar_aktuellt                 BOOLEAN      NOT NULL DEFAULT TRUE,
  raw_payload                 JSONB        NOT NULL DEFAULT '{}'::jsonb,
  created_at                  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_bv_konkurs_person
  ON bolagsverket_personlig_konkurs (person_id);

-- ---------------------------------------------------------------------------
-- 34. Trade Bans  (naringsförbud)
--     Definitive, provisional, and exemptions.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bolagsverket_naringsforbud (
  id                          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                   UUID         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  person_id                   UUID         NOT NULL REFERENCES bolagsverket_personer(id) ON DELETE CASCADE,
  -- Ban type – KodKlartext (DEFINITIVT, INTERIMISTISKT, UNDANTAG)
  forbud_typ_kod              VARCHAR(64)  NOT NULL,
  forbud_typ_klartext         VARCHAR(255),
  -- Status – KodKlartext
  status_kod                  VARCHAR(64),
  status_klartext             VARCHAR(255),
  -- Issuing court – KodKlartext
  domstol_kod                 VARCHAR(64),
  domstol_klartext            VARCHAR(255),
  mal_nummer                  VARCHAR(64),
  -- Effective period
  giltigt_fran                DATE,
  giltigt_till                DATE,
  ar_aktuellt                 BOOLEAN      NOT NULL DEFAULT TRUE,
  -- Exemptions (undantag) stored as JSONB array
  undantag                    JSONB        NOT NULL DEFAULT '[]'::jsonb,
  raw_payload                 JSONB        NOT NULL DEFAULT '{}'::jsonb,
  created_at                  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_bv_naringsforbud_person
  ON bolagsverket_naringsforbud (person_id);

-- ---------------------------------------------------------------------------
-- 35. Financial Assistance Prohibitions  (biträdesförbud)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bolagsverket_bitradesforbud (
  id                          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                   UUID         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  person_id                   UUID         NOT NULL REFERENCES bolagsverket_personer(id) ON DELETE CASCADE,
  -- Ban type – KodKlartext
  forbud_typ_kod              VARCHAR(64),
  forbud_typ_klartext         VARCHAR(255),
  -- Status – KodKlartext
  status_kod                  VARCHAR(64),
  status_klartext             VARCHAR(255),
  domstol_kod                 VARCHAR(64),
  domstol_klartext            VARCHAR(255),
  mal_nummer                  VARCHAR(64),
  giltigt_fran                DATE,
  giltigt_till                DATE,
  ar_aktuellt                 BOOLEAN      NOT NULL DEFAULT TRUE,
  raw_payload                 JSONB        NOT NULL DEFAULT '{}'::jsonb,
  created_at                  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_bv_bitradesf_person
  ON bolagsverket_bitradesforbud (person_id);

-- =============================================================================
-- End of migration 002
-- =============================================================================
`);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Intentionally left blank – schema rollback is not supported.
  }
}

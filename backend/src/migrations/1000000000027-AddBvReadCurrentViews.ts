import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBvReadCurrentViews1000000000027 implements MigrationInterface {
  name = 'AddBvReadCurrentViews1000000000027';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
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
      JOIN bv_parsed.fi_funktionarer fun
        ON fun.fi_organisation_snapshot_id = f.id
      LEFT JOIN bv_parsed.fi_funktionar_roller r
        ON r.fi_funktionar_id = fun.id;

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
      JOIN bv_parsed.fi_finansiella_rapport_arenden a
        ON a.fi_organisation_snapshot_id = f.id
      JOIN bv_parsed.fi_finansiella_rapporter r
        ON r.fi_finansiell_rapport_arende_id = a.id;

      CREATE OR REPLACE VIEW bv_read.company_hvd_documents_current AS
      SELECT
          d.tenant_id,
          d.organisationsnummer,
          d.dokument_id,
          d.filformat,
          d.registreringstidpunkt,
          d.rapporteringsperiod_tom
      FROM bv_parsed.v_hvd_dokument_latest d;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP VIEW IF EXISTS bv_read.company_hvd_documents_current;
      DROP VIEW IF EXISTS bv_read.company_fi_reports_current;
      DROP VIEW IF EXISTS bv_read.company_officers_current;
      DROP VIEW IF EXISTS bv_read.company_overview_current;
      DROP SCHEMA IF EXISTS bv_read;
    `);
  }
}

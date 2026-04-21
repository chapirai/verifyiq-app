import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

export interface CompanyOverviewServingRow {
  tenantId: string;
  organisationsnummer: string;
  organisationsnamn: string | null;
  organisationsformKlartext: string | null;
  organisationsdatumRegistreringsdatum: string | null;
  organisationsdatumBildatDatum: string | null;
  verksamhetsbeskrivning: string | null;
  hemvistKommunKlartext: string | null;
  hemvistLanKlartext: string | null;
  rakenskapsarInleds: string | null;
  rakenskapsarAvslutas: string | null;
  aktiekapitalBelopp: string | null;
  aktiekapitalValuta: string | null;
  antalAktier: string | null;
  verksamOrganisationKod: string | null;
  registreringslandKlartext: string | null;
  organisationsadressPostadress: string | null;
  organisationsadressPostnummer: string | null;
  organisationsadressPostort: string | null;
  organisationsadressEpost: string | null;
  firmateckningKlartext: string | null;
  antalValdaLedamoter: number | null;
  antalValdaSuppleanter: number | null;
  identitetTypKlartext: string | null;
  dataRefreshedAt: string | null;
}

export interface CompanyOfficerServingRow {
  tenantId: string;
  organisationsnummer: string;
  funktionarId: string;
  fiFunktionarRollId: string;
  fornamn: string | null;
  efternamn: string | null;
  identitetsbeteckning: string | null;
  postadressAdress: string | null;
  postadressPostnummer: string | null;
  postadressPostort: string | null;
  rollKod: string | null;
  rollKlartext: string | null;
  dataRefreshedAt: string | null;
}

export interface CompanyFiReportServingRow {
  tenantId: string;
  organisationsnummer: string;
  reportId: string;
  rapporttypKod: string | null;
  rapporttypKlartext: string | null;
  periodFrom: string | null;
  periodTom: string | null;
  ankomDatum: string | null;
  registreradDatum: string | null;
  innehallerKoncernredovisning: boolean | null;
  vinstutdelningBelopp: string | null;
  vinstutdelningValutaKod: string | null;
  vinstutdelningBeslutadDatum: string | null;
  dataRefreshedAt: string | null;
}

export interface CompanyHvdDocumentServingRow {
  tenantId: string;
  organisationsnummer: string;
  dokumentId: string;
  filformat: string | null;
  registreringstidpunkt: string | null;
  rapporteringsperiodTom: string | null;
  dataRefreshedAt: string | null;
}

export interface CompanyFiCaseServingRow {
  tenantId: string;
  organisationsnummer: string;
  arendeRank: number;
  arendenummer: string | null;
  avslutatTidpunkt: string | null;
  arendetyp: string | null;
  status: string | null;
  dataRefreshedAt: string | null;
}

export interface CompanyShareCapitalServingRow {
  tenantId: string;
  organisationsnummer: string;
  aktiekapitalBelopp: string | null;
  aktiekapitalValuta: string | null;
  antalAktier: string | null;
  kvotvardeBelopp: string | null;
  kvotvardeValuta: string | null;
  aktiekapitalGransLagst: string | null;
  aktiekapitalGransHogst: string | null;
  antalAktierGransLagst: string | null;
  antalAktierGransHogst: string | null;
  aktiegranserValuta: string | null;
  dataRefreshedAt: string | null;
}

export interface CompanyEngagementServingRow {
  tenantId: string;
  organisationsnummer: string;
  engagementRank: number;
  relatedOrganisationName: string | null;
  relatedOrganisationNumber: string | null;
  engagementTypeKod: string | null;
  engagementTypeKlartext: string | null;
  roleKod: string | null;
  roleKlartext: string | null;
  personOrOrganisationName: string | null;
  dataRefreshedAt: string | null;
}

export interface CompanyVerkligaHuvudmanServingRow {
  tenantId: string;
  organisationsnummer: string;
  fetchedAt: string | null;
  requestId: string | null;
  /** Full Bolagsverket Verkliga huvudmän register JSON (latest stored snapshot). */
  payload: Record<string, unknown>;
}

export interface CompanyServingBundleRow {
  overview: CompanyOverviewServingRow | null;
  officers: CompanyOfficerServingRow[];
  reports: CompanyFiReportServingRow[];
  documents: CompanyHvdDocumentServingRow[];
  cases: CompanyFiCaseServingRow[];
  shareCapital: CompanyShareCapitalServingRow | null;
  engagements: CompanyEngagementServingRow[];
  verkligaHuvudman: CompanyVerkligaHuvudmanServingRow | null;
}

@Injectable()
export class CompanyServingReadService {
  constructor(private readonly dataSource: DataSource) {}

  async getBundle(tenantId: string, org: string): Promise<CompanyServingBundleRow> {
    const [overview, officers, reports, documents, cases, shareCapital, engagements, verkligaHuvudman] =
      await Promise.all([
        this.getOverview(tenantId, org),
        this.getOfficers(tenantId, org),
        this.getFiReports(tenantId, org),
        this.getHvdDocuments(tenantId, org),
        this.getFiCases(tenantId, org),
        this.getShareCapital(tenantId, org),
        this.getEngagements(tenantId, org),
        this.getVerkligaHuvudmanLatest(tenantId, org),
      ]);
    return { overview, officers, reports, documents, cases, shareCapital, engagements, verkligaHuvudman };
  }

  async getVerkligaHuvudmanLatest(
    tenantId: string,
    org: string,
  ): Promise<CompanyVerkligaHuvudmanServingRow | null> {
    const rows = await this.dataSource.query(
      `SELECT tenant_id::text, organisationsnummer, fetched_at::text, request_id, payload
       FROM bv_vh_payloads
       WHERE tenant_id = $1::uuid AND organisationsnummer = $2
       ORDER BY fetched_at DESC NULLS LAST, created_at DESC
       LIMIT 1`,
      [tenantId, org],
    );
    const r = rows[0] as Record<string, unknown> | undefined;
    if (!r?.payload) return null;
    return this.mapVerkligaHuvudman(r);
  }

  async getOverview(tenantId: string, org: string): Promise<CompanyOverviewServingRow | null> {
    const rows = await this.dataSource.query(
      `SELECT * FROM bv_read.company_overview_current
       WHERE tenant_id = $1::uuid AND organisationsnummer = $2`,
      [tenantId, org],
    );
    const r = rows[0];
    if (!r) return null;
    return this.mapOverview(r);
  }

  async getOfficers(tenantId: string, org: string): Promise<CompanyOfficerServingRow[]> {
    const rows = await this.dataSource.query(
      `SELECT * FROM bv_read.company_officers_current
       WHERE tenant_id = $1::uuid AND organisationsnummer = $2
       ORDER BY funktionar_id, fi_funktionar_roll_id`,
      [tenantId, org],
    );
    return rows.map((r: Record<string, unknown>) => this.mapOfficer(r));
  }

  async getFiReports(tenantId: string, org: string): Promise<CompanyFiReportServingRow[]> {
    const rows = await this.dataSource.query(
      `SELECT * FROM bv_read.company_fi_reports_current
       WHERE tenant_id = $1::uuid AND organisationsnummer = $2
       ORDER BY period_tom DESC NULLS LAST, report_id`,
      [tenantId, org],
    );
    return rows.map((r: Record<string, unknown>) => this.mapReport(r));
  }

  async getHvdDocuments(tenantId: string, org: string): Promise<CompanyHvdDocumentServingRow[]> {
    const rows = await this.dataSource.query(
      `SELECT * FROM bv_read.company_hvd_documents_current
       WHERE tenant_id = $1::uuid AND organisationsnummer = $2
       ORDER BY rapporteringsperiod_tom DESC NULLS LAST, dokument_id`,
      [tenantId, org],
    );
    return rows.map((r: Record<string, unknown>) => this.mapDoc(r));
  }

  async getFiCases(tenantId: string, org: string): Promise<CompanyFiCaseServingRow[]> {
    const rows = await this.dataSource.query(
      `SELECT * FROM bv_read.company_fi_cases_current
       WHERE tenant_id = $1::uuid AND organisationsnummer = $2
       ORDER BY arende_rank`,
      [tenantId, org],
    );
    return rows.map((r: Record<string, unknown>) => this.mapCase(r));
  }

  async getShareCapital(tenantId: string, org: string): Promise<CompanyShareCapitalServingRow | null> {
    const rows = await this.dataSource.query(
      `SELECT * FROM bv_read.company_share_capital_current
       WHERE tenant_id = $1::uuid AND organisationsnummer = $2`,
      [tenantId, org],
    );
    const r = rows[0];
    if (!r) return null;
    return this.mapShareCapital(r);
  }

  async getEngagements(tenantId: string, org: string): Promise<CompanyEngagementServingRow[]> {
    const rows = await this.dataSource.query(
      `SELECT * FROM bv_read.company_engagements_current
       WHERE tenant_id = $1::uuid AND organisationsnummer = $2
       ORDER BY engagement_rank`,
      [tenantId, org],
    );
    return rows.map((r: Record<string, unknown>) => this.mapEngagement(r));
  }

  private mapOverview(r: Record<string, unknown>): CompanyOverviewServingRow {
    return {
      tenantId: String(r.tenant_id),
      organisationsnummer: String(r.organisationsnummer),
      organisationsnamn: r.organisationsnamn != null ? String(r.organisationsnamn) : null,
      organisationsformKlartext: r.organisationsform_klartext != null ? String(r.organisationsform_klartext) : null,
      organisationsdatumRegistreringsdatum: r.organisationsdatum_registreringsdatum != null ? String(r.organisationsdatum_registreringsdatum) : null,
      organisationsdatumBildatDatum: r.organisationsdatum_bildat_datum != null ? String(r.organisationsdatum_bildat_datum) : null,
      verksamhetsbeskrivning: r.verksamhetsbeskrivning != null ? String(r.verksamhetsbeskrivning) : null,
      hemvistKommunKlartext: r.hemvist_kommun_klartext != null ? String(r.hemvist_kommun_klartext) : null,
      hemvistLanKlartext: r.hemvist_lan_klartext != null ? String(r.hemvist_lan_klartext) : null,
      rakenskapsarInleds: r.rakenskapsar_inleds != null ? String(r.rakenskapsar_inleds) : null,
      rakenskapsarAvslutas: r.rakenskapsar_avslutas != null ? String(r.rakenskapsar_avslutas) : null,
      aktiekapitalBelopp: r.aktiekapital_belopp != null ? String(r.aktiekapital_belopp) : null,
      aktiekapitalValuta: r.aktiekapital_valuta != null ? String(r.aktiekapital_valuta) : null,
      antalAktier: r.antal_aktier != null ? String(r.antal_aktier) : null,
      verksamOrganisationKod: r.verksam_organisation_kod != null ? String(r.verksam_organisation_kod) : null,
      registreringslandKlartext: r.registreringsland_klartext != null ? String(r.registreringsland_klartext) : null,
      organisationsadressPostadress: r.organisationsadress_postadress != null ? String(r.organisationsadress_postadress) : null,
      organisationsadressPostnummer: r.organisationsadress_postnummer != null ? String(r.organisationsadress_postnummer) : null,
      organisationsadressPostort: r.organisationsadress_postort != null ? String(r.organisationsadress_postort) : null,
      organisationsadressEpost: r.organisationsadress_epost != null ? String(r.organisationsadress_epost) : null,
      firmateckningKlartext: r.firmateckning_klartext != null ? String(r.firmateckning_klartext) : null,
      antalValdaLedamoter: r.antal_valda_ledamoter != null ? Number(r.antal_valda_ledamoter) : null,
      antalValdaSuppleanter: r.antal_valda_suppleanter != null ? Number(r.antal_valda_suppleanter) : null,
      identitetTypKlartext: r.identitet_typ_klartext != null ? String(r.identitet_typ_klartext) : null,
      dataRefreshedAt: r.data_refreshed_at != null ? String(r.data_refreshed_at) : null,
    };
  }

  private mapOfficer(r: Record<string, unknown>): CompanyOfficerServingRow {
    return {
      tenantId: String(r.tenant_id),
      organisationsnummer: String(r.organisationsnummer),
      funktionarId: String(r.funktionar_id),
      fiFunktionarRollId: String(r.fi_funktionar_roll_id),
      fornamn: r.fornamn != null ? String(r.fornamn) : null,
      efternamn: r.efternamn != null ? String(r.efternamn) : null,
      identitetsbeteckning: r.identitetsbeteckning != null ? String(r.identitetsbeteckning) : null,
      postadressAdress: r.postadress_adress != null ? String(r.postadress_adress) : null,
      postadressPostnummer: r.postadress_postnummer != null ? String(r.postadress_postnummer) : null,
      postadressPostort: r.postadress_postort != null ? String(r.postadress_postort) : null,
      rollKod: r.roll_kod != null ? String(r.roll_kod) : null,
      rollKlartext: r.roll_klartext != null ? String(r.roll_klartext) : null,
      dataRefreshedAt: r.data_refreshed_at != null ? String(r.data_refreshed_at) : null,
    };
  }

  private mapReport(r: Record<string, unknown>): CompanyFiReportServingRow {
    return {
      tenantId: String(r.tenant_id),
      organisationsnummer: String(r.organisationsnummer),
      reportId: String(r.report_id),
      rapporttypKod: r.rapporttyp_kod != null ? String(r.rapporttyp_kod) : null,
      rapporttypKlartext: r.rapporttyp_klartext != null ? String(r.rapporttyp_klartext) : null,
      periodFrom: r.period_from != null ? String(r.period_from) : null,
      periodTom: r.period_tom != null ? String(r.period_tom) : null,
      ankomDatum: r.ankom_datum != null ? String(r.ankom_datum) : null,
      registreradDatum: r.registrerad_datum != null ? String(r.registrerad_datum) : null,
      innehallerKoncernredovisning: r.innehaller_koncernredovisning != null ? Boolean(r.innehaller_koncernredovisning) : null,
      vinstutdelningBelopp: r.vinstutdelning_belopp != null ? String(r.vinstutdelning_belopp) : null,
      vinstutdelningValutaKod: r.vinstutdelning_valuta_kod != null ? String(r.vinstutdelning_valuta_kod) : null,
      vinstutdelningBeslutadDatum: r.vinstutdelning_beslutad_datum != null ? String(r.vinstutdelning_beslutad_datum) : null,
      dataRefreshedAt: r.data_refreshed_at != null ? String(r.data_refreshed_at) : null,
    };
  }

  private mapDoc(r: Record<string, unknown>): CompanyHvdDocumentServingRow {
    return {
      tenantId: String(r.tenant_id),
      organisationsnummer: String(r.organisationsnummer),
      dokumentId: String(r.dokument_id),
      filformat: r.filformat != null ? String(r.filformat) : null,
      registreringstidpunkt: r.registreringstidpunkt != null ? String(r.registreringstidpunkt) : null,
      rapporteringsperiodTom: r.rapporteringsperiod_tom != null ? String(r.rapporteringsperiod_tom) : null,
      dataRefreshedAt: r.data_refreshed_at != null ? String(r.data_refreshed_at) : null,
    };
  }

  private mapCase(r: Record<string, unknown>): CompanyFiCaseServingRow {
    return {
      tenantId: String(r.tenant_id),
      organisationsnummer: String(r.organisationsnummer),
      arendeRank: Number(r.arende_rank),
      arendenummer: r.arendenummer != null ? String(r.arendenummer) : null,
      avslutatTidpunkt: r.avslutat_tidpunkt != null ? String(r.avslutat_tidpunkt) : null,
      arendetyp: r.arendetyp != null ? String(r.arendetyp) : null,
      status: r.status != null ? String(r.status) : null,
      dataRefreshedAt: r.data_refreshed_at != null ? String(r.data_refreshed_at) : null,
    };
  }

  private mapShareCapital(r: Record<string, unknown>): CompanyShareCapitalServingRow {
    return {
      tenantId: String(r.tenant_id),
      organisationsnummer: String(r.organisationsnummer),
      aktiekapitalBelopp: r.aktiekapital_belopp != null ? String(r.aktiekapital_belopp) : null,
      aktiekapitalValuta: r.aktiekapital_valuta != null ? String(r.aktiekapital_valuta) : null,
      antalAktier: r.antal_aktier != null ? String(r.antal_aktier) : null,
      kvotvardeBelopp: r.kvotvarde_belopp != null ? String(r.kvotvarde_belopp) : null,
      kvotvardeValuta: r.kvotvarde_valuta != null ? String(r.kvotvarde_valuta) : null,
      aktiekapitalGransLagst: r.aktiekapital_grans_lagst != null ? String(r.aktiekapital_grans_lagst) : null,
      aktiekapitalGransHogst: r.aktiekapital_grans_hogst != null ? String(r.aktiekapital_grans_hogst) : null,
      antalAktierGransLagst: r.antal_aktier_grans_lagst != null ? String(r.antal_aktier_grans_lagst) : null,
      antalAktierGransHogst: r.antal_aktier_grans_hogst != null ? String(r.antal_aktier_grans_hogst) : null,
      aktiegranserValuta: r.aktiegranser_valuta != null ? String(r.aktiegranser_valuta) : null,
      dataRefreshedAt: r.data_refreshed_at != null ? String(r.data_refreshed_at) : null,
    };
  }

  private mapEngagement(r: Record<string, unknown>): CompanyEngagementServingRow {
    return {
      tenantId: String(r.tenant_id),
      organisationsnummer: String(r.organisationsnummer),
      engagementRank: Number(r.engagement_rank),
      relatedOrganisationName: r.related_organisation_name != null ? String(r.related_organisation_name) : null,
      relatedOrganisationNumber: r.related_organisation_number != null ? String(r.related_organisation_number) : null,
      engagementTypeKod: r.engagement_type_kod != null ? String(r.engagement_type_kod) : null,
      engagementTypeKlartext: r.engagement_type_klartext != null ? String(r.engagement_type_klartext) : null,
      roleKod: r.role_kod != null ? String(r.role_kod) : null,
      roleKlartext: r.role_klartext != null ? String(r.role_klartext) : null,
      personOrOrganisationName: r.person_or_organisation_name != null ? String(r.person_or_organisation_name) : null,
      dataRefreshedAt: r.data_refreshed_at != null ? String(r.data_refreshed_at) : null,
    };
  }

  private mapVerkligaHuvudman(r: Record<string, unknown>): CompanyVerkligaHuvudmanServingRow {
    const payload = r.payload;
    return {
      tenantId: String(r.tenant_id),
      organisationsnummer: String(r.organisationsnummer),
      fetchedAt: r.fetched_at != null ? String(r.fetched_at) : null,
      requestId: r.request_id != null ? String(r.request_id) : null,
      payload: payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {},
    };
  }
}

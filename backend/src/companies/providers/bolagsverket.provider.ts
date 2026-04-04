import { Injectable } from '@nestjs/common';
import {
  AktiekapitalforandringResponse,
  ArendeResponse,
  DocumentListResponse,
  FinansiellaRapporterResponse,
  FirmateckningsalternativResponse,
  HighValueDatasetResponse,
  OrganisationInformationResponse,
  OrganisationsengagemangResponse,
  PersonResponse,
} from '../integrations/bolagsverket.types';
import { BolagsverketService } from '../services/bolagsverket.service';
import { DataProvider, ProviderRequestContext } from './data-provider.interface';

/** Cast a ProviderRequestContext to the service's internal BvRequestContext shape. */
function toCtx(ctx?: ProviderRequestContext) {
  if (!ctx?.tenantId) return undefined;
  return {
    tenantId: ctx.tenantId,
    actorId: ctx.actorId ?? null,
    correlationId: ctx.correlationId ?? null,
  };
}

/**
 * Bolagsverket implementation of the DataProvider interface.
 *
 * This thin adapter delegates every method to BolagsverketService, hiding
 * provider-specific details (auth, retry, rate-limiting) from callers.
 * Future providers (UC, Creditsafe, Bisnode) must implement DataProvider
 * and can be swapped in without touching the service layer.
 */
@Injectable()
export class BolagsverketProvider implements DataProvider {
  constructor(private readonly bvService: BolagsverketService) {}

  async fetchOrganisation(
    identitetsbeteckning: string,
    context?: ProviderRequestContext,
  ): Promise<OrganisationInformationResponse[]> {
    return this.bvService.getCompanyInformation(identitetsbeteckning, undefined, undefined, toCtx(context));
  }

  async fetchHighValueOrganisation(
    identitetsbeteckning: string,
    context?: ProviderRequestContext,
  ): Promise<HighValueDatasetResponse> {
    return this.bvService.getHighValueCompanyInformation(identitetsbeteckning, toCtx(context));
  }

  async fetchPerson(
    identitetsbeteckning: string,
    context?: ProviderRequestContext,
  ): Promise<PersonResponse> {
    return this.bvService.getPersonInformation(identitetsbeteckning, toCtx(context));
  }

  async fetchCases(
    organisationIdentitetsbeteckning: string,
    fromdatum?: string,
    tomdatum?: string,
    context?: ProviderRequestContext,
  ): Promise<ArendeResponse> {
    return this.bvService.getCases(
      undefined,
      organisationIdentitetsbeteckning,
      fromdatum,
      tomdatum,
      toCtx(context),
    );
  }

  async fetchSignatoryOptions(
    funktionarIdentitetsbeteckning: string,
    organisationIdentitetsbeteckning: string,
    context?: ProviderRequestContext,
  ): Promise<FirmateckningsalternativResponse> {
    return this.bvService.getSignatoryOptions(
      funktionarIdentitetsbeteckning,
      organisationIdentitetsbeteckning,
      toCtx(context),
    );
  }

  async fetchShareCapitalChanges(
    identitetsbeteckning: string,
    fromdatum?: string,
    tomdatum?: string,
    context?: ProviderRequestContext,
  ): Promise<AktiekapitalforandringResponse> {
    return this.bvService.getShareCapitalChanges(identitetsbeteckning, fromdatum, tomdatum, toCtx(context));
  }

  async fetchOrganisationEngagements(
    identitetsbeteckning: string,
    pageNumber = 1,
    pageSize = 20,
    context?: ProviderRequestContext,
  ): Promise<OrganisationsengagemangResponse> {
    return this.bvService.getOrganisationEngagements(
      identitetsbeteckning,
      pageNumber,
      pageSize,
      toCtx(context),
    );
  }

  async fetchFinancialReports(
    identitetsbeteckning: string,
    fromdatum?: string,
    tomdatum?: string,
    context?: ProviderRequestContext,
  ): Promise<FinansiellaRapporterResponse> {
    return this.bvService.getFinancialReports(identitetsbeteckning, fromdatum, tomdatum, toCtx(context));
  }

  async fetchDocumentList(
    identitetsbeteckning: string,
    context?: ProviderRequestContext,
  ): Promise<DocumentListResponse> {
    return this.bvService.getDocumentList(identitetsbeteckning, toCtx(context));
  }

  async isAlive(): Promise<{ status: string }> {
    return this.bvService.isAlive();
  }
}

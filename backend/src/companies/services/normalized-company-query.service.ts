import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { NormalizedCompanyEntity } from '../entities/normalized-company.entity';
import { CompanyVersionEntity } from '../entities/company-version.entity';

/**
 * Serving-layer response shape for a single normalized company.
 *
 * Raw payload content is intentionally excluded; consumers receive only the
 * curated business attributes and freshness metadata.
 */
export interface NormalizedCompanyProfile {
  id: string;
  tenantId: string;
  orgNumber: string;
  legalName: string;
  companyForm: string | null;
  status: string | null;
  countryCode: string;
  registeredAt: Date | null;
  address: Record<string, unknown>;
  businessDescription: string | null;
  signatoryText: string | null;
  officers: Array<Record<string, unknown>>;
  shareInformation: Record<string, unknown>;
  financialReports: Array<Record<string, unknown>>;
  version: number;
  schemaVersion: string;
  freshnessStatus: string;
  lastNormalizedAt: Date | null;
  lastSnapshotId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Options for the listByTenant query. */
export interface ListNormalizedCompaniesOptions {
  /** Maximum number of results to return (default: 50). */
  limit?: number;
  /** Offset for pagination (default: 0). */
  offset?: number;
  /** Only return companies with the given freshness status. */
  freshnessStatus?: string;
}

@Injectable()
export class NormalizedCompanyQueryService {
  constructor(
    @InjectRepository(NormalizedCompanyEntity)
    private readonly normalizedRepo: Repository<NormalizedCompanyEntity>,
    @InjectRepository(CompanyVersionEntity)
    private readonly versionRepo: Repository<CompanyVersionEntity>,
  ) {}

  // ── Single-record lookups ──────────────────────────────────────────────────

  /**
   * Retrieve a company's normalized profile by org number, scoped to the tenant.
   *
   * Returns null when no normalized record exists for the given (tenantId, orgNumber).
   * Never returns raw payload content.
   */
  async getByOrgNumber(
    tenantId: string,
    orgNumber: string,
  ): Promise<NormalizedCompanyProfile | null> {
    const entity = await this.normalizedRepo.findOne({ where: { tenantId, orgNumber } });
    return entity ? this.toProfile(entity) : null;
  }

  // ── Tenant-scoped list queries ─────────────────────────────────────────────

  /**
   * List all normalized companies for a tenant, ordered most-recently updated first.
   *
   * Supports optional freshness filtering and pagination.
   */
  async listByTenant(
    tenantId: string,
    options: ListNormalizedCompaniesOptions = {},
  ): Promise<NormalizedCompanyProfile[]> {
    const { limit = 50, offset = 0, freshnessStatus } = options;

    const where: Record<string, unknown> = { tenantId };
    if (freshnessStatus) {
      where['freshnessStatus'] = freshnessStatus;
    }

    const entities = await this.normalizedRepo.find({
      where,
      order: { updatedAt: 'DESC' },
      take: limit,
      skip: offset,
    });
    return entities.map((e) => this.toProfile(e));
  }

  /**
   * List the most recently updated normalized companies for a tenant.
   */
  async listRecent(tenantId: string, limit = 20): Promise<NormalizedCompanyProfile[]> {
    const entities = await this.normalizedRepo.find({
      where: { tenantId },
      order: { updatedAt: 'DESC' },
      take: limit,
    });
    return entities.map((e) => this.toProfile(e));
  }

  /**
   * Search for companies by legal name within a tenant (case-insensitive substring).
   */
  async searchByName(
    tenantId: string,
    nameQuery: string,
    limit = 20,
  ): Promise<NormalizedCompanyProfile[]> {
    const entities = await this.normalizedRepo.find({
      where: { tenantId, legalName: ILike(`%${nameQuery}%`) },
      order: { legalName: 'ASC' },
      take: limit,
    });
    return entities.map((e) => this.toProfile(e));
  }

  // ── Version history ────────────────────────────────────────────────────────

  /**
   * Retrieve the attribute version history for a specific company.
   * Returns version records in descending order (most recent first).
   */
  async getVersionHistory(
    tenantId: string,
    orgNumber: string,
    limit = 20,
  ): Promise<CompanyVersionEntity[]> {
    return this.versionRepo.find({
      where: { tenantId, orgNumber },
      order: { version: 'DESC' },
      take: limit,
    });
  }

  /**
   * Retrieve a specific version record by version number.
   * Returns null when not found or when the version belongs to a different tenant.
   */
  async getVersionByNumber(
    tenantId: string,
    orgNumber: string,
    version: number,
  ): Promise<CompanyVersionEntity | null> {
    return this.versionRepo.findOne({ where: { tenantId, orgNumber, version } });
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  /**
   * Map an entity to the serving-layer profile shape.
   * Explicitly excludes lastRawPayloadId and any raw payload internals.
   */
  private toProfile(entity: NormalizedCompanyEntity): NormalizedCompanyProfile {
    return {
      id: entity.id,
      tenantId: entity.tenantId,
      orgNumber: entity.orgNumber,
      legalName: entity.legalName,
      companyForm: entity.companyForm ?? null,
      status: entity.status ?? null,
      countryCode: entity.countryCode,
      registeredAt: entity.registeredAt ?? null,
      address: entity.address,
      businessDescription: entity.businessDescription ?? null,
      signatoryText: entity.signatoryText ?? null,
      officers: entity.officers,
      shareInformation: entity.shareInformation,
      financialReports: entity.financialReports,
      version: entity.version,
      schemaVersion: entity.schemaVersion,
      freshnessStatus: entity.freshnessStatus,
      lastNormalizedAt: entity.lastNormalizedAt ?? null,
      lastSnapshotId: entity.lastSnapshotId ?? null,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }
}

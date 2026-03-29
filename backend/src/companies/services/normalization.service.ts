import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditService } from '../../audit/audit.service';
import { CompanyNormalizer } from '../mappers/company-normalizer';
import {
  NormalizedCompanyEntity,
  NormalizedCompanyFreshnessStatus,
} from '../entities/normalized-company.entity';
import { CompanyVersionEntity } from '../entities/company-version.entity';

/** The set of business attribute field names tracked for change detection. */
const TRACKED_FIELDS = [
  'legalName',
  'companyForm',
  'status',
  'countryCode',
  'registeredAt',
  'address',
  'businessDescription',
  'signatoryText',
  'officers',
  'shareInformation',
  'financialReports',
] as const;

type TrackedField = (typeof TRACKED_FIELDS)[number];

/** Input to the main upsert method. */
export interface UpsertNormalizedCompanyInput {
  /** Tenant scope — mandatory, enforces isolation at the query layer. */
  tenantId: string;
  /** Canonical organisation number. */
  orgNumber: string;
  /**
   * Raw provider payload content to normalise.
   * Shape: { highValueDataset?, organisationInformation? }
   */
  rawPayloadContent: Record<string, unknown>;
  /** ID of the snapshot that produced this raw payload. */
  snapshotId?: string | null;
  /** ID of the stored raw payload record (for lineage). */
  rawPayloadId?: string | null;
  /** Freshness status to assign after successful normalization. Defaults to 'fresh'. */
  freshnessStatus?: NormalizedCompanyFreshnessStatus;
  /** Correlation ID for lineage and audit tracing. */
  correlationId?: string | null;
  /** Actor (user/service) that triggered normalization. */
  actorId?: string | null;
}

/** Result returned from upsertNormalizedCompany. */
export interface UpsertNormalizedCompanyResult {
  normalizedCompany: NormalizedCompanyEntity;
  /**
   * The version history record created in this call.
   * Null when an existing record was refreshed with no attribute changes
   * (freshness metadata is updated but no version bump occurs).
   */
  version: CompanyVersionEntity | null;
  /** True when the record was newly created (version 1). */
  isNew: boolean;
  /** True when existing attributes changed (version > 1 and diff detected). */
  isUpdated: boolean;
  /** Fields that changed compared to the previous version. Empty for new records. */
  changedFields: string[];
}

/** Input for the stale-fallback path when normalization fails. */
export interface MarkNormalizedCompanyStaleFallbackInput {
  tenantId: string;
  orgNumber: string;
  reason: string;
  snapshotId?: string | null;
  actorId?: string | null;
}

@Injectable()
export class NormalizationService {
  private readonly logger = new Logger(NormalizationService.name);

  constructor(
    @InjectRepository(NormalizedCompanyEntity)
    private readonly normalizedRepo: Repository<NormalizedCompanyEntity>,
    @InjectRepository(CompanyVersionEntity)
    private readonly versionRepo: Repository<CompanyVersionEntity>,
    private readonly normalizer: CompanyNormalizer,
    private readonly auditService: AuditService,
  ) {}

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Extract, validate, and persist normalized company data from a raw payload.
   *
   * Behaviour:
   *  1. Normalizes the raw payload using CompanyNormalizer.
   *  2. Upserts the NormalizedCompanyEntity (create or update).
   *  3. Detects which fields changed and increments the version counter.
   *  4. Creates a CompanyVersionEntity row only when attributes change or on
   *     initial creation.
   *  5. Emits audit events for create/update/refresh.
   *
   * Throws on unrecoverable errors; callers should catch and invoke
   * `markStaleFallback` to preserve the previous version and surface the
   * degraded state.
   */
  async upsertNormalizedCompany(
    input: UpsertNormalizedCompanyInput,
  ): Promise<UpsertNormalizedCompanyResult> {
    const {
      tenantId,
      orgNumber,
      rawPayloadContent,
      snapshotId = null,
      rawPayloadId = null,
      freshnessStatus = 'fresh',
      correlationId = null,
      actorId = null,
    } = input;

    // 1. Extract normalized attributes from raw payload
    const normalized = this.normalizer.normalize(
      rawPayloadContent['highValueDataset'] as Record<string, unknown> | undefined,
      rawPayloadContent['organisationInformation'] as Record<string, unknown> | undefined,
    );

    // 2. Validate — throw on missing canonical identifier
    if (!normalized.organisationNumber && !orgNumber) {
      throw new Error(
        `Normalization produced no organisationNumber for org ${orgNumber} (tenant ${tenantId})`,
      );
    }
    const canonicalOrgNumber = orgNumber || normalized.organisationNumber;

    // 3. Build attribute map from normalizer output
    const attrs = this.buildAttributes(normalized);

    // 4. Load existing record (if any)
    const existing = await this.normalizedRepo.findOne({
      where: { tenantId, orgNumber: canonicalOrgNumber },
    });

    const now = new Date();

    if (existing) {
      // 5a. Detect changed fields
      const changedFields = this.detectChanges(existing, attrs);
      const hasChanges = changedFields.length > 0;

      if (hasChanges) {
        // Update entity attributes and increment version
        Object.assign(existing, attrs);
        existing.version += 1;
      }

      // Always refresh freshness metadata
      existing.freshnessStatus = freshnessStatus;
      existing.lastNormalizedAt = now;
      existing.lastSnapshotId = snapshotId;
      existing.lastRawPayloadId = rawPayloadId;

      const saved = await this.normalizedRepo.save(existing);

      // 5b. Record version history only when business attributes changed.
      // Freshness-only refreshes do not produce a new version row because no
      // queryable attribute state has changed.
      let versionEntity: CompanyVersionEntity | null = null;
      if (hasChanges) {
        versionEntity = await this.versionRepo.save(
          this.versionRepo.create({
            tenantId,
            orgNumber: canonicalOrgNumber,
            normalizedCompanyId: saved.id,
            version: saved.version,
            attributes: this.buildVersionSnapshot(saved),
            changedFields,
            schemaVersion: saved.schemaVersion,
            snapshotId,
            rawPayloadId,
          }),
        );
      }

      const action = hasChanges ? 'normalized_company.updated' : 'normalized_company.refreshed';

      this.logger.log(
        `${action} for ${canonicalOrgNumber} (tenant ${tenantId}) version=${saved.version} changedFields=${changedFields.join(',') || 'none'}`,
      );

      await this.auditService.log({
        tenantId,
        actorId,
        action,
        resourceType: 'normalized_company',
        resourceId: saved.id,
        metadata: {
          orgNumber: canonicalOrgNumber,
          version: saved.version,
          changedFields,
          snapshotId,
          rawPayloadId,
          correlationId,
          freshnessStatus,
        },
      });

      return {
        normalizedCompany: saved,
        version: versionEntity,
        isNew: false,
        isUpdated: hasChanges,
        changedFields,
      };
    }

    // 6. Create new record (version 1)
    const entity = this.normalizedRepo.create({
      tenantId,
      orgNumber: canonicalOrgNumber,
      ...attrs,
      version: 1,
      schemaVersion: '1',
      freshnessStatus,
      lastNormalizedAt: now,
      lastSnapshotId: snapshotId,
      lastRawPayloadId: rawPayloadId,
    });

    const saved = await this.normalizedRepo.save(entity);

    const versionEntity = await this.versionRepo.save(
      this.versionRepo.create({
        tenantId,
        orgNumber: canonicalOrgNumber,
        normalizedCompanyId: saved.id,
        version: 1,
        attributes: this.buildVersionSnapshot(saved),
        changedFields: [],
        schemaVersion: '1',
        snapshotId,
        rawPayloadId,
      }),
    );

    this.logger.log(
      `normalized_company.created for ${canonicalOrgNumber} (tenant ${tenantId}) id=${saved.id}`,
    );

    await this.auditService.log({
      tenantId,
      actorId,
      action: 'normalized_company.created',
      resourceType: 'normalized_company',
      resourceId: saved.id,
      metadata: {
        orgNumber: canonicalOrgNumber,
        version: 1,
        snapshotId,
        rawPayloadId,
        correlationId,
        freshnessStatus,
      },
    });

    return {
      normalizedCompany: saved,
      version: versionEntity,
      isNew: true,
      isUpdated: false,
      changedFields: [],
    };
  }

  /**
   * Mark a normalized company as 'degraded' when normalization fails.
   *
   * Preserves the previous attribute version intact; only updates the
   * freshness metadata to reflect the failure.  Emits a stale-fallback
   * audit event so the failure is traceable.
   *
   * If no record exists for the given (tenantId, orgNumber) this is a no-op
   * (there is no previous version to preserve).
   */
  async markStaleFallback(
    input: MarkNormalizedCompanyStaleFallbackInput,
  ): Promise<NormalizedCompanyEntity | null> {
    const { tenantId, orgNumber, reason, snapshotId = null, actorId = null } = input;

    const existing = await this.normalizedRepo.findOne({ where: { tenantId, orgNumber } });
    if (!existing) {
      this.logger.warn(
        `markStaleFallback: no existing record for ${orgNumber} (tenant ${tenantId}); skipping`,
      );
      return null;
    }

    existing.freshnessStatus = 'degraded';
    existing.lastSnapshotId = snapshotId ?? existing.lastSnapshotId;
    const saved = await this.normalizedRepo.save(existing);

    this.logger.warn(
      `normalized_company.stale_fallback for ${orgNumber} (tenant ${tenantId}): ${reason}`,
    );

    await this.auditService.log({
      tenantId,
      actorId,
      action: 'normalized_company.stale_fallback',
      resourceType: 'normalized_company',
      resourceId: saved.id,
      metadata: { orgNumber, reason, snapshotId },
    });

    return saved;
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  /**
   * Convert the CompanyNormalizer output into the subset of fields
   * that are persisted on NormalizedCompanyEntity.
   */
  private buildAttributes(normalized: ReturnType<CompanyNormalizer['normalize']>): Pick<
    NormalizedCompanyEntity,
    TrackedField
  > {
    return {
      legalName: normalized.legalName ?? 'Unknown',
      companyForm: normalized.companyForm ?? null,
      status: normalized.status ?? null,
      countryCode: normalized.countryCode ?? 'SE',
      registeredAt: normalized.registeredAt ? new Date(normalized.registeredAt as string) : null,
      // TODO: extract structured address from normalizer output when available
      address: {},
      businessDescription: normalized.businessDescription ?? null,
      signatoryText: normalized.signatoryText ?? null,
      officers: Array.isArray(normalized.officers)
        ? (normalized.officers as Array<Record<string, unknown>>)
        : [],
      shareInformation: (normalized.shareInformation as Record<string, unknown>) ?? {},
      financialReports: Array.isArray(normalized.financialReports)
        ? (normalized.financialReports as Array<Record<string, unknown>>)
        : [],
    };
  }

  /**
   * Detect which tracked fields differ between the stored entity and the
   * incoming attribute map.  Returns an array of field names.
   */
  private detectChanges(
    existing: NormalizedCompanyEntity,
    incoming: Pick<NormalizedCompanyEntity, TrackedField>,
  ): string[] {
    const changed: string[] = [];
    for (const field of TRACKED_FIELDS) {
      const existingVal = JSON.stringify(existing[field] ?? null);
      const incomingVal = JSON.stringify(incoming[field] ?? null);
      if (existingVal !== incomingVal) {
        changed.push(field);
      }
    }
    return changed;
  }

  /**
   * Build the attribute snapshot stored in CompanyVersionEntity.
   * Excludes internal metadata fields so the snapshot contains only
   * business attributes.
   */
  private buildVersionSnapshot(entity: NormalizedCompanyEntity): Record<string, unknown> {
    return {
      legalName: entity.legalName,
      companyForm: entity.companyForm,
      status: entity.status,
      countryCode: entity.countryCode,
      registeredAt: entity.registeredAt,
      address: entity.address,
      businessDescription: entity.businessDescription,
      signatoryText: entity.signatoryText,
      officers: entity.officers,
      shareInformation: entity.shareInformation,
      financialReports: entity.financialReports,
    };
  }
}

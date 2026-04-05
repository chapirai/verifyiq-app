import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BvOrganisationEntity } from '../entities/bv-organisation.entity';
import { BvHvdPayloadEntity } from '../entities/bv-hvd-payload.entity';
import { BvForetagsinfoPayloadEntity } from '../entities/bv-foretagsinfo-payload.entity';
import { NormalisedCompany } from '../integrations/bolagsverket.mapper';

@Injectable()
export class BvPersistenceService {
  private readonly logger = new Logger(BvPersistenceService.name);

  constructor(
    @InjectRepository(BvOrganisationEntity)
    private readonly orgRepo: Repository<BvOrganisationEntity>,
    @InjectRepository(BvHvdPayloadEntity)
    private readonly hvdPayloadRepo: Repository<BvHvdPayloadEntity>,
    @InjectRepository(BvForetagsinfoPayloadEntity)
    private readonly foretagsinfoPayloadRepo: Repository<BvForetagsinfoPayloadEntity>,
  ) {}

  async upsertOrganisation(
    tenantId: string,
    normalised: NormalisedCompany,
    rawPayload: Record<string, unknown>,
  ): Promise<BvOrganisationEntity> {
    const existing = await this.orgRepo.findOne({
      where: { tenantId, organisationsnummer: normalised.organisationNumber },
    });

    const entity =
      existing ??
      this.orgRepo.create({
        tenantId,
        organisationsnummer: normalised.organisationNumber,
      });

    entity.namn = normalised.legalName;
    entity.organisationsformKlartext = normalised.companyForm;
    entity.aktuellStatusKlartext = normalised.status;
    entity.senastUppdaterad = new Date();
    entity.rawPayload = rawPayload;

    // Derive a lightweight data quality snapshot from field-level errors.
    // The constant mirrors TRACKED_FIELDS in HvdAggregatorService (7 canonical fields).
    const QUALITY_TRACKED_FIELD_COUNT = 7;
    const fieldErrors = normalised.fieldErrors ?? [];
    const errorSources = [...new Set(fieldErrors.map((e) => e.field))];
    const completenessScore = Math.round(
      ((QUALITY_TRACKED_FIELD_COUNT - Math.min(errorSources.length, QUALITY_TRACKED_FIELD_COUNT)) /
        QUALITY_TRACKED_FIELD_COUNT) *
        100,
    );
    entity.dataQuality = {
      completenessScore,
      missingFields: errorSources,
      errorSources: [...new Set(fieldErrors.map((e) => e.errorType))],
      fieldErrors,
      lastUpdated: new Date().toISOString(),
    };

    const saved = await this.orgRepo.save(entity);
    this.logger.log(
      `Upserted organisation ${normalised.organisationNumber} for tenant ${tenantId}`,
    );
    return saved;
  }

  async findByOrgNr(
    tenantId: string,
    organisationsnummer: string,
  ): Promise<BvOrganisationEntity | null> {
    return this.orgRepo.findOne({ where: { tenantId, organisationsnummer } });
  }

  /**
   * Store the full HVD payload for a fetch snapshot.
   * Returns the created entity so the caller can backfill snapshotId afterward.
   */
  async storeHvdPayload(
    tenantId: string,
    organisationsnummer: string,
    fetchedAt: Date,
    payload: Record<string, unknown>,
    requestId?: string | null,
    snapshotId?: string | null,
  ): Promise<BvHvdPayloadEntity> {
    const entity = this.hvdPayloadRepo.create({
      tenantId,
      organisationsnummer,
      fetchedAt,
      payload,
      requestId: requestId ?? null,
      snapshotId: snapshotId ?? null,
    });
    const saved = await this.hvdPayloadRepo.save(entity);
    this.logger.debug(`Stored HVD payload ${saved.id} for ${organisationsnummer}`);
    return saved;
  }

  /**
   * Store the full Företagsinformation v4 payload for a fetch snapshot.
   * Returns the created entity so the caller can backfill snapshotId afterward.
   */
  async storeForetagsinfoPayload(
    tenantId: string,
    organisationsnummer: string,
    fetchedAt: Date,
    payload: Record<string, unknown>,
    requestId?: string | null,
    snapshotId?: string | null,
  ): Promise<BvForetagsinfoPayloadEntity> {
    const entity = this.foretagsinfoPayloadRepo.create({
      tenantId,
      organisationsnummer,
      fetchedAt,
      payload,
      requestId: requestId ?? null,
      snapshotId: snapshotId ?? null,
    });
    const saved = await this.foretagsinfoPayloadRepo.save(entity);
    this.logger.debug(`Stored Företagsinformation payload ${saved.id} for ${organisationsnummer}`);
    return saved;
  }

  /**
   * Backfill the snapshotId on a previously-created HVD payload record.
   */
  async backfillHvdSnapshotId(hvdPayloadId: string, snapshotId: string): Promise<void> {
    await this.hvdPayloadRepo.update(hvdPayloadId, { snapshotId });
  }

  /**
   * Backfill the snapshotId on a previously-created Företagsinformation payload record.
   */
  async backfillForetagsinfoSnapshotId(foretagsinfoPayloadId: string, snapshotId: string): Promise<void> {
    await this.foretagsinfoPayloadRepo.update(foretagsinfoPayloadId, { snapshotId });
  }
}

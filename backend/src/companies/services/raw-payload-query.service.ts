import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BvRawPayloadEntity } from '../entities/bv-raw-payload.entity';
import { AuditEventType } from '../../audit/audit-event.entity';
import { AuditService } from '../../audit/audit.service';

@Injectable()
export class RawPayloadQueryService {
  constructor(
    @InjectRepository(BvRawPayloadEntity)
    private readonly rawPayloadRepo: Repository<BvRawPayloadEntity>,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Retrieve a single raw payload by its primary key, scoped to the tenant.
   * Emits a retrieval audit event on success.
   *
   * @param tenantId  Tenant scope — prevents cross-tenant access.
   * @param id        UUID of the raw payload record.
   * @param actorId   ID of the user requesting the payload (for audit log).
   */
  async getById(
    tenantId: string,
    id: string,
    actorId?: string | null,
  ): Promise<BvRawPayloadEntity | null> {
    const record = await this.rawPayloadRepo.findOne({ where: { id, tenantId } });
    void this.auditService.emitAuditEvent({
      tenantId,
      userId: actorId ?? null,
      eventType: AuditEventType.SENSITIVE_ACCESS,
      action: 'raw_payload.access',
      status: 'granted',
      resourceId: id,
      metadata: {
        accessType: 'by_id',
        recordFound: Boolean(record),
      },
    });
    if (record) {
      await this.auditService.log({
        tenantId,
        actorId: actorId ?? null,
        action: 'raw_payload.retrieved',
        resourceType: 'bv_raw_payload',
        resourceId: record.id,
        metadata: { checksum: record.checksum, providerSource: record.providerSource },
      });
    }
    return record;
  }

  /**
   * Find the raw payload linked to a specific snapshot.
   * Returns null when the snapshot was a cache hit or raw payload storage failed.
   */
  async getBySnapshotId(
    tenantId: string,
    snapshotId: string,
    actorId?: string | null,
  ): Promise<BvRawPayloadEntity | null> {
    const record = await this.rawPayloadRepo.findOne({ where: { snapshotId, tenantId } });
    void this.auditService.emitAuditEvent({
      tenantId,
      userId: actorId ?? null,
      eventType: AuditEventType.SENSITIVE_ACCESS,
      action: 'raw_payload.access',
      status: 'granted',
      resourceId: snapshotId,
      metadata: {
        accessType: 'by_snapshot',
        recordFound: Boolean(record),
        snapshotId,
      },
    });
    if (record) {
      await this.auditService.log({
        tenantId,
        actorId: actorId ?? null,
        action: 'raw_payload.retrieved',
        resourceType: 'bv_raw_payload',
        resourceId: record.id,
        metadata: {
          checksum: record.checksum,
          providerSource: record.providerSource,
          snapshotId,
        },
      });
    }
    return record;
  }

  /**
   * Find all raw payloads with the given checksum for a tenant.
   * Normally returns 0 or 1 result (deduplication enforces uniqueness per tenant).
   * Returns the full list for completeness.
   */
  async getByChecksum(tenantId: string, checksum: string): Promise<BvRawPayloadEntity[]> {
    return this.rawPayloadRepo.find({ where: { tenantId, checksum }, order: { createdAt: 'DESC' } });
  }

  /**
   * List raw payloads for a specific provider source within a tenant.
   * Useful for provider-level audits (e.g. "all Bolagsverket payloads").
   *
   * @param limit  Maximum number of results (default: 50, max caller-enforced).
   */
  async listByProviderSource(
    tenantId: string,
    providerSource: string,
    limit = 50,
  ): Promise<BvRawPayloadEntity[]> {
    return this.rawPayloadRepo.find({
      where: { tenantId, providerSource },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  /**
   * List raw payloads for a specific organisation within a tenant.
   * Ordered most-recent first.
   */
  async listByOrganisationsnummer(
    tenantId: string,
    organisationsnummer: string,
    limit = 50,
  ): Promise<BvRawPayloadEntity[]> {
    return this.rawPayloadRepo.find({
      where: { tenantId, organisationsnummer },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHash } from 'crypto';
import { BvRawPayloadEntity } from '../entities/bv-raw-payload.entity';
import { AuditService } from '../../audit/audit.service';

/** Input required to store a new raw payload. */
export interface StoreRawPayloadInput {
  tenantId: string;
  providerSource: string;
  organisationsnummer: string;
  /** The raw provider response content to store. */
  content: Record<string, unknown>;
  /** Separable provenance metadata (fetchedAt, sourceEndpoints, etc.). */
  metadata?: Record<string, unknown>;
  /** ID of the snapshot that produced this payload. */
  snapshotId?: string | null;
  /** Payload format version. Defaults to '1'. */
  payloadVersion?: string;
}

/** Result returned from storeRawPayload. */
export interface StoreRawPayloadResult {
  rawPayload: BvRawPayloadEntity;
  /** True when an existing record was reused (deduplication hit). */
  isDeduplicated: boolean;
}

@Injectable()
export class RawPayloadStorageService {
  private readonly logger = new Logger(RawPayloadStorageService.name);

  constructor(
    @InjectRepository(BvRawPayloadEntity)
    private readonly rawPayloadRepo: Repository<BvRawPayloadEntity>,
    private readonly auditService: AuditService,
  ) {}

  // ── Checksum ──────────────────────────────────────────────────────────────

  /**
   * Compute a deterministic SHA-256 hex digest of a JSON-serialisable object.
   *
   * Determinism is achieved by:
   * 1. Recursively sorting object keys before serialisation.
   * 2. Using a stable JSON serialiser (no formatting, no undefined values).
   *
   * Two payloads with identical content will always produce the same checksum
   * regardless of key insertion order.
   */
  computeChecksum(content: Record<string, unknown>): string {
    const deterministic = JSON.stringify(this.sortKeys(content));
    return createHash('sha256').update(deterministic, 'utf8').digest('hex');
  }

  // ── Storage ───────────────────────────────────────────────────────────────

  /**
   * Store a raw provider payload with checksum-based deduplication.
   *
   * If a payload with the same (tenant_id, checksum) already exists, the
   * existing record is returned and an audit event is emitted to signal a
   * deduplication hit.  The snapshotId on the existing record is NOT updated;
   * callers should update their snapshot's rawPayloadId to point at the
   * returned record.
   *
   * Storage failures are caught and re-thrown — callers (BolagsverketService)
   * are expected to handle them gracefully (i.e., continue without rawPayloadId).
   */
  async storeRawPayload(input: StoreRawPayloadInput): Promise<StoreRawPayloadResult> {
    const {
      tenantId,
      providerSource,
      organisationsnummer,
      content,
      metadata = {},
      snapshotId = null,
      payloadVersion = '1',
    } = input;

    const checksum = this.computeChecksum(content);
    const payloadSizeBytes = Buffer.byteLength(JSON.stringify(content), 'utf8');

    // 1. Deduplication check
    const existing = await this.rawPayloadRepo.findOne({
      where: { tenantId, checksum },
    });

    if (existing) {
      this.logger.log(
        `Deduplication hit for ${organisationsnummer} (tenant ${tenantId}, checksum ${checksum.slice(0, 12)}…)`,
      );
      await this.auditService.log({
        tenantId,
        actorId: null,
        action: 'raw_payload.deduplication_hit',
        resourceType: 'bv_raw_payload',
        resourceId: existing.id,
        metadata: {
          checksum,
          providerSource,
          organisationsnummer,
          snapshotId,
        },
      });
      return { rawPayload: existing, isDeduplicated: true };
    }

    // 2. Persist new record
    const entity = this.rawPayloadRepo.create({
      tenantId,
      checksum,
      providerSource,
      organisationsnummer,
      content,
      metadata: {
        ...metadata,
        payloadVersion,
        storedAt: new Date().toISOString(),
      },
      payloadVersion,
      payloadSizeBytes,
      snapshotId,
      isDuplicate: false,
    });

    const saved = await this.rawPayloadRepo.save(entity);

    this.logger.log(
      `Stored raw payload ${saved.id} for ${organisationsnummer} (tenant ${tenantId}, ${payloadSizeBytes} bytes)`,
    );

    await this.auditService.log({
      tenantId,
      actorId: null,
      action: 'raw_payload.stored',
      resourceType: 'bv_raw_payload',
      resourceId: saved.id,
      metadata: {
        checksum,
        providerSource,
        organisationsnummer,
        payloadSizeBytes,
        snapshotId,
      },
    });

    return { rawPayload: saved, isDeduplicated: false };
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  /**
   * Recursively sort all object keys so that JSON.stringify produces the same
   * string regardless of insertion order.  Arrays are left in their original
   * order (element order is semantically significant).
   */
  private sortKeys(value: unknown): unknown {
    if (Array.isArray(value)) {
      return value.map((item) => this.sortKeys(item));
    }
    if (value !== null && typeof value === 'object') {
      return Object.keys(value as Record<string, unknown>)
        .sort()
        .reduce<Record<string, unknown>>((acc, key) => {
          acc[key] = this.sortKeys((value as Record<string, unknown>)[key]);
          return acc;
        }, {});
    }
    return value;
  }
}

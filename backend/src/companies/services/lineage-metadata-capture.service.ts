import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditService } from '../../audit/audit.service';
import { LineageMetadataEntity, TriggerType } from '../entities/lineage-metadata.entity';

// ── Types ─────────────────────────────────────────────────────────────────────

/**
 * P02-T06: Input record describing a single data operation to be captured as
 * lineage metadata.
 */
export interface LineageCaptureInput {
  /** Tenant that owns the operation — required for tenant isolation. */
  tenantId: string;
  /**
   * Actor (user / service account) ID.
   * Pass null for unauthenticated or system-initiated operations.
   */
  userId?: string | null;
  /**
   * Request-scoped correlation ID propagated from the entry point.
   * If not provided, the capture service will generate one.
   */
  correlationId: string;
  /** How this operation was triggered. */
  triggerType: TriggerType;
  /** HTTP method used by the inbound request (e.g. 'GET', 'POST'). */
  httpMethod?: string | null;
  /** API path / endpoint that was invoked. */
  sourceEndpoint?: string | null;
  /**
   * Inbound request parameters to persist.
   * The service will sanitize this object before storage.
   */
  requestParameters?: Record<string, unknown>;
}

/**
 * The result returned by a successful `capture()` call.
 */
export interface LineageCaptureResult {
  /** ID of the persisted LineageMetadataEntity record. */
  lineageId: string;
  /** Correlation ID used for this record (echoed from input). */
  correlationId: string;
}

// ── Sensitive-key denylist ────────────────────────────────────────────────────

/**
 * Keys whose values must never be stored in lineage metadata.
 * Matching is case-insensitive and checks both exact key names and
 * substring inclusion.
 */
const SENSITIVE_KEY_PATTERNS: RegExp[] = [
  /^password$/i,
  /^passwd$/i,
  /^secret$/i,
  /^token$/i,
  /^api.?key$/i,
  /^auth$/i,
  /^authorization$/i,
  /^credential/i,
  /^private.?key$/i,
  /^access.?key$/i,
  /^refresh.?token$/i,
  /^client.?secret$/i,
  /^ssn$/i,
  /^social.?security/i,
  /^cvv$/i,
  /^card.?number$/i,
];

// ── Service ───────────────────────────────────────────────────────────────────

/**
 * P02-T06: Lineage metadata capture service.
 *
 * Records a lineage entry for every lookup, refresh, or snapshot operation so
 * that auditors can reconstruct the full request context and operators can
 * replay or debug any operation.
 *
 * All captures are best-effort: failures are logged and swallowed so that
 * they never abort the main data path.
 */
@Injectable()
export class LineageMetadataCaptureService {
  private readonly logger = new Logger(LineageMetadataCaptureService.name);

  constructor(
    @InjectRepository(LineageMetadataEntity)
    private readonly lineageRepo: Repository<LineageMetadataEntity>,
    private readonly auditService: AuditService,
  ) {}

  // ── Public API ──────────────────────────────────────────────────────────────

  /**
   * Capture lineage metadata for a data operation.
   *
   * This method is **fire-and-forget safe** — call it inside `.catch()` or
   * with `void` when latency is critical.  It will never throw; all errors
   * are logged at WARN level and a null result is returned.
   *
   * @returns The persisted record metadata, or null when capture failed.
   */
  async capture(input: LineageCaptureInput): Promise<LineageCaptureResult | null> {
    try {
      return await this._persist(input);
    } catch (err) {
      this.logger.warn(
        `[P02-T06] Lineage capture failed for tenant=${input.tenantId} correlationId=${input.correlationId}: ${err}`,
      );
      return null;
    }
  }

  /**
   * Determine the TriggerType for a standard company-lookup operation.
   *
   * Rules (in priority order):
   * 1. `forceRefresh=true`  → FORCE_REFRESH
   * 2. Any value supplied as an explicit override → used as-is
   * 3. Default              → API_REQUEST
   */
  static resolveTriggerType(opts: {
    forceRefresh?: boolean;
    triggerType?: TriggerType;
  }): TriggerType {
    if (opts.forceRefresh) return TriggerType.FORCE_REFRESH;
    if (opts.triggerType) return opts.triggerType;
    return TriggerType.API_REQUEST;
  }

  /**
   * Remove sensitive fields from a parameter map before it is stored.
   *
   * The function performs a **shallow** pass over the top-level keys and
   * redacts any key whose name matches the sensitive-key denylist.
   * Nested objects are stored as-is but their top-level sensitive siblings
   * are removed.  This is intentionally conservative — a deep redaction
   * that recurses into nested objects will be added in a follow-up ticket
   * (see P02-T07 and beyond).
   *
   * @param params  Raw request parameters (may be undefined / null).
   * @returns       A sanitized copy of the input.
   */
  sanitizeParameters(
    params: Record<string, unknown> | undefined | null,
  ): Record<string, unknown> {
    if (!params || typeof params !== 'object') return {};

    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(params)) {
      if (this._isSensitiveKey(key)) {
        result[key] = '[REDACTED]';
      } else {
        result[key] = value;
      }
    }

    return result;
  }

  // ── Internal helpers ────────────────────────────────────────────────────────

  private async _persist(input: LineageCaptureInput): Promise<LineageCaptureResult> {
    const sanitized = this.sanitizeParameters(input.requestParameters);

    const entity = this.lineageRepo.create({
      tenantId: input.tenantId,
      userId: input.userId ?? null,
      correlationId: input.correlationId,
      triggerType: input.triggerType,
      httpMethod: input.httpMethod ?? null,
      sourceEndpoint: input.sourceEndpoint ?? null,
      requestParameters: sanitized,
    });

    const saved = await this.lineageRepo.save(entity);

    // Best-effort audit emission — failure here must not abort the capture.
    this._emitAuditEvent(saved).catch((err) =>
      this.logger.warn(`[P02-T06] Audit emit failed after lineage capture: ${err}`),
    );

    this.logger.debug(
      `[P02-T06] Lineage captured id=${saved.id} tenant=${saved.tenantId} correlationId=${saved.correlationId} triggerType=${saved.triggerType}`,
    );

    return { lineageId: saved.id, correlationId: saved.correlationId };
  }

  private _isSensitiveKey(key: string): boolean {
    return SENSITIVE_KEY_PATTERNS.some((re) => re.test(key));
  }

  private async _emitAuditEvent(record: LineageMetadataEntity): Promise<void> {
    await this.auditService.log({
      tenantId: record.tenantId,
      actorId: record.userId ?? null,
      action: 'lineage.captured',
      resourceType: 'lineage_metadata',
      resourceId: record.id,
      metadata: {
        correlationId: record.correlationId,
        triggerType: record.triggerType,
        sourceEndpoint: record.sourceEndpoint,
        httpMethod: record.httpMethod,
      },
    });
  }
}

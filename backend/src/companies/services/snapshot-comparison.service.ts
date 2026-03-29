import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditService } from '../../audit/audit.service';
import { BvFetchSnapshotEntity } from '../entities/bv-fetch-snapshot.entity';
import {
  ChangeType,
  CompanyChangeEventEntity,
} from '../entities/company-change-event.entity';

// ── Types ─────────────────────────────────────────────────────────────────────

/**
 * A single attribute-level change detected between two snapshots.
 */
export interface AttributeChange {
  attributeName: string;
  oldValue: unknown;
  newValue: unknown;
  changeType: ChangeType;
}

/**
 * The result of a full comparison run between two snapshots.
 */
export interface ComparisonResult {
  snapshotIdBefore: string | null;
  snapshotIdAfter: string;
  orgNumber: string;
  tenantId: string;
  changes: AttributeChange[];
  /** True when the comparison completed without errors. */
  success: boolean;
  /** Error message when success=false. */
  errorMessage?: string;
}

/**
 * Input for a single batch comparison request.
 */
export interface BatchComparisonInput {
  tenantId: string;
  snapshotIdAfter: string;
  snapshotIdBefore?: string | null;
}

// ── Service ───────────────────────────────────────────────────────────────────

/**
 * P02-T08: Snapshot comparison service.
 *
 * Compares the `normalisedSummary` attribute maps of two consecutive
 * BvFetchSnapshot records and produces attribute-level change events.
 *
 * Key capabilities:
 *  • Compare the normalised summaries of two snapshots (or one snapshot
 *    against an empty "before" state for first-ever snapshots).
 *  • Classify each attribute as ADDED | MODIFIED | REMOVED | UNCHANGED.
 *  • Persist change events to `company_change_events`.
 *  • Emit `snapshot.comparison_completed` audit events.
 *  • Handle comparison failures gracefully (log, emit UNKNOWN events, do
 *    NOT block snapshot creation).
 *  • Support batch comparison for multiple snapshots.
 *
 * Tenant isolation: all queries always include tenant_id in the WHERE clause.
 */
@Injectable()
export class SnapshotComparisonService {
  private readonly logger = new Logger(SnapshotComparisonService.name);

  constructor(
    @InjectRepository(BvFetchSnapshotEntity)
    private readonly snapshotRepo: Repository<BvFetchSnapshotEntity>,
    @InjectRepository(CompanyChangeEventEntity)
    private readonly changeEventRepo: Repository<CompanyChangeEventEntity>,
    private readonly auditService: AuditService,
  ) {}

  // ── Public API ───────────────────────────────────────────────────────────────

  /**
   * Compare the two snapshots identified by `snapshotIdBefore` and
   * `snapshotIdAfter`, persist the resulting change events, and return the
   * comparison result.
   *
   * When `snapshotIdBefore` is null (first-ever snapshot for an entity) every
   * attribute in the after-snapshot is classified as ADDED.
   *
   * Failures are caught, logged, and surfaced as ComparisonResult.success=false
   * with an UNKNOWN change event so that the snapshot creation pipeline is
   * never blocked.
   *
   * @param tenantId           Tenant that owns both snapshots.
   * @param snapshotIdAfter    ID of the newly-created snapshot.
   * @param snapshotIdBefore   ID of the predecessor snapshot (or null).
   * @returns                  Comparison result including persisted change count.
   */
  async compareSnapshots(
    tenantId: string,
    snapshotIdAfter: string,
    snapshotIdBefore: string | null,
  ): Promise<ComparisonResult> {
    try {
      return await this._doCompare(tenantId, snapshotIdAfter, snapshotIdBefore);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `[P02-T08] Comparison failed: after=${snapshotIdAfter} before=${snapshotIdBefore ?? 'none'} ` +
          `tenant=${tenantId} error=${errMsg}`,
      );
      // Best-effort: persist a single UNKNOWN event so the failure is traceable.
      await this._persistUnknownFailureEvent(
        tenantId,
        snapshotIdAfter,
        snapshotIdBefore,
        errMsg,
      ).catch((e) => this.logger.warn(`[P02-T08] Could not persist failure event: ${e}`));
      return {
        snapshotIdBefore,
        snapshotIdAfter,
        orgNumber: '',
        tenantId,
        changes: [],
        success: false,
        errorMessage: errMsg,
      };
    }
  }

  /**
   * Run comparisons for multiple (before, after) snapshot pairs in sequence.
   *
   * Each pair is processed independently; failures in one pair do not abort
   * the remaining pairs.  Results are returned in input order.
   *
   * @param inputs  Array of BatchComparisonInput descriptors.
   * @returns       Array of ComparisonResult in the same order as inputs.
   */
  async compareBatch(inputs: BatchComparisonInput[]): Promise<ComparisonResult[]> {
    const results: ComparisonResult[] = [];
    for (const input of inputs) {
      const result = await this.compareSnapshots(
        input.tenantId,
        input.snapshotIdAfter,
        input.snapshotIdBefore ?? null,
      );
      results.push(result);
    }
    return results;
  }

  // ── Internal helpers ─────────────────────────────────────────────────────────

  private async _doCompare(
    tenantId: string,
    snapshotIdAfter: string,
    snapshotIdBefore: string | null,
  ): Promise<ComparisonResult> {
    const afterSnap = await this.snapshotRepo.findOne({
      where: { id: snapshotIdAfter, tenantId },
    });
    if (!afterSnap) {
      throw new Error(`[P02-T08] After-snapshot not found: id=${snapshotIdAfter} tenant=${tenantId}`);
    }

    let beforeSnap: BvFetchSnapshotEntity | null = null;
    if (snapshotIdBefore) {
      beforeSnap = await this.snapshotRepo.findOne({
        where: { id: snapshotIdBefore, tenantId },
      });
      if (!beforeSnap) {
        throw new Error(
          `[P02-T08] Before-snapshot not found: id=${snapshotIdBefore} tenant=${tenantId}`,
        );
      }
    }

    const beforeAttrs = this._flattenAttributes(beforeSnap?.normalisedSummary ?? {});
    const afterAttrs = this._flattenAttributes(afterSnap.normalisedSummary ?? {});

    const changes = this._diffAttributes(beforeAttrs, afterAttrs);

    const events = changes.map((change) => {
      const event = new CompanyChangeEventEntity();
      event.tenantId = tenantId;
      event.orgNumber = afterSnap.organisationsnummer;
      event.snapshotIdBefore = snapshotIdBefore ?? null;
      event.snapshotIdAfter = snapshotIdAfter;
      event.attributeName = change.attributeName;
      event.oldValue = change.oldValue !== undefined ? JSON.stringify(change.oldValue) : null;
      event.newValue = change.newValue !== undefined ? JSON.stringify(change.newValue) : null;
      event.changeType = change.changeType;
      event.correlationId = afterSnap.correlationId ?? null;
      event.actorId = afterSnap.actorId ?? null;
      return event;
    });

    if (events.length > 0) {
      await this.changeEventRepo.save(events);
    }

    const nonUnchangedCount = changes.filter((c) => c.changeType !== ChangeType.UNCHANGED).length;

    this.logger.debug(
      `[P02-T08] Comparison complete: after=${snapshotIdAfter} before=${snapshotIdBefore ?? 'none'} ` +
        `changes=${nonUnchangedCount}/${changes.length} tenant=${tenantId}`,
    );

    this._emitComparisonAuditEvent(afterSnap, snapshotIdBefore, changes).catch((err) =>
      this.logger.warn(`[P02-T08] Audit emit failed for comparison: ${err}`),
    );

    return {
      snapshotIdBefore,
      snapshotIdAfter,
      orgNumber: afterSnap.organisationsnummer,
      tenantId,
      changes,
      success: true,
    };
  }

  /**
   * Flatten a nested object into dot-notation key/value pairs.
   *
   * e.g. { a: { b: 1 }, c: 2 }  →  { 'a.b': 1, 'c': 2 }
   *
   * Arrays are serialised as-is at the top level of each array element
   * to avoid producing an explosive number of attribute keys while still
   * capturing array-value changes.
   */
  _flattenAttributes(
    obj: Record<string, unknown>,
    prefix = '',
  ): Map<string, unknown> {
    const result = new Map<string, unknown>();
    for (const [key, value] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      if (
        value !== null &&
        typeof value === 'object' &&
        !Array.isArray(value)
      ) {
        const nested = this._flattenAttributes(
          value as Record<string, unknown>,
          fullKey,
        );
        for (const [nestedKey, nestedVal] of nested.entries()) {
          result.set(nestedKey, nestedVal);
        }
      } else {
        result.set(fullKey, value);
      }
    }
    return result;
  }

  /**
   * Compare two flattened attribute maps and return the list of changes.
   */
  _diffAttributes(
    before: Map<string, unknown>,
    after: Map<string, unknown>,
  ): AttributeChange[] {
    const changes: AttributeChange[] = [];
    const allKeys = new Set([...before.keys(), ...after.keys()]);

    for (const key of allKeys) {
      const hadBefore = before.has(key);
      const hasAfter = after.has(key);

      if (!hadBefore && hasAfter) {
        changes.push({
          attributeName: key,
          oldValue: undefined,
          newValue: after.get(key),
          changeType: ChangeType.ADDED,
        });
      } else if (hadBefore && !hasAfter) {
        changes.push({
          attributeName: key,
          oldValue: before.get(key),
          newValue: undefined,
          changeType: ChangeType.REMOVED,
        });
      } else if (hadBefore && hasAfter) {
        const oldVal = before.get(key);
        const newVal = after.get(key);
        const isEqual = this._deepEqual(oldVal, newVal);
        changes.push({
          attributeName: key,
          oldValue: oldVal,
          newValue: newVal,
          changeType: isEqual ? ChangeType.UNCHANGED : ChangeType.MODIFIED,
        });
      }
    }

    return changes;
  }

  /**
   * Deep equality check that handles primitives, arrays, objects, and nulls.
   * Object keys are sorted before JSON serialisation to ensure deterministic
   * comparison regardless of insertion order.
   */
  _deepEqual(a: unknown, b: unknown): boolean {
    if (a === b) return true;
    if (a === null || b === null) return false;
    if (a === undefined || b === undefined) return false;
    if (typeof a !== typeof b) return false;
    if (typeof a !== 'object') return false;

    // Normalise key order before comparison to avoid false negatives caused
    // by objects with identical properties in different insertion orders.
    try {
      return JSON.stringify(this._sortedKeys(a)) === JSON.stringify(this._sortedKeys(b));
    } catch {
      return false;
    }
  }

  /**
   * Recursively sort all object keys (alphabetically) so that serialisation
   * produces a deterministic string regardless of insertion order.
   * Arrays are preserved as-is (element order is significant).
   */
  private _sortedKeys(value: unknown): unknown {
    if (value === null || typeof value !== 'object') return value;
    if (Array.isArray(value)) return value.map((item) => this._sortedKeys(item));
    return Object.fromEntries(
      Object.keys(value as Record<string, unknown>)
        .sort()
        .map((key) => [key, this._sortedKeys((value as Record<string, unknown>)[key])]),
    );
  }

  /** Persist a sentinel UNKNOWN change event when a comparison fails. */
  private async _persistUnknownFailureEvent(
    tenantId: string,
    snapshotIdAfter: string,
    snapshotIdBefore: string | null,
    errorMessage: string,
  ): Promise<void> {
    // Try to load the after-snapshot to get the org number; fall back gracefully.
    const afterSnap = await this.snapshotRepo
      .findOne({ where: { id: snapshotIdAfter, tenantId } })
      .catch(() => null);

    const event = new CompanyChangeEventEntity();
    event.tenantId = tenantId;
    event.orgNumber = afterSnap?.organisationsnummer ?? '';
    event.snapshotIdBefore = snapshotIdBefore ?? null;
    event.snapshotIdAfter = snapshotIdAfter;
    event.attributeName = '__comparison_failure__';
    event.oldValue = null;
    event.newValue = JSON.stringify({ error: errorMessage });
    event.changeType = ChangeType.UNKNOWN;
    event.correlationId = afterSnap?.correlationId ?? null;
    event.actorId = afterSnap?.actorId ?? null;
    await this.changeEventRepo.save(event);
  }

  private async _emitComparisonAuditEvent(
    afterSnap: BvFetchSnapshotEntity,
    snapshotIdBefore: string | null,
    changes: AttributeChange[],
  ): Promise<void> {
    const added = changes.filter((c) => c.changeType === ChangeType.ADDED).length;
    const modified = changes.filter((c) => c.changeType === ChangeType.MODIFIED).length;
    const removed = changes.filter((c) => c.changeType === ChangeType.REMOVED).length;
    const unchanged = changes.filter((c) => c.changeType === ChangeType.UNCHANGED).length;

    await this.auditService.log({
      tenantId: afterSnap.tenantId,
      actorId: afterSnap.actorId ?? null,
      action: 'snapshot.comparison_completed',
      resourceType: 'bv_fetch_snapshot',
      resourceId: afterSnap.id,
      metadata: {
        snapshotIdBefore,
        organisationsnummer: afterSnap.organisationsnummer,
        added,
        modified,
        removed,
        unchanged,
        total: changes.length,
      },
    });
  }
}

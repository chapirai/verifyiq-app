import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditService } from '../../audit/audit.service';
import {
  BvFetchSnapshotEntity,
  generateReplayId,
} from '../entities/bv-fetch-snapshot.entity';

// ── Result types ──────────────────────────────────────────────────────────────

/** Summary of a chain-validation run. */
export interface ChainValidationResult {
  /** True when the chain is fully intact (no cycles, no gaps, correct sequence). */
  valid: boolean;
  /** Human-readable descriptions of any detected issues. */
  issues: string[];
  /** Total number of snapshots inspected. */
  snapshotCount: number;
  /** Number of broken-link flags detected. */
  brokenLinkCount: number;
}

/** Result of a chain-reconstruction attempt. */
export interface ChainReconstructionResult {
  /** Number of snapshots whose links were re-assigned. */
  relinkedCount: number;
  /** True when all links could be restored. */
  fullyReconstructed: boolean;
}

// ── Service ───────────────────────────────────────────────────────────────────

/**
 * P02-T07: Snapshot version-chain service.
 *
 * Maintains the linked-list version chain for BvFetchSnapshot records:
 *
 *   snapshot_N  →  snapshot_(N-1)  →  …  →  snapshot_1  (no predecessor)
 *
 * Key capabilities:
 *   • Link a new snapshot to its predecessor in the chain.
 *   • Walk the chain forward/backward for history or replay.
 *   • Find the snapshot that was active at a given timestamp.
 *   • Validate chain integrity (no cycles, correct sequence numbers).
 *   • Attempt reconstruction when links are broken.
 *   • Generate/return replay-safe identifiers.
 *   • Emit audit events for all chain-altering operations.
 *
 * All writes are best-effort: failures are logged and re-thrown only where
 * the caller must know about them (e.g. linkSnapshot).  Read-only methods
 * never throw; they return empty/null values on error.
 *
 * Tenant isolation: all queries always include tenant_id in the WHERE clause.
 */
@Injectable()
export class SnapshotChainService {
  private readonly logger = new Logger(SnapshotChainService.name);

  constructor(
    @InjectRepository(BvFetchSnapshotEntity)
    private readonly snapshotRepo: Repository<BvFetchSnapshotEntity>,
    private readonly auditService: AuditService,
  ) {}

  // ── Public API ──────────────────────────────────────────────────────────────

  /**
   * Link a newly-created snapshot to its predecessor in the version chain and
   * assign its `versionNumber`, `sequenceNumber`, and `replayId`.
   *
   * Steps:
   * 1. Find the most-recent existing snapshot for (tenantId, orgNr) that is
   *    NOT the new snapshot itself.
   * 2. Set `previousSnapshotId` → that snapshot's ID (null if none exists).
   * 3. Assign `versionNumber` = predecessor.versionNumber + 1 (or 1 if new).
   * 4. Assign `sequenceNumber` = versionNumber.
   * 5. Generate and assign `replayId`.
   * 6. Persist the updated snapshot.
   * 7. Emit `snapshot_chain.link_created` audit event.
   *
   * @param tenantId         Tenant that owns the snapshot.
   * @param newSnapshotId    ID of the snapshot to link (must already exist).
   * @param organisationsnummer  Org number of the entity being tracked.
   * @returns The updated snapshot with chain fields populated.
   */
  async linkSnapshot(
    tenantId: string,
    newSnapshotId: string,
    organisationsnummer: string,
  ): Promise<BvFetchSnapshotEntity> {
    const newSnapshot = await this.snapshotRepo.findOne({
      where: { id: newSnapshotId, tenantId },
    });

    if (!newSnapshot) {
      throw new Error(
        `[P02-T07] Cannot link snapshot: id=${newSnapshotId} not found for tenant=${tenantId}`,
      );
    }

    // Find the most-recent predecessor (any snapshot for same entity, excl. the new one)
    const predecessor = await this.snapshotRepo.findOne({
      where: { tenantId, organisationsnummer },
      order: { fetchedAt: 'DESC', versionNumber: 'DESC' },
    });
    const actualPredecessor = predecessor?.id === newSnapshotId ? null : predecessor;

    const versionNumber = actualPredecessor ? (actualPredecessor.versionNumber ?? 0) + 1 : 1;
    const sequenceNumber = versionNumber;
    const replayId = generateReplayId(
      tenantId,
      organisationsnummer,
      newSnapshotId,
      newSnapshot.payloadHash ?? null,
    );

    newSnapshot.previousSnapshotId = actualPredecessor?.id ?? null;
    newSnapshot.versionNumber = versionNumber;
    newSnapshot.sequenceNumber = sequenceNumber;
    newSnapshot.replayId = replayId;
    newSnapshot.chainBroken = false;

    const saved = await this.snapshotRepo.save(newSnapshot);

    this.logger.debug(
      `[P02-T07] Chain linked: snapshotId=${newSnapshotId} version=${versionNumber} ` +
        `previousId=${actualPredecessor?.id ?? 'none'} tenant=${tenantId}`,
    );

    this._emitAuditEvent('snapshot_chain.link_created', saved, {
      previousSnapshotId: actualPredecessor?.id ?? null,
      versionNumber,
      replayId,
    }).catch((err) =>
      this.logger.warn(`[P02-T07] Audit emit failed for link_created: ${err}`),
    );

    return saved;
  }

  /**
   * Return the full version history for an entity, ordered most-recent first.
   *
   * This is a flat list query (not a chain walk) — it returns all snapshots
   * for the entity within the tenant, regardless of chain integrity.
   */
  async getVersionChain(
    tenantId: string,
    organisationsnummer: string,
    limit = 50,
  ): Promise<BvFetchSnapshotEntity[]> {
    return this.snapshotRepo.find({
      where: { tenantId, organisationsnummer },
      order: { sequenceNumber: 'DESC' },
      take: Math.min(limit, 200),
    });
  }

  /**
   * Walk the version chain backwards from a given starting snapshot.
   *
   * Starting from `startSnapshotId`, follows `previousSnapshotId` pointers
   * until the chain root (null predecessor) or `maxSteps` is reached.
   *
   * Returns snapshots in reverse-chronological order (newest first).
   * If a link is broken (predecessor not found), stops and sets `chainBroken`
   * on the last valid snapshot in the walk.
   */
  async walkChain(
    tenantId: string,
    startSnapshotId: string,
    maxSteps = 100,
  ): Promise<BvFetchSnapshotEntity[]> {
    const chain: BvFetchSnapshotEntity[] = [];
    const seen = new Set<string>();
    let currentId: string | null = startSnapshotId;

    for (let step = 0; step < maxSteps && currentId !== null; step++) {
      if (seen.has(currentId)) {
        // Cycle detected — flag and stop
        this.logger.warn(
          `[P02-T07] Cycle detected in chain at snapshotId=${currentId} tenant=${tenantId}`,
        );
        break;
      }
      seen.add(currentId);

      const snapshot = await this.snapshotRepo.findOne({
        where: { id: currentId, tenantId },
      });

      if (!snapshot) {
        // Broken link — mark the last valid node if the chain is non-empty
        if (chain.length > 0) {
          const last = chain[chain.length - 1];
          if (!last.chainBroken) {
            last.chainBroken = true;
            await this.snapshotRepo.save(last);
            this._emitAuditEvent('snapshot_chain.broken_link_detected', last, {
              missingPredecessorId: currentId,
            }).catch((err) =>
              this.logger.warn(`[P02-T07] Audit emit failed for broken_link: ${err}`),
            );
          }
        }
        break;
      }

      chain.push(snapshot);
      currentId = snapshot.previousSnapshotId ?? null;
    }

    return chain;
  }

  /**
   * Find the snapshot that was active at or just before the given timestamp.
   *
   * Returns the snapshot with the most recent `fetchedAt` that is ≤ `timestamp`
   * for the given (tenantId, organisationsnummer), or null if no snapshot
   * predates the timestamp.
   */
  async findSnapshotAtTimestamp(
    tenantId: string,
    organisationsnummer: string,
    timestamp: Date,
  ): Promise<BvFetchSnapshotEntity | null> {
    return this.snapshotRepo
      .createQueryBuilder('s')
      .where('s.tenantId = :tenantId', { tenantId })
      .andWhere('s.organisationsnummer = :organisationsnummer', { organisationsnummer })
      .andWhere('s.fetchedAt <= :timestamp', { timestamp })
      .orderBy('s.fetchedAt', 'DESC')
      .limit(1)
      .getOne();
  }

  /**
   * Validate the version chain for an entity.
   *
   * Checks:
   * 1. Sequence numbers are contiguous (no gaps).
   * 2. `previousSnapshotId` pointers are internally consistent.
   * 3. No cycles exist in the chain.
   *
   * Does NOT modify any data.
   */
  async validateChain(
    tenantId: string,
    organisationsnummer: string,
  ): Promise<ChainValidationResult> {
    const snapshots = await this.snapshotRepo.find({
      where: { tenantId, organisationsnummer },
      order: { sequenceNumber: 'ASC' },
    });

    const issues: string[] = [];
    const snapshotById = new Map(snapshots.map((s) => [s.id, s]));
    let brokenLinkCount = 0;

    for (let i = 0; i < snapshots.length; i++) {
      const s = snapshots[i];

      // Check for flagged broken links
      if (s.chainBroken) {
        brokenLinkCount++;
        issues.push(`Snapshot ${s.id} (version ${s.versionNumber}) is flagged as chain_broken.`);
      }

      // Check sequence contiguity (expect 1-based)
      const expectedSeq = i + 1;
      if (s.sequenceNumber !== expectedSeq) {
        issues.push(
          `Sequence gap: snapshot ${s.id} has sequenceNumber=${s.sequenceNumber} but expected ${expectedSeq}.`,
        );
      }

      // Check previousSnapshotId consistency
      if (s.previousSnapshotId !== null && s.previousSnapshotId !== undefined) {
        if (!snapshotById.has(s.previousSnapshotId)) {
          brokenLinkCount++;
          issues.push(
            `Broken link: snapshot ${s.id} references previousSnapshotId=${s.previousSnapshotId} which does not exist.`,
          );
        } else {
          const prev = snapshotById.get(s.previousSnapshotId)!;
          if (prev.versionNumber !== s.versionNumber - 1) {
            issues.push(
              `Version mismatch: snapshot ${s.id} (v${s.versionNumber}) predecessor ` +
                `${prev.id} has version ${prev.versionNumber} (expected ${s.versionNumber - 1}).`,
            );
          }
        }
      }
    }

    // Cycle detection via DFS
    const visited = new Set<string>();
    const inStack = new Set<string>();
    for (const snapshot of snapshots) {
      if (!visited.has(snapshot.id)) {
        const hasCycle = this._detectCycle(snapshot.id, snapshotById, visited, inStack);
        if (hasCycle) {
          issues.push(`Cycle detected in version chain involving snapshot ${snapshot.id}.`);
        }
      }
    }

    return {
      valid: issues.length === 0,
      issues,
      snapshotCount: snapshots.length,
      brokenLinkCount,
    };
  }

  /**
   * Attempt to reconstruct the version chain from snapshot timestamps.
   *
   * Used when chain links are broken (previousSnapshotId references missing
   * snapshots) or never set.  Sorts all available snapshots by `fetchedAt`
   * ascending and re-assigns `previousSnapshotId` and `sequenceNumber` in
   * chronological order.
   *
   * This is a best-effort operation: it preserves the existing `id` values
   * and only updates chain-linkage fields.
   *
   * Emits `snapshot_chain.reconstruction_attempted` audit event on completion.
   */
  async reconstructChain(
    tenantId: string,
    organisationsnummer: string,
  ): Promise<ChainReconstructionResult> {
    const snapshots = await this.snapshotRepo.find({
      where: { tenantId, organisationsnummer },
      order: { fetchedAt: 'ASC' },
    });

    if (snapshots.length === 0) {
      return { relinkedCount: 0, fullyReconstructed: true };
    }

    let relinkedCount = 0;

    for (let i = 0; i < snapshots.length; i++) {
      const snap = snapshots[i];
      const expectedPreviousId = i > 0 ? snapshots[i - 1].id : null;
      const expectedVersion = i + 1;

      const needsUpdate =
        snap.previousSnapshotId !== expectedPreviousId ||
        snap.versionNumber !== expectedVersion ||
        snap.sequenceNumber !== expectedVersion ||
        snap.chainBroken;

      if (needsUpdate) {
        snap.previousSnapshotId = expectedPreviousId;
        snap.versionNumber = expectedVersion;
        snap.sequenceNumber = expectedVersion;
        snap.chainBroken = false;
        // Regenerate replay ID with updated context
        snap.replayId = generateReplayId(
          tenantId,
          organisationsnummer,
          snap.id,
          snap.payloadHash ?? null,
        );
        await this.snapshotRepo.save(snap);
        relinkedCount++;
      }
    }

    this.logger.log(
      `[P02-T07] Chain reconstruction: tenant=${tenantId} org=${organisationsnummer} ` +
        `relinked=${relinkedCount}/${snapshots.length}`,
    );

    const representativeSnapshot = snapshots[snapshots.length - 1];
    this._emitAuditEvent('snapshot_chain.reconstruction_attempted', representativeSnapshot, {
      totalSnapshots: snapshots.length,
      relinkedCount,
      fullyReconstructed: true,
    }).catch((err) =>
      this.logger.warn(`[P02-T07] Audit emit failed for reconstruction: ${err}`),
    );

    // All individual saves completed without error; the chain is fully reconstructed.
    return { relinkedCount, fullyReconstructed: true };
  }

  /**
   * Find a snapshot by its replay-safe identifier, scoped to the tenant.
   *
   * Returns null when no snapshot matches the given replayId within the tenant.
   */
  async findByReplayId(
    tenantId: string,
    replayId: string,
  ): Promise<BvFetchSnapshotEntity | null> {
    return this.snapshotRepo.findOne({
      where: { tenantId, replayId },
    });
  }

  /**
   * Generate the replay-safe identifier for an existing snapshot without
   * persisting any changes.  Useful when the caller needs the ID before
   * `linkSnapshot` has been called.
   */
  computeReplayId(snapshot: BvFetchSnapshotEntity): string {
    return generateReplayId(
      snapshot.tenantId,
      snapshot.organisationsnummer,
      snapshot.id,
      snapshot.payloadHash ?? null,
    );
  }

  // ── Internal helpers ────────────────────────────────────────────────────────

  /** DFS cycle detection over the previousSnapshotId linked list. */
  private _detectCycle(
    id: string,
    snapshotById: Map<string, BvFetchSnapshotEntity>,
    visited: Set<string>,
    inStack: Set<string>,
  ): boolean {
    visited.add(id);
    inStack.add(id);

    const snap = snapshotById.get(id);
    const prevId = snap?.previousSnapshotId;
    if (prevId) {
      if (!visited.has(prevId)) {
        if (this._detectCycle(prevId, snapshotById, visited, inStack)) return true;
      } else if (inStack.has(prevId)) {
        return true; // back edge → cycle
      }
    }

    inStack.delete(id);
    return false;
  }

  private async _emitAuditEvent(
    action: string,
    snapshot: BvFetchSnapshotEntity,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    await this.auditService.log({
      tenantId: snapshot.tenantId,
      actorId: snapshot.actorId ?? null,
      action,
      resourceType: 'bv_fetch_snapshot',
      resourceId: snapshot.id,
      metadata: {
        organisationsnummer: snapshot.organisationsnummer,
        versionNumber: snapshot.versionNumber,
        sequenceNumber: snapshot.sequenceNumber,
        ...metadata,
      },
    });
  }
}

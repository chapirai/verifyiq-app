import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { OwnershipLinkEntity } from './entities/ownership-link.entity';
import {
  extractAktieslagVotingSummary,
  extractOwnershipEdgesFromFiOrganisationRaw,
} from './ownership-bv-extract.util';

export const BV_FI_ORG_ENGAGEMENT_INGESTION_SOURCE = 'bolagsverket_fi.organisationsengagemang';

/** pg/TypeORM raw rows use lowercase keys; normalize in case a driver returns mixed case. */
function lowerCaseRowKeys(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    out[k.toLowerCase()] = v;
  }
  return out;
}

/** TypeORM usually returns an array of rows; unwrap driver `{ rows }` if present. */
function extractQueryRowArray(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === 'object' && Array.isArray((raw as { rows?: unknown }).rows)) {
    return (raw as { rows: unknown[] }).rows;
  }
  return [];
}

/**
 * Decode one row from `drainIngestQueue` (object keys, mixed case, or pg array-mode).
 * RETURNING column order: queue_id, tenant_id, organisationsnummer.
 */
function parseOwnershipQueueDrainRow(r: unknown): {
  rowId: string;
  tenantId: string;
  organisationNumber: string;
  rawForLog: Record<string, unknown>;
} {
  if (r != null && Array.isArray(r) && r.length >= 3) {
    const rowId = String(r[0] ?? '').trim();
    const tenantId = String(r[1] ?? '').trim();
    const organisationNumber = String(r[2] ?? '').trim();
    return {
      rowId,
      tenantId,
      organisationNumber,
      rawForLog: { '0': r[0], '1': r[1], '2': r[2] } as Record<string, unknown>,
    };
  }
  if (r != null && typeof r === 'object' && !Array.isArray(r)) {
    const o = lowerCaseRowKeys(r as Record<string, unknown>);
    const rowId = String(o.queue_id ?? o.id ?? o['0'] ?? '').trim();
    const tenantId = String(o.tenant_id ?? o['1'] ?? '').trim();
    const organisationNumber = String(o.organisationsnummer ?? o['2'] ?? '').trim();
    return { rowId, tenantId, organisationNumber, rawForLog: o };
  }
  return { rowId: '', tenantId: '', organisationNumber: '', rawForLog: {} };
}

type FiLatestRow = {
  id: string;
  raw_item: Record<string, unknown>;
  organisationsnummer: string;
  organisationsnamn: string | null;
  payload_created_at: Date;
  snapshot_id: string | null;
};

@Injectable()
export class OwnershipBvIngestionService {
  private readonly logger = new Logger(OwnershipBvIngestionService.name);
  private malformedRowLogState: {
    windowStart: number;
    count: number;
    /** Last queue row id seen in the current window (for accurate summaries). */
    lastQueueId: string;
  } = {
    windowStart: Date.now(),
    count: 0,
    lastQueueId: '',
  };

  constructor(private readonly dataSource: DataSource) {}

  /**
   * Drain rows enqueued by bv_pipeline.process_refresh_queue after bv_read refresh.
   */
  async drainIngestQueue(batchSize = 25): Promise<number> {
    const raw = await this.dataSource.query(
      `
      UPDATE bv_pipeline.ownership_ingest_queue q
      SET processed_at = NOW()
      FROM (
        SELECT id, tenant_id, organisationsnummer
        FROM bv_pipeline.ownership_ingest_queue
        WHERE processed_at IS NULL
          AND tenant_id IS NOT NULL
          AND organisationsnummer IS NOT NULL
          AND NULLIF(TRIM(organisationsnummer), '') IS NOT NULL
        ORDER BY id
        LIMIT $1
        FOR UPDATE SKIP LOCKED
      ) picked
      WHERE q.id = picked.id
      RETURNING picked.id::text AS queue_id,
                picked.tenant_id::text AS tenant_id,
                picked.organisationsnummer::text AS organisationsnummer
      `,
      [batchSize],
    );

    const rows = extractQueryRowArray(raw);

    let ok = 0;
    for (const r of rows) {
      const { rowId, tenantId, organisationNumber, rawForLog } = parseOwnershipQueueDrainRow(r);
      if (!tenantId || !organisationNumber) {
        this.trackMalformedRow(rowId, tenantId, organisationNumber, rawForLog, r);
        continue;
      }
      try {
        await this.syncFromLatestFiSnapshot(tenantId, organisationNumber);
        ok += 1;
      } catch (e) {
        this.logger.warn(
          `ownership BV ingest failed tenant=${tenantId} org=${organisationNumber}: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    }
    return ok;
  }

  private trackMalformedRow(
    rowId: string,
    tenantId: string,
    organisationNumber: string,
    rawRow?: Record<string, unknown>,
    /** Original driver value when shape is unexpected (logged once per window, truncated). */
    rawOriginal?: unknown,
  ): void {
    const now = Date.now();
    const windowMs = 60_000;
    if (now - this.malformedRowLogState.windowStart >= windowMs) {
      if (this.malformedRowLogState.count > 0) {
        const latestId = this.malformedRowLogState.lastQueueId || 'n/a';
        this.logger.warn(
          `Skipped ${this.malformedRowLogState.count} malformed ownership ingest rows in the last minute (latest queue_id=${latestId}).`,
        );
      }
      this.malformedRowLogState = { windowStart: now, count: 0, lastQueueId: '' };
    }
    this.malformedRowLogState.count += 1;
    if (rowId) {
      this.malformedRowLogState.lastQueueId = rowId;
    }
    if (this.malformedRowLogState.count === 1) {
      const keys = rawRow ? Object.keys(rawRow).sort().join(',') : '';
      const detail =
        `Skipping malformed ownership ingest row id=${rowId || 'n/a'} tenant=${tenantId || 'n/a'} org=${organisationNumber || 'n/a'}` +
        (keys ? ` (row keys: ${keys})` : '');
      if (!keys) {
        const type = rawOriginal === null ? 'null' : Array.isArray(rawOriginal) ? 'array' : typeof rawOriginal;
        let sample: string;
        if (type === 'array') {
          sample = `length=${(rawOriginal as unknown[]).length}`;
        } else if (type === 'object' && rawOriginal) {
          try {
            sample = JSON.stringify(rawOriginal).slice(0, 240);
          } catch {
            sample = '[unserializable]';
          }
        } else {
          sample = String(type);
        }
        this.logger.warn(
          `${detail} — empty decoded row (${type}: ${sample}). Queue rows were already marked processed_at; fix decoding or re-enqueue affected ids from DB audit.`,
        );
      } else {
        this.logger.debug(detail);
      }
    }
  }

  /**
   * Rebuild BV-sourced ownership rows for one org from bv_parsed.v_fi_organisation_latest.
   */
  async syncFromLatestFiSnapshot(tenantId: string, organisationsnummer: string): Promise<void> {
    const safeTenantId = tenantId?.trim();
    const safeOrg = organisationsnummer?.trim();
    if (!safeTenantId || !safeOrg) {
      return;
    }
    const fiRows = await this.dataSource.query<FiLatestRow[]>(
      `
      SELECT id::text AS id,
             raw_item,
             organisationsnummer,
             organisationsnamn,
             payload_created_at,
             snapshot_id::text AS snapshot_id
      FROM bv_parsed.v_fi_organisation_latest
      WHERE tenant_id = $1::uuid AND organisationsnummer = $2
      LIMIT 1
      `,
      [safeTenantId, safeOrg],
    );
    const fi = fiRows[0];
    if (!fi?.raw_item || typeof fi.raw_item !== 'object') {
      this.logger.debug(`No FI parsed snapshot for ${safeOrg} (tenant ${safeTenantId}); skipping ingest`);
      return;
    }

    const rawItem = fi.raw_item as Record<string, unknown>;
    const fiSnapshotId = Number(fi.id);
    const edges = extractOwnershipEdgesFromFiOrganisationRaw(rawItem, safeOrg);
    const shareSummary = extractAktieslagVotingSummary(rawItem);

    const validFrom = fi.payload_created_at ? new Date(fi.payload_created_at) : new Date();
    const validFromDay = new Date(validFrom.getTime());
    validFromDay.setUTCHours(0, 0, 0, 0);

    await this.dataSource.transaction(async (em) => {
      await em
        .createQueryBuilder()
        .update(OwnershipLinkEntity)
        .set({
          isCurrent: false,
          validTo: validFromDay,
        })
        .where({
          tenantId,
          ownedOrganisationNumber: safeOrg,
          isCurrent: true,
          ingestionSource: BV_FI_ORG_ENGAGEMENT_INGESTION_SOURCE,
        })
        .execute();

      if (edges.length === 0) {
        return;
      }

      const baseLineage = {
        bolagsverket: {
          fiParsedSnapshotId: fiSnapshotId,
          bvFetchSnapshotId: fi.snapshot_id,
          payloadCreatedAt: fi.payload_created_at,
          shareClassesSummary: shareSummary,
        },
      };

      for (const edge of edges) {
        const link = em.getRepository(OwnershipLinkEntity).create({
          tenantId,
          ownerType: edge.ownerType,
          ownerName: edge.ownerName,
          ownerPersonId: null,
          ownerCompanyId: null,
          ownerOrganisationNumber: edge.ownerOrganisationNumber,
          ownerPersonnummer: edge.ownerPersonnummer,
          ownedCompanyId: null,
          ownedOrganisationNumber: edge.ownedOrganisationNumber,
          ownedCompanyName: edge.ownedCompanyName,
          ownershipPercentage: edge.ownershipPercentage,
          ownershipType: edge.ownershipType,
          ownershipClass: edge.ownershipClass,
          controlPercentage: edge.controlPercentage,
          validFrom: validFromDay,
          validTo: null,
          isCurrent: true,
          ingestionSource: BV_FI_ORG_ENGAGEMENT_INGESTION_SOURCE,
          fiParsedSnapshotId: Number.isFinite(fiSnapshotId) ? fiSnapshotId : null,
          dedupeKey: edge.dedupeKey,
          sourceData: {
            ...baseLineage,
            rawEngagement: edge.rawEngagement,
            interpretation: {
              legalOwnershipPct: edge.ownershipPercentage,
              votingControlPct: edge.controlPercentage,
              note:
                edge.controlPercentage == null
                  ? 'Bolagsverket FI did not provide voting % distinct from legal stake for this engagement; graph falls back to legal % where applicable.'
                  : null,
            },
          },
        });
        await em.getRepository(OwnershipLinkEntity).save(link);
      }
    });
  }
}

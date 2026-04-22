import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { OwnershipLinkEntity } from './entities/ownership-link.entity';
import {
  extractAktieslagVotingSummary,
  extractOwnershipEdgesFromFiOrganisationRaw,
} from './ownership-bv-extract.util';

export const BV_FI_ORG_ENGAGEMENT_INGESTION_SOURCE = 'bolagsverket_fi.organisationsengagemang';

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

  constructor(private readonly dataSource: DataSource) {}

  /**
   * Drain rows enqueued by bv_pipeline.process_refresh_queue after bv_read refresh.
   */
  async drainIngestQueue(batchSize = 25): Promise<number> {
    const rows = await this.dataSource.query<
      { id: string; tenant_id: string; organisationsnummer: string }[]
    >(
      `
      WITH picked AS (
        SELECT id FROM bv_pipeline.ownership_ingest_queue
        WHERE processed_at IS NULL
          AND tenant_id IS NOT NULL
          AND organisationsnummer IS NOT NULL
          AND NULLIF(TRIM(organisationsnummer), '') IS NOT NULL
        ORDER BY id
        LIMIT $1
        FOR UPDATE SKIP LOCKED
      )
      UPDATE bv_pipeline.ownership_ingest_queue q
      SET processed_at = NOW()
      FROM picked
      WHERE q.id = picked.id
      RETURNING q.id, q.tenant_id::text, q.organisationsnummer
      `,
      [batchSize],
    );

    let ok = 0;
    for (const r of rows) {
      if (!r.tenant_id || !r.organisationsnummer) {
        this.logger.debug(`Skipping malformed ownership ingest row id=${r.id} tenant=${r.tenant_id} org=${r.organisationsnummer}`);
        continue;
      }
      try {
        await this.syncFromLatestFiSnapshot(r.tenant_id, r.organisationsnummer);
        ok += 1;
      } catch (e) {
        this.logger.warn(
          `ownership BV ingest failed tenant=${r.tenant_id} org=${r.organisationsnummer}: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    }
    return ok;
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

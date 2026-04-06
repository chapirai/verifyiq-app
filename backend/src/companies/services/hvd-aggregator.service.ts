import { Injectable, Logger } from '@nestjs/common';
import {
  HighValueDatasetResponse,
  HvdAddress as HvdApiAddress,
  HvdOrganisation,
  HvdOrganisationStatus,
} from '../integrations/bolagsverket.types';
import { extractKodKlartext } from '../integrations/bolagsverket.mapper';
import { DataIngestionLogService } from './data-ingestion-log.service';

// ── Public types ──────────────────────────────────────────────────────────────

export interface HvdDataQuality {
  completenessScore: number;
  missingFields: string[];
  errorSources: string[];
  lastUpdated: string;
}

export interface HvdUnifiedAddress {
  type: string | null;
  street: string | null;
  postalCode: string | null;
  city: string | null;
  country: string | null;
}

export interface HvdUnifiedOrganisation {
  id: string;
  type: string | null;
  primaryName: string | null;
  secondaryNames: string[];
  legalForm: string | null;
  status: string | null;
  registeredAt: string | null;
  deregisteredAt: string | null;
  address: HvdUnifiedAddress | null;
  industries: string[];
  flags: Record<string, boolean>;
  dataQuality: HvdDataQuality;
}

export interface HvdAggregationResult {
  organisation: HvdUnifiedOrganisation;
  /** Raw historical records (index > 0 after sorting by registreringsdatum). */
  historicalRecords: HvdOrganisation[];
  /** True when the result was produced from partial / incomplete data. */
  isPartial: boolean;
}

// ── Field catalogue (used for completeness scoring) ──────────────────────────

const TRACKED_FIELDS = [
  'id',
  'primaryName',
  'legalForm',
  'status',
  'registeredAt',
  'address',
  'industries',
] as const;

// ── Service ───────────────────────────────────────────────────────────────────

/**
 * Aggregates Värdefulla datamängder (HVD) responses into a unified internal
 * model.
 *
 * Key responsibilities (spec: §5 Data Aggregator):
 *  1. Collect all available data fragments
 *  2. Validate each field – discard fields that carry a `fel` error object
 *  3. Merge valid data into a unified organisation model
 *  4. Assign a DataQuality score (0–100)
 *  5. Handle multi-record responses (sort by registreringsdatum, pick latest)
 */
@Injectable()
export class HvdAggregatorService {
  private readonly logger = new Logger(HvdAggregatorService.name);

  constructor(private readonly ingestionLogService: DataIngestionLogService) {}

  /**
   * Aggregate an HVD API response into a single unified organisation record.
   *
   * Handles:
   *  - Single-record responses (`organisation: {...}`)
   *  - Multi-record responses  (`organisationer: [{...}, {...}]`)
   *  - Field-level `fel` objects (mark field null, record error)
   *  - Full failure responses  (returns partial result with completeness = 0)
   */
  async aggregate(
    hvdResponse: HighValueDatasetResponse | null | undefined,
    context?: { tenantId?: string; organisationId?: string },
  ): Promise<HvdAggregationResult> {
    if (!hvdResponse) {
      return this.buildEmptyResult(context);
    }

    // ── Collect all records ──────────────────────────────────────────────────
    const allRecords: HvdOrganisation[] = hvdResponse.organisationer
      ? [...hvdResponse.organisationer]
      : hvdResponse.organisation
        ? [hvdResponse.organisation]
        : [];

    if (allRecords.length === 0) {
      this.logger.warn('[HvdAggregatorService] Response contains no organisation records');
      return this.buildEmptyResult(context);
    }

    // ── Sort by registreringsdatum descending (latest first) ─────────────────
    const sorted = [...allRecords].sort((a, b) => {
      const aDate = a.registreringsdatum ?? '';
      const bDate = b.registreringsdatum ?? '';
      return bDate.localeCompare(aDate);
    });

    const primary = sorted[0];
    const historical = sorted.slice(1);

    const errorSources: string[] = [];
    const missingFields: string[] = [];

    // ── Extract fields, stripping fel objects ────────────────────────────────
    const id = this.safeField(primary.identitetsbeteckning, 'identitetsbeteckning', errorSources);
    const primaryName = this.safeField(primary.namn, 'namn', errorSources);
    const legalForm = this.safeField(primary.organisationsform, 'organisationsform', errorSources);

    const statusList: HvdOrganisationStatus[] = primary.organisationsstatusar ?? [];
    const status: string | null = statusList.length > 0
      ? extractKodKlartext(statusList[0].status) ?? null
      : null;

    const registeredAt = this.safeField(primary.registreringsdatum, 'registreringsdatum', errorSources);

    let deregisteredAt: string | null = null;
    if (primary.avregistreringsinformation?.fel) {
      errorSources.push('avregistreringsinformation');
    } else {
      deregisteredAt = primary.avregistreringsinformation?.avregistreringsdatum ?? null;
    }

    const address = this.extractAddress(primary.adresser, errorSources);

    const industries: string[] = (primary.snikoder ?? [])
      .filter((s) => !s.fel)
      .map((s) => s.snikod ?? '')
      .filter(Boolean);

    if (primary.snikoder?.some((s) => s.fel)) {
      errorSources.push('snikoder');
    }

    // Log field-level errors to DataIngestionLogService
    for (const src of errorSources) {
      await this.ingestionLogService.log({
        provider: 'vardefulla_datamangder',
        endpoint: '/vardefulla-datamangder/v1/organisationer',
        organisationId: id ?? context?.organisationId ?? null,
        dataset: 'organisationer',
        field: src,
        errorType: 'OTILLGANGLIG_UPPGIFTSKALLA',
        tenantId: context?.tenantId ?? null,
      });
    }

    // ── Flags (liquidation, bankruptcy, etc.) ────────────────────────────────
    const flags: Record<string, boolean> = {};
    for (const st of statusList) {
      const s = (extractKodKlartext(st.status) ?? '').toLowerCase();
      if (s.includes('likvidation')) flags['inLiquidation'] = true;
      if (s.includes('konkurs')) flags['bankrupt'] = true;
      if (s.includes('avregistrerad')) flags['deregistered'] = true;
      if (s.includes('aktiv')) flags['active'] = true;
    }
    if (primary.rekonstruktionsstatus && !primary.rekonstruktionsstatus.fel) {
      flags['inRestructuring'] = true;
    }

    // ── Data quality scoring ─────────────────────────────────────────────────
    const populated: Record<string, boolean> = {
      id: !!id,
      primaryName: !!primaryName,
      legalForm: !!legalForm,
      status: !!status,
      registeredAt: !!registeredAt,
      address: !!address,
      industries: industries.length > 0,
    };

    for (const f of TRACKED_FIELDS) {
      if (!populated[f]) missingFields.push(f);
    }

    const completenessScore = Math.round(
      (TRACKED_FIELDS.filter((f) => populated[f]).length / TRACKED_FIELDS.length) * 100,
    );

    const dataQuality: HvdDataQuality = {
      completenessScore,
      missingFields,
      errorSources,
      lastUpdated: new Date().toISOString(),
    };

    const unified: HvdUnifiedOrganisation = {
      id: id ?? '',
      type: legalForm,
      primaryName,
      secondaryNames: [],
      legalForm,
      status,
      registeredAt,
      deregisteredAt,
      address,
      industries,
      flags,
      dataQuality,
    };

    return {
      organisation: unified,
      historicalRecords: historical,
      isPartial: errorSources.length > 0 || missingFields.length > 0,
    };
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  /**
   * Safely return a scalar field value. If the value is an object with `fel`,
   * treat it as an error: push the field name to errorSources and return null.
   */
  private safeField(
    value: unknown,
    fieldName: string,
    errorSources: string[],
  ): string | null {
    if (value == null) return null;
    if (typeof value === 'object' && (value as { fel?: unknown }).fel) {
      errorSources.push(fieldName);
      return null;
    }
    return String(value);
  }

  private extractAddress(
    adresser: HvdApiAddress[] | undefined,
    errorSources: string[],
  ): HvdUnifiedAddress | null {
    if (!adresser || adresser.length === 0) return null;

    const primary = adresser[0];
    if ((primary as { fel?: unknown }).fel) {
      errorSources.push('adresser');
      return null;
    }

    return {
      type: primary.adresstyp ?? null,
      street: primary.gatuadress ?? null,
      postalCode: primary.postnummer ?? null,
      city: primary.postort ?? null,
      country: primary.land ?? 'SE',
    };
  }

  private buildEmptyResult(
    context?: { tenantId?: string; organisationId?: string },
  ): HvdAggregationResult {
    const dataQuality: HvdDataQuality = {
      completenessScore: 0,
      missingFields: [...TRACKED_FIELDS],
      errorSources: ['full_response'],
      lastUpdated: new Date().toISOString(),
    };

    void this.ingestionLogService.log({
      provider: 'vardefulla_datamangder',
      endpoint: '/vardefulla-datamangder/v1/organisationer',
      organisationId: context?.organisationId ?? null,
      dataset: 'organisationer',
      field: null,
      errorType: 'FULL_RESPONSE_UNAVAILABLE',
      tenantId: context?.tenantId ?? null,
    });

    return {
      organisation: {
        id: context?.organisationId ?? '',
        type: null,
        primaryName: null,
        secondaryNames: [],
        legalForm: null,
        status: null,
        registeredAt: null,
        deregisteredAt: null,
        address: null,
        industries: [],
        flags: {},
        dataQuality,
      },
      historicalRecords: [],
      isPartial: true,
    };
  }
}

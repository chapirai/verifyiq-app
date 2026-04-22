import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CompanyEntity } from '../companies/entities/company.entity';
import { BvBulkCompanyCurrentEntity } from './entities/bv-bulk-company-current.entity';
import { BvBulkCompanyHistoryEntity } from './entities/bv-bulk-company-history.entity';
import { BvBulkCompanyStagingEntity } from './entities/bv-bulk-company-staging.entity';

@Injectable()
export class BolagsverketBulkUpsertService {
  constructor(
    @InjectRepository(BvBulkCompanyStagingEntity)
    private readonly stagingRepo: Repository<BvBulkCompanyStagingEntity>,
    @InjectRepository(BvBulkCompanyCurrentEntity)
    private readonly currentRepo: Repository<BvBulkCompanyCurrentEntity>,
    @InjectRepository(BvBulkCompanyHistoryEntity)
    private readonly historyRepo: Repository<BvBulkCompanyHistoryEntity>,
    @InjectRepository(CompanyEntity)
    private readonly companyRepo: Repository<CompanyEntity>,
  ) {}

  private deriveNameList(raw: string | null): Array<Record<string, unknown>> {
    if (!raw) return [];
    return raw
      .split('|')
      .map(x => x.trim())
      .filter(Boolean)
      .map(x => {
        const p = x.split('$').map(v => v.trim());
        return {
          name: p[0] ?? null,
          type: p[1] ?? null,
          effectiveDate: p[2] ?? null,
        };
      });
  }

  async applyStagingToCurrent(fileRunId: string, runAt: Date): Promise<{ upserted: number; changed: number }> {
    const rows = await this.stagingRepo.find({ where: { fileRunId } });
    let changed = 0;

    for (const row of rows) {
      const org = (row.identityValue ?? '').replace(/\D/g, '');
      if (!org) continue;
      const existing = await this.currentRepo.findOne({ where: { organisationNumber: org } });
      const nameList = this.deriveNameList(row.organisationNamesRaw);
      const payload: Partial<BvBulkCompanyCurrentEntity> = {
        organisationNumber: org,
        identityType: row.identityType,
        namePrimary: row.organisationNamesRaw?.split('$')[0] ?? row.identityValue ?? null,
        nameAllJsonb: nameList,
        organisationFormCode: row.organisationFormCode,
        organisationFormText: row.organisationFormCode,
        registrationDate: row.registrationDate,
        deregistrationDate: row.deregistrationDate,
        deregistrationReasonCode: row.deregistrationReasonCode,
        deregistrationReasonText: row.deregistrationReasonText,
        restructuringStatusJsonb: { raw: row.restructuringRaw },
        businessDescription: row.businessDescription,
        postalAddressJsonb: {
          raw: row.postalAddressRaw,
          deliveryAddress: row.deliveryAddress,
          coAddress: row.coAddress,
          postalCode: row.postalCode,
          city: row.city,
          countryCode: row.countryCode,
        },
        registrationsCountryCode: row.registrationCountryCode,
        sourceFileRunId: fileRunId,
        sourceLastSeenAt: runAt,
        firstSeenAt: existing?.firstSeenAt ?? runAt,
        lastSeenAt: runAt,
        currentRecordHash: row.contentHash,
        isDeregistered: !!row.deregistrationDate,
        isActive: !row.deregistrationDate,
      };

      const isNew = !existing;
      const isChanged = existing?.currentRecordHash !== row.contentHash;
      if (isChanged || isNew) changed += 1;

      const saved = await this.currentRepo.save(this.currentRepo.create({ ...(existing ?? {}), ...payload }));
      await this.historyRepo.save(
        this.historyRepo.create({
          organisationNumber: org,
          fileRunId,
          changeType: isNew ? 'new' : isChanged ? 'updated' : 'unchanged',
          snapshotJsonb: payload as Record<string, unknown>,
          recordHash: row.contentHash,
          validFrom: runAt,
          validTo: null,
        }),
      );
      if (!isNew && isChanged) {
        await this.historyRepo
          .createQueryBuilder()
          .update(BvBulkCompanyHistoryEntity)
          .set({ validTo: runAt })
          .where('organisation_number = :org', { org })
          .andWhere('file_run_id <> :fileRunId', { fileRunId })
          .andWhere('valid_to IS NULL')
          .execute();
      }

      void saved;
    }

    return { upserted: rows.length, changed };
  }

  async detectRemovedCompanies(fileRunId: string, runAt: Date): Promise<number> {
    const missing = await this.currentRepo
      .createQueryBuilder('c')
      .where('c.source_file_run_id IS NOT NULL')
      .andWhere('c.source_file_run_id <> :fileRunId', { fileRunId })
      .getMany();
    let removed = 0;
    for (const row of missing) {
      await this.historyRepo.save(
        this.historyRepo.create({
          organisationNumber: row.organisationNumber,
          fileRunId,
          changeType: 'removed',
          snapshotJsonb: {
            organisationNumber: row.organisationNumber,
            previousSourceFileRunId: row.sourceFileRunId,
          },
          recordHash: row.currentRecordHash,
          validFrom: runAt,
          validTo: null,
        }),
      );
      await this.currentRepo.update({ id: row.id }, { isActive: false, lastSeenAt: runAt });
      removed += 1;
    }
    return removed;
  }

  async seedCompaniesFromCurrent(defaultTenantId: string): Promise<number> {
    if (!defaultTenantId) return 0;
    const rows = await this.currentRepo.find({ take: 100000 });
    for (const row of rows) {
      const existing = await this.companyRepo.findOne({
        where: {
          tenantId: defaultTenantId,
          organisationNumber: row.organisationNumber,
        },
      });
      const sourcePayloadSummary = {
        ...(existing?.sourcePayloadSummary ?? {}),
        depth_state: row.seedState,
        depth_source: 'bolagsverket_bulk',
        source_file_run_id: row.sourceFileRunId,
      };
      const entity = this.companyRepo.create({
        ...(existing ?? {}),
        tenantId: defaultTenantId,
        organisationNumber: row.organisationNumber,
        legalName: row.namePrimary ?? existing?.legalName ?? row.organisationNumber,
        companyForm: row.organisationFormText ?? row.organisationFormCode,
        status: row.isDeregistered ? 'DEREGISTERED' : 'ACTIVE',
        registeredAt: row.registrationDate ? new Date(row.registrationDate) : null,
        countryCode: (row.registrationsCountryCode ?? 'SE').slice(0, 2).toUpperCase(),
        businessDescription: row.businessDescription,
        sourcePayloadSummary,
      });
      await this.companyRepo.save(entity);
    }
    return rows.length;
  }
}


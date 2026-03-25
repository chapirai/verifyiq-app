import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { RecordUsageDto } from './dto/record-usage.dto';
import { SetEntitlementDto } from './dto/set-entitlement.dto';
import { DatasetEntitlementEntity } from './entities/dataset-entitlement.entity';
import { DatasetUsageEventEntity } from './entities/dataset-usage-event.entity';

const ALL_DATASET_FAMILIES = [
  'company_info',
  'ownership',
  'beneficial_owner',
  'legal_events',
  'sanctions_pep',
  'person_data',
  'company_documents',
  'financial_data',
  'ratings',
  'property_data',
  'board_assignments',
  'group_tree',
  'workplace_data',
  'credit_decisioning',
] as const;

@Injectable()
export class EntitlementsService {
  constructor(
    @InjectRepository(DatasetEntitlementEntity)
    private readonly entitlementsRepo: Repository<DatasetEntitlementEntity>,
    @InjectRepository(DatasetUsageEventEntity)
    private readonly usageRepo: Repository<DatasetUsageEventEntity>,
    private readonly auditService: AuditService,
  ) {}

  async setEntitlement(tenantId: string, actorId: string | null, dto: SetEntitlementDto): Promise<DatasetEntitlementEntity> {
    let entitlement = await this.entitlementsRepo.findOne({
      where: { tenantId, datasetFamily: dto.datasetFamily },
    });

    if (entitlement) {
      if (dto.isEnabled !== undefined) entitlement.isEnabled = dto.isEnabled;
      if (dto.monthlyQuota !== undefined) entitlement.monthlyQuota = dto.monthlyQuota;
      if (dto.planTier !== undefined) entitlement.planTier = dto.planTier;
      if (dto.metadata !== undefined) entitlement.metadata = dto.metadata;
    } else {
      entitlement = this.entitlementsRepo.create({
        tenantId,
        datasetFamily: dto.datasetFamily,
        isEnabled: dto.isEnabled ?? true,
        monthlyQuota: dto.monthlyQuota ?? null,
        planTier: dto.planTier ?? null,
        metadata: dto.metadata ?? {},
      });
    }

    const saved = await this.entitlementsRepo.save(entitlement);

    await this.auditService.log({
      tenantId,
      actorId,
      action: 'entitlement.set',
      resourceType: 'dataset_entitlement',
      resourceId: saved.id,
      metadata: dto as unknown as Record<string, unknown>,
    });

    return saved;
  }

  listEntitlements(tenantId: string): Promise<DatasetEntitlementEntity[]> {
    return this.entitlementsRepo.find({
      where: { tenantId },
      order: { datasetFamily: 'ASC' },
    });
  }

  async checkEntitlement(tenantId: string, datasetFamily: string): Promise<boolean> {
    const entitlement = await this.entitlementsRepo.findOne({
      where: { tenantId, datasetFamily },
    });

    if (!entitlement || !entitlement.isEnabled) return false;
    if (entitlement.monthlyQuota === null || entitlement.monthlyQuota === undefined) return true;
    return entitlement.currentMonthUsage < entitlement.monthlyQuota;
  }

  async recordUsage(tenantId: string, userId: string | null, dto: RecordUsageDto): Promise<DatasetUsageEventEntity> {
    const event = this.usageRepo.create({
      tenantId,
      userId: userId ?? null,
      datasetFamily: dto.datasetFamily,
      action: dto.action,
      resourceId: dto.resourceId ?? null,
      resourceType: dto.resourceType ?? null,
      billingUnits: dto.billingUnits ?? 1,
      metadata: dto.metadata ?? {},
    });

    const saved = await this.usageRepo.save(event);

    await this.entitlementsRepo
      .createQueryBuilder()
      .update(DatasetEntitlementEntity)
      .set({ currentMonthUsage: () => 'current_month_usage + :units' })
      .setParameter('units', dto.billingUnits ?? 1)
      .where('tenantId = :tenantId AND datasetFamily = :datasetFamily', {
        tenantId,
        datasetFamily: dto.datasetFamily,
      })
      .execute();

    return saved;
  }

  async getUsageSummary(
    tenantId: string,
    fromDate?: Date,
    toDate?: Date,
  ): Promise<Array<{ datasetFamily: string; totalCalls: number; totalUnits: number }>> {
    const qb = this.usageRepo
      .createQueryBuilder('e')
      .select('e.datasetFamily', 'datasetFamily')
      .addSelect('COUNT(*)', 'totalCalls')
      .addSelect('SUM(e.billingUnits)', 'totalUnits')
      .where('e.tenantId = :tenantId', { tenantId })
      .groupBy('e.datasetFamily')
      .orderBy('e.datasetFamily', 'ASC');

    if (fromDate) qb.andWhere('e.occurredAt >= :fromDate', { fromDate });
    if (toDate) qb.andWhere('e.occurredAt <= :toDate', { toDate });

    const rows = await qb.getRawMany<{ datasetFamily: string; totalCalls: string; totalUnits: string }>();

    return rows.map((r) => ({
      datasetFamily: r.datasetFamily,
      totalCalls: parseInt(r.totalCalls, 10),
      totalUnits: parseInt(r.totalUnits, 10),
    }));
  }

  listUsageEvents(
    tenantId: string,
    datasetFamily?: string,
    limit = 100,
  ): Promise<DatasetUsageEventEntity[]> {
    const qb = this.usageRepo
      .createQueryBuilder('e')
      .where('e.tenantId = :tenantId', { tenantId })
      .orderBy('e.occurredAt', 'DESC')
      .limit(limit);

    if (datasetFamily) qb.andWhere('e.datasetFamily = :datasetFamily', { datasetFamily });

    return qb.getMany();
  }

  async initializeDefaultEntitlements(tenantId: string): Promise<DatasetEntitlementEntity[]> {
    const results: DatasetEntitlementEntity[] = [];

    for (const family of ALL_DATASET_FAMILIES) {
      const existing = await this.entitlementsRepo.findOne({
        where: { tenantId, datasetFamily: family },
      });

      if (!existing) {
        const entitlement = this.entitlementsRepo.create({
          tenantId,
          datasetFamily: family,
          isEnabled: true,
          monthlyQuota: null,
          metadata: {},
        });
        results.push(await this.entitlementsRepo.save(entitlement));
      } else {
        results.push(existing);
      }
    }

    return results;
  }
}

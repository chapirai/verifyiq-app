import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { CreateRiskIndicatorConfigDto } from './dto/create-risk-indicator-config.dto';
import { EvaluateIndicatorsDto } from './dto/evaluate-indicators.dto';
import { RiskIndicatorConfigEntity } from './entities/risk-indicator-config.entity';
import { RiskIndicatorResultEntity } from './entities/risk-indicator-result.entity';

@Injectable()
export class RiskIndicatorsService {
  constructor(
    @InjectRepository(RiskIndicatorConfigEntity)
    private readonly configsRepo: Repository<RiskIndicatorConfigEntity>,
    @InjectRepository(RiskIndicatorResultEntity)
    private readonly resultsRepo: Repository<RiskIndicatorResultEntity>,
    private readonly auditService: AuditService,
  ) {}

  async createConfig(tenantId: string, actorId: string | undefined, dto: CreateRiskIndicatorConfigDto) {
    const config = this.configsRepo.create({
      tenantId,
      name: dto.name,
      category: dto.category,
      description: dto.description ?? null,
      datasetFamily: dto.datasetFamily ?? null,
      isEnabled: dto.isEnabled ?? true,
      severity: dto.severity ?? 'medium',
      threshold: dto.threshold ?? {},
      conditionLogic: dto.conditionLogic ?? {},
      metadata: dto.metadata ?? {},
      createdByUserId: actorId ?? null,
    });
    const saved = await this.configsRepo.save(config);
    await this.auditService.log({
      tenantId,
      actorId: actorId ?? null,
      action: 'risk_indicator.config.created',
      resourceType: 'risk_indicator_config',
      resourceId: saved.id,
      metadata: dto,
    });
    return saved;
  }

  listConfigs(tenantId: string, category?: string) {
    const where: Record<string, unknown> = { tenantId };
    if (category) where['category'] = category;
    return this.configsRepo.find({ where, order: { createdAt: 'DESC' } });
  }

  async evaluateIndicators(
    tenantId: string,
    actorId: string | undefined,
    dto: EvaluateIndicatorsDto,
  ) {
    const configs = await this.configsRepo.find({ where: { tenantId, isEnabled: true } });
    const results: RiskIndicatorResultEntity[] = [];

    for (const config of configs) {
      const isTriggered = this.evaluateConditionLogic(config.conditionLogic, dto.entityData ?? {});
      const result = this.resultsRepo.create({
        tenantId,
        configId: config.id,
        indicatorName: config.name,
        indicatorCategory: config.category,
        organisationNumber: dto.organisationNumber,
        entityType: 'company',
        isTriggered,
        severity: isTriggered ? config.severity : null,
        triggerReason: isTriggered ? `Condition matched for indicator: ${config.name}` : null,
        triggerDetails: isTriggered ? { conditionLogic: config.conditionLogic } : {},
      });
      const saved = await this.resultsRepo.save(result);
      results.push(saved);
    }

    await this.auditService.log({
      tenantId,
      actorId: actorId ?? null,
      action: 'risk_indicator.evaluated',
      resourceType: 'risk_indicator_result',
      resourceId: dto.organisationNumber,
      metadata: { organisationNumber: dto.organisationNumber, resultsCount: results.length },
    });

    return results;
  }

  private evaluateConditionLogic(
    conditionLogic: Record<string, unknown>,
    entityData: Record<string, unknown>,
  ): boolean {
    const conditions = conditionLogic['conditions'] as Array<Record<string, unknown>> | undefined;
    if (!conditions || conditions.length === 0) return false;
    return conditions.some((condition) => {
      const field = condition['field'] as string;
      const operator = condition['operator'] as string;
      const value = condition['value'];
      const entityValue = entityData[field];
      if (operator === 'equals') return entityValue === value;
      if (operator === 'not_equals') return entityValue !== value;
      if (operator === 'exists') return entityValue !== undefined && entityValue !== null;
      if (operator === 'gt' && typeof entityValue === 'number' && typeof value === 'number') return entityValue > value;
      if (operator === 'lt' && typeof entityValue === 'number' && typeof value === 'number') return entityValue < value;
      return false;
    });
  }

  listResults(tenantId: string, organisationNumber?: string) {
    const where: Record<string, unknown> = { tenantId };
    if (organisationNumber) where['organisationNumber'] = organisationNumber;
    return this.resultsRepo.find({ where, order: { evaluatedAt: 'DESC' } });
  }
}

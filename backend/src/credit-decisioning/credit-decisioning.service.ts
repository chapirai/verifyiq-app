import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { CreateCreditDecisionTemplateDto } from './dto/create-credit-decision-template.dto';
import { RunCreditDecisionDto } from './dto/run-credit-decision.dto';
import { CreditDecisionResultEntity } from './entities/credit-decision-result.entity';
import { CreditDecisionTemplateEntity } from './entities/credit-decision-template.entity';

const STUB_TENANT_ID = '00000000-0000-0000-0000-000000000001';

type RuleOperator = 'gt' | 'lt' | 'gte' | 'lte' | 'eq' | 'neq' | 'in' | 'not_in';

interface DecisionRule {
  field: string;
  operator: RuleOperator;
  threshold: unknown;
  action: 'approve' | 'reject' | 'manual_review' | 'score';
  weight?: number;
  reason?: string;
}

function evaluateRule(rule: DecisionRule, inputData: Record<string, unknown>): boolean {
  const value = inputData[rule.field];
  const threshold = rule.threshold;

  switch (rule.operator) {
    case 'gt':  return (value as number) > (threshold as number);
    case 'lt':  return (value as number) < (threshold as number);
    case 'gte': return (value as number) >= (threshold as number);
    case 'lte': return (value as number) <= (threshold as number);
    case 'eq':  return value === threshold;
    case 'neq': return value !== threshold;
    case 'in':  return Array.isArray(threshold) && threshold.includes(value);
    case 'not_in': return Array.isArray(threshold) && !threshold.includes(value);
    default:    return false;
  }
}

@Injectable()
export class CreditDecisioningService {
  constructor(
    @InjectRepository(CreditDecisionTemplateEntity)
    private readonly templatesRepo: Repository<CreditDecisionTemplateEntity>,
    @InjectRepository(CreditDecisionResultEntity)
    private readonly resultsRepo: Repository<CreditDecisionResultEntity>,
    private readonly auditService: AuditService,
  ) {}

  async createTemplate(tenantId: string, actorId: string | null, dto: CreateCreditDecisionTemplateDto) {
    const template = this.templatesRepo.create({
      tenantId,
      name: dto.name,
      description: dto.description ?? null,
      isActive: dto.isActive ?? true,
      targetEntityType: dto.targetEntityType ?? 'company',
      rules: dto.rules ?? [],
      approveConditions: dto.approveConditions ?? {},
      rejectConditions: dto.rejectConditions ?? {},
      manualReviewConditions: dto.manualReviewConditions ?? {},
      metadata: dto.metadata ?? {},
      createdByUserId: actorId,
    });
    const saved = await this.templatesRepo.save(template);
    await this.auditService.log({
      tenantId,
      actorId,
      action: 'credit_decision.template.created',
      resourceType: 'credit_decision_template',
      resourceId: saved.id,
      metadata: dto,
    });
    return saved;
  }

  listTemplates(tenantId: string) {
    return this.templatesRepo.find({
      where: { tenantId, isActive: true },
      order: { createdAt: 'DESC' },
    });
  }

  async getTemplate(tenantId: string, templateId: string) {
    const template = await this.templatesRepo.findOne({ where: { id: templateId, tenantId } });
    if (!template) throw new NotFoundException('Template not found');
    return template;
  }

  async runDecision(tenantId: string, actorId: string | null, dto: RunCreditDecisionDto) {
    let template: CreditDecisionTemplateEntity | null = null;
    if (dto.templateId) {
      template = await this.templatesRepo.findOne({ where: { id: dto.templateId, tenantId } });
      if (!template) throw new NotFoundException('Template not found');
    }

    const rules: DecisionRule[] = (template?.rules ?? []) as DecisionRule[];
    const inputData: Record<string, unknown> = dto.inputData ?? {};
    const ruleResults: Array<Record<string, unknown>> = [];
    let score = 0;
    let forceReject = false;
    let forceApprove = false;
    let forceManualReview = false;

    for (const rule of rules) {
      const passed = evaluateRule(rule, inputData);
      ruleResults.push({
        field: rule.field,
        operator: rule.operator,
        threshold: rule.threshold,
        action: rule.action,
        weight: rule.weight ?? 0,
        passed,
        reason: rule.reason ?? null,
      });

      if (passed) {
        if (rule.action === 'reject') forceReject = true;
        else if (rule.action === 'approve') forceApprove = true;
        else if (rule.action === 'manual_review') forceManualReview = true;
        else if (rule.action === 'score') score += rule.weight ?? 0;
      }
    }

    let decision: 'approve' | 'reject' | 'manual_review';
    if (forceReject) {
      decision = 'reject';
    } else if (forceManualReview) {
      decision = 'manual_review';
    } else if (forceApprove) {
      decision = 'approve';
    } else {
      const approveConditions = (template?.approveConditions ?? {}) as { minScore?: number };
      const minScore = approveConditions.minScore ?? 0;
      decision = score >= minScore ? 'approve' : 'manual_review';
    }

    const reasons = ruleResults
      .filter((r) => r['passed'])
      .map((r) => ({ rule: r['field'], outcome: r['action'], reason: r['reason'] }));

    const result = this.resultsRepo.create({
      tenantId,
      templateId: template?.id ?? null,
      templateName: template?.name ?? null,
      organisationNumber: dto.organisationNumber ?? null,
      personnummer: dto.personnummer ?? null,
      entityType: dto.entityType ?? 'company',
      decision,
      score,
      reasons,
      ruleResults,
      inputData,
      requestedByUserId: actorId,
      decidedAt: new Date(),
    });

    const saved = await this.resultsRepo.save(result);
    await this.auditService.log({
      tenantId,
      actorId,
      action: 'credit_decision.result.created',
      resourceType: 'credit_decision_result',
      resourceId: saved.id,
      metadata: { decision, score, organisationNumber: dto.organisationNumber },
    });
    return saved;
  }

  listResults(tenantId: string, organisationNumber?: string) {
    const where: Record<string, unknown> = { tenantId };
    if (organisationNumber) where['organisationNumber'] = organisationNumber;
    return this.resultsRepo.find({ where, order: { decidedAt: 'DESC' } });
  }
}

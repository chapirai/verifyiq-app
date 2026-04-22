import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TenantContext } from '../../common/interfaces/tenant-context.interface';
import { FinancialStatementEntity } from '../../financial/entities/financial-statement.entity';
import { OwnershipLinkEntity } from '../../ownership/entities/ownership-link.entity';
import { CompanyDecisionSnapshotEntity } from '../entities/company-decision-snapshot.entity';
import { CompanyEntity } from '../entities/company.entity';
import { CompanySignalEntity } from '../entities/company-signal.entity';

export const DECISION_MODES = ['pe', 'credit', 'compliance'] as const;
export type DecisionMode = (typeof DECISION_MODES)[number];

type DecisionDriver = {
  key: string;
  value: unknown;
  meaning: string;
  source: { table: string; id: string | null; pointer: string | null };
};

function normalizeMode(raw?: string): DecisionMode {
  const m = (raw ?? 'pe').toLowerCase();
  return (DECISION_MODES as readonly string[]).includes(m) ? (m as DecisionMode) : 'pe';
}

function asNumber(score: string | null | undefined): number | null {
  if (score == null) return null;
  const n = Number(score);
  return Number.isFinite(n) ? n : null;
}

@Injectable()
export class CompanyDecisionService {
  constructor(
    @InjectRepository(CompanyEntity)
    private readonly companyRepo: Repository<CompanyEntity>,
    @InjectRepository(CompanySignalEntity)
    private readonly signalRepo: Repository<CompanySignalEntity>,
    @InjectRepository(FinancialStatementEntity)
    private readonly financialRepo: Repository<FinancialStatementEntity>,
    @InjectRepository(OwnershipLinkEntity)
    private readonly ownershipRepo: Repository<OwnershipLinkEntity>,
    @InjectRepository(CompanyDecisionSnapshotEntity)
    private readonly decisionSnapshotRepo: Repository<CompanyDecisionSnapshotEntity>,
  ) {}

  private scoreByType(rows: CompanySignalEntity[], type: string): { v: number | null; id: string | null } {
    const row = rows.find((r) => r.signalType === type);
    return { v: asNumber(row?.score), id: row?.id ?? null };
  }

  private weightedDecision(mode: DecisionMode, scores: Record<string, number | null>) {
    const s = (k: string) => scores[k] ?? null;
    const acq = s('acquisition_likelihood') ?? 0;
    const transition = s('ownership_transition_probability') ?? 0;
    const readiness = s('seller_readiness') ?? 0;
    const growth = s('growth_vs_stagnation') ?? 0;
    const complexity = s('compliance_ownership_complexity') ?? 0;
    const stress = s('financial_stress') ?? 0;
    const network = s('board_network_signals') ?? 0;

    let composite = 0;
    if (mode === 'pe') {
      composite = acq * 0.28 + readiness * 0.22 + growth * 0.2 + network * 0.12 + transition * 0.1 - stress * 0.06 - complexity * 0.04;
    } else if (mode === 'credit') {
      composite = (100 - stress) * 0.4 + growth * 0.18 + (100 - complexity) * 0.16 + network * 0.1 + readiness * 0.08 + acq * 0.08;
    } else {
      composite = (100 - complexity) * 0.34 + (100 - stress) * 0.24 + transition * 0.16 + network * 0.1 + readiness * 0.08 + growth * 0.08;
    }

    let recommendedAction = 'Monitor';
    if (mode === 'pe') {
      if (composite >= 68 && stress <= 50) recommendedAction = 'Prioritize outreach';
      else if (stress >= 70) recommendedAction = 'Watchlist / turnaround';
      else if (readiness >= 65) recommendedAction = 'Prepare approach hypothesis';
    } else if (mode === 'credit') {
      if (stress >= 75) recommendedAction = 'Tighten terms / high-risk review';
      else if (composite >= 70) recommendedAction = 'Credit-approve candidate';
      else recommendedAction = 'Further covenant diligence';
    } else {
      if (complexity >= 72) recommendedAction = 'Enhanced compliance diligence';
      else if (composite >= 72) recommendedAction = 'Standard diligence path';
      else recommendedAction = 'Monitor compliance signals';
    }
    return { composite, recommendedAction };
  }

  async generateInsight(ctx: TenantContext, organisationNumberRaw: string, modeRaw?: string, persist = false) {
    const organisationNumber = organisationNumberRaw.replace(/\D/g, '');
    if (organisationNumber.length !== 10 && organisationNumber.length !== 12) throw new NotFoundException('Invalid organisation number');
    const mode = normalizeMode(modeRaw);

    const company = await this.companyRepo.findOne({ where: { tenantId: ctx.tenantId, organisationNumber } });
    if (!company) throw new NotFoundException('Company not found');

    const [signals, latestFinancial, ownershipEdgeRows] = await Promise.all([
      this.signalRepo
        .createQueryBuilder('s')
        .distinctOn(['s.signalType'])
        .where('s.tenantId = :tenantId', { tenantId: ctx.tenantId })
        .andWhere('s.organisationNumber = :organisationNumber', { organisationNumber })
        .orderBy('s.signalType', 'ASC')
        .addOrderBy('s.computedAt', 'DESC')
        .getMany(),
      this.financialRepo.findOne({
        where: { tenantId: ctx.tenantId, organisationNumber },
        order: { fiscalYearEnd: 'DESC', updatedAt: 'DESC' },
      }),
      this.ownershipRepo.find({
        where: { tenantId: ctx.tenantId, ownedOrganisationNumber: organisationNumber, isCurrent: true },
        order: { updatedAt: 'DESC' },
        take: 5,
      }),
    ]);

    const scoreMap: Record<string, number | null> = {};
    const signalIds: Record<string, string | null> = {};
    for (const t of [
      'acquisition_likelihood',
      'ownership_transition_probability',
      'seller_readiness',
      'growth_vs_stagnation',
      'compliance_ownership_complexity',
      'financial_stress',
      'board_network_signals',
    ]) {
      const { v, id } = this.scoreByType(signals, t);
      scoreMap[t] = v;
      signalIds[t] = id;
    }

    const { composite, recommendedAction } = this.weightedDecision(mode, scoreMap);
    const confidence =
      signals.length >= 5 && latestFinancial != null && ownershipEdgeRows.length > 0 ? 'high' : signals.length >= 3 ? 'medium' : 'low';

    const drivers: DecisionDriver[] = [
      {
        key: `${mode}.composite`,
        value: Number(composite.toFixed(1)),
        meaning: 'Mode-weighted decision score (0-100).',
        source: { table: 'company_signals', id: signalIds['acquisition_likelihood'], pointer: null },
      },
      {
        key: 'financial_stress',
        value: scoreMap['financial_stress'],
        meaning: 'Stress signal contributes downside/risk weighting.',
        source: { table: 'company_signals', id: signalIds['financial_stress'], pointer: null },
      },
      {
        key: 'seller_readiness',
        value: scoreMap['seller_readiness'],
        meaning: 'Transactability/readiness proxy for near-term process.',
        source: { table: 'company_signals', id: signalIds['seller_readiness'], pointer: null },
      },
      {
        key: 'ownership_edges_current',
        value: ownershipEdgeRows.length,
        meaning: 'Current ownership-link density indicates structure complexity.',
        source: { table: 'ownership_links', id: ownershipEdgeRows[0]?.id ?? null, pointer: 'owned_organisation_number' },
      },
      {
        key: 'latest_fiscal_year',
        value: latestFinancial?.fiscalYear ?? null,
        meaning: 'Most recent parsed financial statement coverage.',
        source: { table: 'financial_statements', id: latestFinancial?.id ?? null, pointer: 'fiscal_year' },
      },
    ];

    const summary = `${company.legalName}: ${mode.toUpperCase()} composite ${composite.toFixed(1)} with stress ${
      scoreMap['financial_stress'] == null ? 'n/a' : scoreMap['financial_stress']!.toFixed(1)
    } and readiness ${
      scoreMap['seller_readiness'] == null ? 'n/a' : scoreMap['seller_readiness']!.toFixed(1)
    } — ${recommendedAction.toLowerCase()}.`;

    const response = {
      organisation_number: organisationNumber,
      legal_name: company.legalName,
      strategy_mode: mode,
      summary,
      recommended_action: recommendedAction,
      confidence,
      drivers,
      generated_at: new Date().toISOString(),
    };

    if (persist) {
      const snap = this.decisionSnapshotRepo.create({
        tenantId: ctx.tenantId,
        organisationNumber,
        strategyMode: mode,
        legalName: company.legalName,
        summary,
        recommendedAction,
        confidence,
        drivers: drivers as unknown as Array<Record<string, unknown>>,
        scores: scoreMap as Record<string, unknown>,
      });
      await this.decisionSnapshotRepo.save(snap);
    }

    return response;
  }

  async generateAndPersistAllModes(tenantId: string, organisationNumberRaw: string) {
    const ctx: TenantContext = { tenantId, actorId: null };
    const results = [];
    for (const mode of DECISION_MODES) {
      results.push(await this.generateInsight(ctx, organisationNumberRaw, mode, true));
    }
    return results;
  }

  async listHistory(ctx: TenantContext, organisationNumberRaw: string, modeRaw?: string, limit = 20) {
    const organisationNumber = organisationNumberRaw.replace(/\D/g, '');
    if (organisationNumber.length !== 10 && organisationNumber.length !== 12) throw new NotFoundException('Invalid organisation number');
    const mode = normalizeMode(modeRaw);
    const rows = await this.decisionSnapshotRepo.find({
      where: { tenantId: ctx.tenantId, organisationNumber, strategyMode: mode },
      order: { createdAt: 'DESC' },
      take: Math.min(Math.max(limit, 1), 200),
    });
    return rows.map((r) => ({
      id: r.id,
      organisation_number: r.organisationNumber,
      strategy_mode: r.strategyMode,
      summary: r.summary,
      recommended_action: r.recommendedAction,
      confidence: r.confidence,
      scores: r.scores,
      drivers: r.drivers,
      created_at: r.createdAt.toISOString(),
    }));
  }
}


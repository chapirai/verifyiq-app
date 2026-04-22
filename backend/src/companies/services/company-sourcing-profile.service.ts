import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { DataSource } from 'typeorm';
import { FinancialStatementEntity } from '../../financial/entities/financial-statement.entity';
import { OwnershipLinkEntity } from '../../ownership/entities/ownership-link.entity';
import { OwnershipService } from '../../ownership/ownership.service';
import { CompanySignalEntity } from '../entities/company-signal.entity';
import { CompanySourcingProfileEntity } from '../entities/company-sourcing-profile.entity';

type DealMode = 'founder_exit' | 'distressed' | 'roll_up';

@Injectable()
export class CompanySourcingProfileService {
  constructor(
    @InjectRepository(CompanySourcingProfileEntity)
    private readonly profileRepo: Repository<CompanySourcingProfileEntity>,
    @InjectRepository(CompanySignalEntity)
    private readonly signalRepo: Repository<CompanySignalEntity>,
    @InjectRepository(FinancialStatementEntity)
    private readonly financialRepo: Repository<FinancialStatementEntity>,
    @InjectRepository(OwnershipLinkEntity)
    private readonly ownershipRepo: Repository<OwnershipLinkEntity>,
    private readonly ownershipService: OwnershipService,
    private readonly dataSource: DataSource,
  ) {}

  private asScore(value: unknown): number {
    const n = Number(value);
    if (!Number.isFinite(n)) return 0;
    return Math.min(100, Math.max(0, n));
  }

  private signalScore(rows: CompanySignalEntity[], type: string): number {
    return this.asScore(rows.find((r) => r.signalType === type)?.score ?? 0);
  }

  private computeDealModeScores(
    signals: CompanySignalEntity[],
    ownershipRisk: number,
    latestFinancial: FinancialStatementEntity | null,
    ownershipEdges: number,
  ) {
    const sellerReadiness = this.signalScore(signals, 'seller_readiness');
    const transition = this.signalScore(signals, 'ownership_transition_probability');
    const stress = this.signalScore(signals, 'financial_stress');
    const acquisition = this.signalScore(signals, 'acquisition_likelihood');
    const growth = this.signalScore(signals, 'growth_vs_stagnation');
    const complexity = this.signalScore(signals, 'compliance_ownership_complexity');
    const negativeProfit = latestFinancial?.netResult != null && Number(latestFinancial.netResult) < 0 ? 100 : 0;
    const structureScale = Math.min(100, ownershipEdges * 8);

    const founderExit = Number(
      (sellerReadiness * 0.35 + transition * 0.3 + acquisition * 0.2 + (100 - stress) * 0.15).toFixed(1),
    );
    const distressed = Number(
      (stress * 0.5 + (100 - growth) * 0.2 + complexity * 0.15 + negativeProfit * 0.1 + ownershipRisk * 0.05).toFixed(1),
    );
    const rollUp = Number(
      (acquisition * 0.3 +
        growth * 0.2 +
        (100 - complexity) * 0.2 +
        structureScale * 0.2 +
        (100 - ownershipRisk) * 0.1).toFixed(1),
    );
    return {
      scores: {
        founder_exit: founderExit,
        distressed,
        roll_up: rollUp,
      },
      rationale: {
        founder_exit: [
          `seller_readiness=${sellerReadiness.toFixed(1)}`,
          `ownership_transition_probability=${transition.toFixed(1)}`,
          `acquisition_likelihood=${acquisition.toFixed(1)}`,
          `financial_stress_inverse=${(100 - stress).toFixed(1)}`,
        ],
        distressed: [
          `financial_stress=${stress.toFixed(1)}`,
          `growth_inverse=${(100 - growth).toFixed(1)}`,
          `compliance_ownership_complexity=${complexity.toFixed(1)}`,
          `negative_profit_proxy=${negativeProfit.toFixed(1)}`,
          `ownership_risk_score=${ownershipRisk.toFixed(1)}`,
        ],
        roll_up: [
          `acquisition_likelihood=${acquisition.toFixed(1)}`,
          `growth_vs_stagnation=${growth.toFixed(1)}`,
          `complexity_inverse=${(100 - complexity).toFixed(1)}`,
          `ownership_edges_shape=${structureScale.toFixed(1)}`,
          `ownership_risk_inverse=${(100 - ownershipRisk).toFixed(1)}`,
        ],
      },
      signalsSnapshot: {
        acquisition_likelihood: acquisition,
        ownership_transition_probability: transition,
        seller_readiness: sellerReadiness,
        growth_vs_stagnation: growth,
        compliance_ownership_complexity: complexity,
        financial_stress: stress,
      },
    };
  }

  async getProfiles(tenantId: string, organisationNumbers: string[]) {
    if (organisationNumbers.length === 0) return [];
    return this.profileRepo.find({
      where: { tenantId, organisationNumber: In(organisationNumbers) },
    });
  }

  async ensureProfiles(tenantId: string, organisationNumbers: string[]) {
    const orgs = Array.from(
      new Set(organisationNumbers.map((o) => o.replace(/\D/g, '')).filter((o) => o.length === 10 || o.length === 12)),
    );
    if (orgs.length === 0) return [];
    const existing = await this.getProfiles(tenantId, orgs);
    const existingByOrg = new Map(existing.map((p) => [p.organisationNumber, p]));
    const missing = orgs.filter((o) => !existingByOrg.has(o));
    if (missing.length > 0) {
      await this.rebuildProfiles(tenantId, missing);
    }
    return this.getProfiles(tenantId, orgs);
  }

  async rebuildProfiles(tenantId: string, organisationNumbers: string[]) {
    const orgs = Array.from(
      new Set(organisationNumbers.map((o) => o.replace(/\D/g, '')).filter((o) => o.length === 10 || o.length === 12)),
    );
    if (orgs.length === 0) return [];
    const [signals, latestFinancialRows, ownershipAgg] = await Promise.all([
      this.signalRepo
        .createQueryBuilder('s')
        .distinctOn(['s.organisationNumber', 's.signalType'])
        .where('s.tenantId = :tenantId', { tenantId })
        .andWhere('s.organisationNumber IN (:...orgs)', { orgs })
        .orderBy('s.organisationNumber', 'ASC')
        .addOrderBy('s.signalType', 'ASC')
        .addOrderBy('s.computedAt', 'DESC')
        .getMany(),
      this.financialRepo
        .createQueryBuilder('fs')
        .distinctOn(['fs.organisationNumber'])
        .where('fs.tenantId = :tenantId', { tenantId })
        .andWhere('fs.organisationNumber IN (:...orgs)', { orgs })
        .orderBy('fs.organisationNumber', 'ASC')
        .addOrderBy('fs.fiscalYearEnd', 'DESC')
        .addOrderBy('fs.updatedAt', 'DESC')
        .getMany(),
      this.ownershipRepo
        .createQueryBuilder('ol')
        .select('ol.ownedOrganisationNumber', 'org')
        .addSelect('COUNT(1)', 'cnt')
        .where('ol.tenantId = :tenantId', { tenantId })
        .andWhere('ol.ownedOrganisationNumber IN (:...orgs)', { orgs })
        .andWhere('ol.isCurrent = true')
        .groupBy('ol.ownedOrganisationNumber')
        .getRawMany<{ org: string; cnt: string }>(),
    ]);
    const signalsByOrg = new Map<string, CompanySignalEntity[]>();
    for (const row of signals) {
      const curr = signalsByOrg.get(row.organisationNumber) ?? [];
      curr.push(row);
      signalsByOrg.set(row.organisationNumber, curr);
    }
    const financialByOrg = new Map(latestFinancialRows.map((f) => [f.organisationNumber, f]));
    const ownershipByOrg = new Map(ownershipAgg.map((r) => [r.org, Number(r.cnt) || 0]));
    const rows: CompanySourcingProfileEntity[] = [];
    for (const org of orgs) {
      const advanced = (await this.ownershipService.getAdvancedOwnershipInsights(tenantId, org)) as Record<string, unknown>;
      const ownershipRisk = this.asScore(advanced.ownershipRiskScore ?? 0);
      const { scores, rationale, signalsSnapshot } = this.computeDealModeScores(
        signalsByOrg.get(org) ?? [],
        ownershipRisk,
        financialByOrg.get(org) ?? null,
        ownershipByOrg.get(org) ?? 0,
      );
      rows.push(
        this.profileRepo.create({
          tenantId,
          organisationNumber: org,
          ownershipRiskScore: String(ownershipRisk),
          dealModeScores: scores,
          dealModeRationale: rationale,
          signalsSnapshot,
        }),
      );
    }
    await this.profileRepo
      .createQueryBuilder()
      .insert()
      .into(CompanySourcingProfileEntity)
      .values(
        rows.map((r) => ({
          tenantId: r.tenantId,
          organisationNumber: r.organisationNumber,
          ownershipRiskScore: r.ownershipRiskScore,
          dealModeScores: r.dealModeScores,
          dealModeRationale: r.dealModeRationale,
          signalsSnapshot: r.signalsSnapshot,
        })) as Array<Record<string, any>>,
      )
      .orUpdate(
        ['ownershipRiskScore', 'dealModeScores', 'dealModeRationale', 'signalsSnapshot', 'updatedAt'],
        ['tenant_id', 'organisation_number'],
      )
      .execute();
    return this.getProfiles(tenantId, orgs);
  }

  async backtestDealMode(tenantId: string, mode: DealMode) {
    const profiles = await this.profileRepo.find({
      where: { tenantId },
      order: { updatedAt: 'DESC' },
      take: 5000,
    });
    const scoreKey = mode;
    const scoreRows = profiles
      .map((p) => ({
        org: p.organisationNumber,
        score: this.asScore((p.dealModeScores as Record<string, unknown>)[scoreKey]),
      }))
      .filter((x) => Number.isFinite(x.score));
    if (scoreRows.length < 30) {
      return { mode, sample_size: scoreRows.length, message: 'Not enough historical profiles for robust calibration.' };
    }
    const orgs = scoreRows.map((x) => x.org);
    const ownershipRows = await this.ownershipRepo.find({
      where: { tenantId, ownedOrganisationNumber: In(orgs) },
      order: { updatedAt: 'DESC', createdAt: 'DESC' },
      take: 10000,
    });
    const counts = new Map<string, number>();
    for (const row of ownershipRows) {
      counts.set(row.ownedOrganisationNumber, (counts.get(row.ownedOrganisationNumber) ?? 0) + 1);
    }
    const enriched = scoreRows.map((x) => ({ ...x, ownershipEventCount: counts.get(x.org) ?? 0 }));
    enriched.sort((a, b) => b.score - a.score);
    const top = enriched.slice(0, Math.floor(enriched.length * 0.2));
    const bottom = enriched.slice(Math.floor(enriched.length * 0.8));
    const avg = (arr: Array<{ ownershipEventCount: number }>) =>
      arr.length === 0 ? 0 : arr.reduce((s, x) => s + x.ownershipEventCount, 0) / arr.length;
    const topAvg = avg(top);
    const bottomAvg = avg(bottom);
    const lift = bottomAvg > 0 ? topAvg / bottomAvg : topAvg > 0 ? 9.99 : 1;
    const recommendation =
      lift < 1.1
        ? 'Reduce weight concentration and increase structural/financial factors.'
        : lift > 1.8
          ? 'Current weighting appears strong; keep as baseline.'
          : 'Moderate signal quality; tune individual factor weights by +/-5%.';
    return {
      mode,
      sample_size: enriched.length,
      top_quintile_avg_outcome_proxy: Number(topAvg.toFixed(2)),
      bottom_quintile_avg_outcome_proxy: Number(bottomAvg.toFixed(2)),
      lift: Number(lift.toFixed(2)),
      recommendation,
    };
  }

  async refreshMaterializedView() {
    await this.dataSource.query(`REFRESH MATERIALIZED VIEW CONCURRENTLY mv_company_sourcing_profiles;`).catch(async () => {
      await this.dataSource.query(`REFRESH MATERIALIZED VIEW mv_company_sourcing_profiles;`);
    });
    return { refreshed: true, view: 'mv_company_sourcing_profiles' };
  }
}


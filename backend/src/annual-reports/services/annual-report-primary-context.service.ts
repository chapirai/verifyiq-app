import { Injectable, Logger } from '@nestjs/common';
import type { AnnualReportXbrlContextEntity } from '../entities/annual-report-xbrl-context.entity';
import type { AnnualReportXbrlFactEntity } from '../entities/annual-report-xbrl-fact.entity';
import { FINANCIAL_RULES } from '../config/canonical-xbrl-mappings';
import { matchConceptToRule } from '../config/canonical-xbrl-matching';

export type PrimaryContextResult = {
  primaryContextId: string | null;
  periodStart: Date | null;
  periodEnd: Date | null;
  fiscalYear: number | null;
  factCount: number;
  keyFinancialFactCount: number;
  candidates: Array<{
    xbrlContextId: string;
    periodStart: Date | null;
    periodEnd: Date | null;
    factCount: number;
    keyFinancialCount: number;
    score: number;
  }>;
};

@Injectable()
export class AnnualReportPrimaryContextService {
  private readonly logger = new Logger(AnnualReportPrimaryContextService.name);

  /**
   * Pick primary *duration* context: prefer contexts referenced by key financial facts, else most-used duration context.
   */
  selectPrimaryDurationContext(
    contexts: AnnualReportXbrlContextEntity[],
    facts: AnnualReportXbrlFactEntity[],
  ): PrimaryContextResult {
    const durationCtxs = contexts.filter(c => c.periodStart && c.periodEnd);
    if (!durationCtxs.length) {
      return {
        primaryContextId: null,
        periodStart: null,
        periodEnd: null,
        fiscalYear: null,
        factCount: 0,
        keyFinancialFactCount: 0,
        candidates: [],
      };
    }

    const factCountByRef = new Map<string, number>();
    const keyFinByRef = new Map<string, number>();
    for (const f of facts) {
      const ref = f.contextRef?.trim();
      if (!ref) continue;
      factCountByRef.set(ref, (factCountByRef.get(ref) ?? 0) + 1);
      if (matchConceptToRule(f.conceptQname, FINANCIAL_RULES)) {
        keyFinByRef.set(ref, (keyFinByRef.get(ref) ?? 0) + 1);
      }
    }

    const candidates = durationCtxs.map(c => {
      const id = c.xbrlContextId;
      const fc = factCountByRef.get(id) ?? 0;
      const kf = keyFinByRef.get(id) ?? 0;
      const score = kf * 1000 + fc;
      return {
        xbrlContextId: id,
        periodStart: c.periodStart ?? null,
        periodEnd: c.periodEnd ?? null,
        factCount: fc,
        keyFinancialCount: kf,
        score,
      };
    });

    candidates.sort((a, b) => b.score - a.score || b.factCount - a.factCount);
    const best = candidates[0]!;
    const fiscalYear = best.periodEnd ? best.periodEnd.getUTCFullYear() : null;

    this.logger.log(
      `Primary duration context=${best.xbrlContextId} facts=${best.factCount} keyFin=${best.keyFinancialCount} fiscalYear=${fiscalYear ?? 'n/a'}`,
    );

    return {
      primaryContextId: best.xbrlContextId,
      periodStart: best.periodStart,
      periodEnd: best.periodEnd,
      fiscalYear,
      factCount: best.factCount,
      keyFinancialFactCount: best.keyFinancialCount,
      candidates,
    };
  }
}

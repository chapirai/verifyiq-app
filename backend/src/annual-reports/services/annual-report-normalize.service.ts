import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { matchConceptToRule } from '../config/canonical-xbrl-matching';
import {
  AUDITOR_RULES,
  FINANCIAL_RULES,
  HEADER_NAME_RULES,
  HEADER_ORG_RULES,
  NOTE_RULES,
  type CanonicalMappingRule,
} from '../config/canonical-xbrl-mappings';
import { AnnualReportFileEntity } from '../entities/annual-report-file.entity';
import { AnnualReportParseRunEntity } from '../entities/annual-report-parse-run.entity';
import { AnnualReportXbrlContextEntity } from '../entities/annual-report-xbrl-context.entity';
import { AnnualReportXbrlFactEntity } from '../entities/annual-report-xbrl-fact.entity';
import { AnnualReportXbrlUnitEntity } from '../entities/annual-report-xbrl-unit.entity';
import {
  CompanyAnnualReportAuditorEntity,
} from '../entities/company-annual-report-auditor.entity';
import { CompanyAnnualReportFinancialEntity } from '../entities/company-annual-report-financial.entity';
import { CompanyAnnualReportHeaderEntity } from '../entities/company-annual-report-header.entity';
import { CompanyAnnualReportNotesIndexEntity } from '../entities/company-annual-report-notes-index.entity';
import { CompanyAnnualReportPeriodEntity } from '../entities/company-annual-report-period.entity';
import type { AnnualReportPeriodKind } from '../entities/company-annual-report-financial.entity';

type PeriodEndMap = Map<string, { end?: Date | null; start?: Date | null; instant?: Date | null }>;

@Injectable()
export class AnnualReportNormalizeService {
  constructor(
    @InjectRepository(AnnualReportXbrlContextEntity)
    private readonly ctxRepo: Repository<AnnualReportXbrlContextEntity>,
    @InjectRepository(AnnualReportXbrlFactEntity)
    private readonly factRepo: Repository<AnnualReportXbrlFactEntity>,
    @InjectRepository(AnnualReportXbrlUnitEntity)
    private readonly unitRepo: Repository<AnnualReportXbrlUnitEntity>,
    @InjectRepository(CompanyAnnualReportHeaderEntity)
    private readonly headerRepo: Repository<CompanyAnnualReportHeaderEntity>,
    @InjectRepository(CompanyAnnualReportFinancialEntity)
    private readonly finRepo: Repository<CompanyAnnualReportFinancialEntity>,
    @InjectRepository(CompanyAnnualReportAuditorEntity)
    private readonly audRepo: Repository<CompanyAnnualReportAuditorEntity>,
    @InjectRepository(CompanyAnnualReportNotesIndexEntity)
    private readonly noteRepo: Repository<CompanyAnnualReportNotesIndexEntity>,
    @InjectRepository(CompanyAnnualReportPeriodEntity)
    private readonly periodRepo: Repository<CompanyAnnualReportPeriodEntity>,
    @InjectRepository(AnnualReportParseRunEntity)
    private readonly parseRunRepo: Repository<AnnualReportParseRunEntity>,
  ) {}

  /**
   * Build serving rows from persisted raw XBRL for a completed parse run.
   */
  async normalizeServingData(params: {
    tenantId: string;
    file: AnnualReportFileEntity;
    parseRun: AnnualReportParseRunEntity;
    sourceFilename: string | null;
  }): Promise<CompanyAnnualReportHeaderEntity> {
    const { tenantId, file, parseRun, sourceFilename } = params;
    const parseRunId = parseRun.id;

    const contexts = await this.ctxRepo.find({ where: { parseRunId } });
    const facts = await this.factRepo.find({ where: { parseRunId } });
    const units = await this.unitRepo.find({ where: { parseRunId } });

    const ctxById: PeriodEndMap = new Map();
    for (const c of contexts) {
      ctxById.set(c.xbrlContextId, {
        end: c.periodEnd ?? null,
        start: c.periodStart ?? null,
        instant: c.periodInstant ?? null,
      });
    }

    const { currentEnd, priorEnd } = this.inferReportingEnds(contexts);
    const currencyCode = this.inferCurrency(units);

    const orgFromFacts = this.pickHeaderText(facts, HEADER_ORG_RULES);
    const nameFromFacts = this.pickHeaderText(facts, HEADER_NAME_RULES);
    const orgNorm = this.normalizeOrgNumber(orgFromFacts ?? file.organisationsnummer ?? undefined);

    const header = this.headerRepo.create({
      tenantId,
      companyId: file.companyId ?? null,
      organisationsnummer: orgNorm ?? file.organisationsnummer ?? null,
      annualReportFileId: file.id,
      parseRunId,
      companyNameFromFiling: nameFromFacts,
      organisationNumberFiling: orgNorm,
      filingPeriodStart: currentEnd ? this.findPeriodStartForEnd(contexts, currentEnd) : null,
      filingPeriodEnd: currentEnd,
      currencyCode,
      sourceFilename: sourceFilename ?? file.originalFilename,
      parserName: parseRun.parserName,
      parserVersion: parseRun.parserVersion,
      metadata: {
        factCount: facts.length,
        contextCount: contexts.length,
        unitCount: units.length,
        inferredCurrentEnd: currentEnd?.toISOString().slice(0, 10),
        inferredPriorEnd: priorEnd?.toISOString().slice(0, 10),
      },
    });
    const savedHeader = await this.headerRepo.save(header);

    await this.replaceFinancials(savedHeader.id, facts, ctxById, currentEnd, priorEnd);
    await this.replaceAuditor(savedHeader.id, facts, ctxById, currentEnd, priorEnd);
    await this.replaceNotes(savedHeader.id, facts);
    await this.replacePeriods(savedHeader.id, contexts, currentEnd, priorEnd);

    await this.supersedeOlderHeaders(file.id, savedHeader.id);

    return savedHeader;
  }

  private async supersedeOlderHeaders(fileId: string, newHeaderId: string): Promise<void> {
    await this.headerRepo
      .createQueryBuilder()
      .update(CompanyAnnualReportHeaderEntity)
      .set({ isSuperseded: true, supersededByHeaderId: newHeaderId })
      .where('annual_report_file_id = :fileId', { fileId })
      .andWhere('id != :newHeaderId', { newHeaderId })
      .andWhere('is_superseded = false')
      .execute();
  }

  private inferReportingEnds(contexts: AnnualReportXbrlContextEntity[]): {
    currentEnd: Date | null;
    priorEnd: Date | null;
  } {
    const ends = new Map<string, Date>();
    for (const c of contexts) {
      if (c.periodEnd) {
        ends.set(c.periodEnd.toISOString().slice(0, 10), c.periodEnd);
      }
    }
    const sorted = [...ends.values()].sort((a, b) => b.getTime() - a.getTime());
    const currentEnd = sorted[0] ?? null;
    let priorEnd: Date | null = null;
    if (currentEnd && sorted.length > 1) {
      const y = currentEnd.getUTCFullYear();
      priorEnd = sorted.find(d => d.getUTCFullYear() < y) ?? sorted[1] ?? null;
    }
    return { currentEnd, priorEnd };
  }

  private findPeriodStartForEnd(
    contexts: AnnualReportXbrlContextEntity[],
    end: Date,
  ): Date | null {
    const key = end.toISOString().slice(0, 10);
    const match = contexts.find(
      c => c.periodEnd && c.periodEnd.toISOString().slice(0, 10) === key && c.periodStart,
    );
    return match?.periodStart ?? null;
  }

  private inferCurrency(units: AnnualReportXbrlUnitEntity[]): string | null {
    for (const u of units) {
      for (const m of u.measures ?? []) {
        const lower = m.toLowerCase();
        if (lower.includes('iso4217:sek') || lower.endsWith(':sek')) return 'SEK';
        if (lower.includes('iso4217:')) {
          const part = m.split(':').pop();
          if (part && /^[A-Z]{3}$/.test(part)) return part;
        }
      }
    }
    return null;
  }

  private normalizeOrgNumber(raw?: string | null): string | null {
    if (!raw) return null;
    const digits = raw.replace(/\D/g, '');
    return digits.length >= 10 ? digits : raw.trim() || null;
  }

  private pickHeaderText(facts: AnnualReportXbrlFactEntity[], rules: CanonicalMappingRule[]): string | null {
    let best: { text: string; score: number } | null = null;
    for (const f of facts) {
      if (f.isNil) continue;
      const text = f.valueText?.trim() || (f.valueNumeric != null ? String(f.valueNumeric) : '');
      if (!text) continue;
      const rule = this.matchRule(f.conceptQname, rules);
      if (!rule) continue;
      const score = rule.priority + text.length * 0.001;
      if (!best || score > best.score) best = { text, score };
    }
    return best?.text ?? null;
  }

  private matchRule(conceptQname: string, rules: CanonicalMappingRule[]): CanonicalMappingRule | null {
    return matchConceptToRule(conceptQname, rules);
  }

  private periodKindForFact(
    ctxById: PeriodEndMap,
    contextRef: string | null | undefined,
    currentEnd: Date | null,
    priorEnd: Date | null,
  ): AnnualReportPeriodKind {
    if (!contextRef) return 'unknown';
    const c = ctxById.get(contextRef);
    if (!c) return 'unknown';
    if (c.instant && currentEnd && c.instant.getTime() === currentEnd.getTime()) return 'instant';
    if (c.end && currentEnd && c.end.getTime() === currentEnd.getTime()) return 'current';
    if (c.end && priorEnd && c.end.getTime() === priorEnd.getTime()) return 'prior';
    if (c.instant) return 'instant';
    if (c.end) return 'unknown';
    return 'unknown';
  }

  private scoreFact(
    rule: CanonicalMappingRule,
    f: AnnualReportXbrlFactEntity,
    periodKind: AnnualReportPeriodKind,
  ): number {
    let s = rule.priority;
    if (periodKind === 'current' || periodKind === 'instant') s += 40;
    if (periodKind === 'prior') s += 35;
    if (!f.isNil && f.valueNumeric != null) s += 15;
    if (f.unitRef) s += 3;
    if (f.decimals != null && f.decimals >= 0) s += 1;
    return s;
  }

  private async replaceFinancials(
    headerId: string,
    facts: AnnualReportXbrlFactEntity[],
    ctxById: PeriodEndMap,
    currentEnd: Date | null,
    priorEnd: Date | null,
  ): Promise<void> {
    await this.finRepo.delete({ headerId });

    type Key = string;
    const winners = new Map<
      Key,
      { fact: AnnualReportXbrlFactEntity; rule: CanonicalMappingRule; periodKind: AnnualReportPeriodKind; score: number }
    >();

    for (const f of facts) {
      const rule = this.matchRule(f.conceptQname, FINANCIAL_RULES);
      if (!rule) continue;
      const periodKind = this.periodKindForFact(ctxById, f.contextRef, currentEnd, priorEnd);
      if (periodKind === 'unknown' && !f.isNil) {
        /* still allow unknown bucket for comparative edge cases */
      }
      const score = this.scoreFact(rule, f, periodKind);
      const key = `${rule.canonicalField}::${periodKind}`;
      const prev = winners.get(key);
      if (!prev || score > prev.score) {
        winners.set(key, { fact: f, rule, periodKind, score });
      }
    }

    const rows: Partial<CompanyAnnualReportFinancialEntity>[] = [];
    for (const { fact, rule, periodKind, score } of Array.from(winners.values())) {
      rows.push({
        headerId,
        canonicalField: rule.canonicalField,
        periodKind,
        valueNumeric: fact.valueNumeric ?? null,
        valueText: fact.valueText ?? null,
        unitRef: fact.unitRef ?? null,
        currencyCode: null,
        sourceFactIds: [fact.id],
        rankingScore: Math.round(score),
      });
    }
    if (rows.length) {
      await this.finRepo.save(rows.map(r => this.finRepo.create(r)));
    }
  }

  private async replaceAuditor(
    headerId: string,
    facts: AnnualReportXbrlFactEntity[],
    ctxById: PeriodEndMap,
    currentEnd: Date | null,
    priorEnd: Date | null,
  ): Promise<void> {
    await this.audRepo.delete({ headerId });

    let name: string | null = null;
    let firm: string | null = null;
    let opinion: string | null = null;
    const ids: string[] = [];

    const pick = (rules: CanonicalMappingRule[], target: 'name' | 'firm' | 'opinion') => {
      let best: { f: AnnualReportXbrlFactEntity; score: number } | null = null;
      for (const f of facts) {
        const rule = this.matchRule(f.conceptQname, rules);
        if (!rule) continue;
        const pk = this.periodKindForFact(ctxById, f.contextRef, currentEnd, priorEnd);
        const sc = this.scoreFact(rule, f, pk);
        if (!best || sc > best.score) best = { f, score: sc };
      }
      if (!best) return;
      const text = best.f.valueText?.trim() || (best.f.valueNumeric != null ? String(best.f.valueNumeric) : '');
      if (!text) return;
      if (target === 'name') {
        name = text;
        ids.push(best.f.id);
      }
      if (target === 'firm') {
        firm = text;
        ids.push(best.f.id);
      }
      if (target === 'opinion') {
        opinion = text;
        ids.push(best.f.id);
      }
    };

    pick(
      AUDITOR_RULES.filter(r => r.canonicalField === 'auditor_name'),
      'name',
    );
    pick(
      AUDITOR_RULES.filter(r => r.canonicalField === 'auditor_firm'),
      'firm',
    );
    pick(
      AUDITOR_RULES.filter(r => r.canonicalField === 'audit_opinion'),
      'opinion',
    );

    if (name || firm || opinion) {
      await this.audRepo.save(
        this.audRepo.create({
          headerId,
          auditorName: name,
          auditorFirm: firm,
          auditOpinionHint: opinion,
          sourceFactIds: [...new Set(ids)],
        }),
      );
    }
  }

  private async replaceNotes(headerId: string, facts: AnnualReportXbrlFactEntity[]): Promise<void> {
    await this.noteRepo.delete({ headerId });
    const noteFacts = facts.filter(f => this.matchRule(f.conceptQname, NOTE_RULES));
    const rows = noteFacts.slice(0, 500).map(f =>
      this.noteRepo.create({
        headerId,
        noteRef: f.contextRef ?? null,
        noteLabel: null,
        conceptQname: f.conceptQname,
        sourceFactIds: [f.id],
      }),
    );
    if (rows.length) await this.noteRepo.save(rows);
  }

  private async replacePeriods(
    headerId: string,
    contexts: AnnualReportXbrlContextEntity[],
    currentEnd: Date | null,
    priorEnd: Date | null,
  ): Promise<void> {
    await this.periodRepo.delete({ headerId });
    const rows: CompanyAnnualReportPeriodEntity[] = [];

    if (currentEnd) {
      const ctxIds = contexts
        .filter(
          c =>
            (c.periodEnd && c.periodEnd.getTime() === currentEnd.getTime()) ||
            (c.periodInstant && c.periodInstant.getTime() === currentEnd.getTime()),
        )
        .map(c => c.xbrlContextId);
      rows.push(
        this.periodRepo.create({
          headerId,
          periodLabel: 'current',
          periodStart: this.findPeriodStartForEnd(contexts, currentEnd),
          periodEnd: currentEnd,
          isInstant: false,
          contextIds: ctxIds,
        }),
      );
    }

    if (priorEnd) {
      const ctxIds = contexts
        .filter(c => c.periodEnd && c.periodEnd.getTime() === priorEnd.getTime())
        .map(c => c.xbrlContextId);
      rows.push(
        this.periodRepo.create({
          headerId,
          periodLabel: 'prior',
          periodStart: this.findPeriodStartForEnd(contexts, priorEnd),
          periodEnd: priorEnd,
          isInstant: false,
          contextIds: ctxIds,
        }),
      );
    }

    if (rows.length) await this.periodRepo.save(rows);
  }

  /**
   * Rebuild normalized rows from raw facts for the latest completed parse run of a file.
   */
  async rebuildServingForFile(file: AnnualReportFileEntity): Promise<CompanyAnnualReportHeaderEntity | null> {
    const parseRun = await this.parseRunRepo.findOne({
      where: { fileId: file.id, status: 'completed' },
      order: { startedAt: 'DESC' },
    });
    if (!parseRun) return null;

    const oldHeaders = await this.headerRepo.find({ where: { annualReportFileId: file.id } });
    for (const h of oldHeaders) {
      await this.finRepo.delete({ headerId: h.id });
      await this.audRepo.delete({ headerId: h.id });
      await this.noteRepo.delete({ headerId: h.id });
      await this.periodRepo.delete({ headerId: h.id });
      await this.headerRepo.delete({ id: h.id });
    }

    return this.normalizeServingData({
      tenantId: file.tenantId,
      file,
      parseRun,
      sourceFilename: parseRun.sourceIxbrlPath ?? null,
    });
  }
}

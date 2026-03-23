import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PartyEntity } from '../parties/party.entity';
import { CompanyEntity } from '../companies/entities/company.entity';
import { ScreeningMatchEntity } from '../screening/screening-match.entity';
import { AssessRiskDto } from './dto/assess-risk.dto';
import { RiskAssessmentEntity } from './risk-assessment.entity';

@Injectable()
export class RiskService {
  constructor(
    @InjectRepository(RiskAssessmentEntity)
    private readonly riskRepository: Repository<RiskAssessmentEntity>,
    @InjectRepository(PartyEntity)
    private readonly partiesRepository: Repository<PartyEntity>,
    @InjectRepository(CompanyEntity)
    private readonly companiesRepository: Repository<CompanyEntity>,
    @InjectRepository(ScreeningMatchEntity)
    private readonly screeningMatchesRepository: Repository<ScreeningMatchEntity>,
  ) {}

  async assess(tenantId: string, dto: AssessRiskDto) {
    const party = await this.partiesRepository.findOne({ where: { id: dto.partyId, tenantId } });
    if (!party) throw new NotFoundException('Party not found');

    const factors: Array<Record<string, unknown>> = [];
    let score = 0;

    if (party.type === 'legal_entity') {
      score += 20;
      factors.push({ code: 'LEGAL_ENTITY', impact: 20 });
    }

    if (party.countryCode !== 'SE') {
      score += 25;
      factors.push({ code: 'NON_SWEDISH_COUNTRY', impact: 25, countryCode: party.countryCode });
    }

    if (party.organisationNumber) {
      const company = await this.companiesRepository.findOne({ where: { tenantId, organisationNumber: party.organisationNumber } });
      if (company?.status && /inactive|dissolved|bankrupt/i.test(company.status)) {
        score += 30;
        factors.push({ code: 'ADVERSE_COMPANY_STATUS', impact: 30, status: company.status });
      }
    }

    const screeningMatches = await this.screeningMatchesRepository
      .createQueryBuilder('m')
      .innerJoin('screening_jobs', 'j', 'j.id = m.screening_job_id')
      .where('m.tenant_id = :tenantId', { tenantId })
      .andWhere('j.party_id = :partyId', { partyId: dto.partyId })
      .andWhere("m.match_status IN ('unreviewed','confirmed','needs_follow_up')")
      .getMany();

    if (screeningMatches.length > 0) {
      score += 35;
      factors.push({ code: 'SCREENING_MATCHES_PRESENT', impact: 35, count: screeningMatches.length });
    }

    const riskLevel = score >= 70 ? 'high' : score >= 35 ? 'medium' : 'low';
    return this.riskRepository.save(
      this.riskRepository.create({
        tenantId,
        partyId: dto.partyId,
        onboardingCaseId: dto.onboardingCaseId ?? null,
        score,
        riskLevel,
        factors,
        assessedBy: 'rules_engine_v1',
      }),
    );
  }

  async latestForParty(tenantId: string, partyId: string) {
    return this.riskRepository.findOne({ where: { tenantId, partyId }, order: { createdAt: 'DESC' } });
  }
}

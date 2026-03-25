import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { CreateCreditRatingDto } from './dto/create-credit-rating.dto';
import { CreateFinancialStatementDto } from './dto/create-financial-statement.dto';
import { CreditRatingEntity } from './entities/credit-rating.entity';
import { FinancialStatementEntity } from './entities/financial-statement.entity';

const STUB_TENANT_ID = '00000000-0000-0000-0000-000000000001';

@Injectable()
export class FinancialService {
  constructor(
    @InjectRepository(FinancialStatementEntity)
    private readonly statementsRepo: Repository<FinancialStatementEntity>,
    @InjectRepository(CreditRatingEntity)
    private readonly ratingsRepo: Repository<CreditRatingEntity>,
    private readonly auditService: AuditService,
  ) {}

  async upsertStatement(tenantId: string, actorId: string | null, dto: CreateFinancialStatementDto) {
    const existing = await this.statementsRepo.findOne({
      where: { tenantId, organisationNumber: dto.organisationNumber, fiscalYear: dto.fiscalYear },
    });

    const statement = this.statementsRepo.create({
      ...existing,
      tenantId,
      organisationNumber: dto.organisationNumber,
      fiscalYear: dto.fiscalYear,
      companyId: dto.companyId ?? existing?.companyId ?? null,
      fiscalYearStart: dto.fiscalYearStart ? new Date(dto.fiscalYearStart) : (existing?.fiscalYearStart ?? null),
      fiscalYearEnd: dto.fiscalYearEnd ? new Date(dto.fiscalYearEnd) : (existing?.fiscalYearEnd ?? null),
      reportType: dto.reportType ?? existing?.reportType ?? null,
      currency: dto.currency ?? existing?.currency ?? 'SEK',
      revenue: dto.revenue != null ? String(dto.revenue) : (existing?.revenue ?? null),
      operatingResult: dto.operatingResult != null ? String(dto.operatingResult) : (existing?.operatingResult ?? null),
      netResult: dto.netResult != null ? String(dto.netResult) : (existing?.netResult ?? null),
      totalAssets: dto.totalAssets != null ? String(dto.totalAssets) : (existing?.totalAssets ?? null),
      totalEquity: dto.totalEquity != null ? String(dto.totalEquity) : (existing?.totalEquity ?? null),
      totalLiabilities: dto.totalLiabilities != null ? String(dto.totalLiabilities) : (existing?.totalLiabilities ?? null),
      cashAndEquivalents: dto.cashAndEquivalents != null ? String(dto.cashAndEquivalents) : (existing?.cashAndEquivalents ?? null),
      numberOfEmployees: dto.numberOfEmployees ?? existing?.numberOfEmployees ?? null,
      ratios: dto.ratios ?? existing?.ratios ?? {},
      rawData: dto.rawData ?? existing?.rawData ?? {},
      sourceType: dto.sourceType ?? existing?.sourceType ?? null,
      documentId: dto.documentId ?? existing?.documentId ?? null,
    });

    const saved = await this.statementsRepo.save(statement);
    await this.auditService.log({
      tenantId,
      actorId,
      action: 'financial.statement.upserted',
      resourceType: 'financial_statement',
      resourceId: saved.id,
      metadata: dto,
    });
    return saved;
  }

  listStatements(tenantId: string, organisationNumber: string) {
    return this.statementsRepo.find({
      where: { tenantId, organisationNumber },
      order: { fiscalYear: 'DESC' },
    });
  }

  async getStatement(tenantId: string, organisationNumber: string, fiscalYear: string) {
    const statement = await this.statementsRepo.findOne({
      where: { tenantId, organisationNumber, fiscalYear },
    });
    if (!statement) throw new NotFoundException('Financial statement not found');
    return statement;
  }

  async createRating(tenantId: string, actorId: string | null, dto: CreateCreditRatingDto) {
    await this.ratingsRepo.update(
      { tenantId, organisationNumber: dto.organisationNumber, isCurrent: true },
      { isCurrent: false },
    );

    const rating = this.ratingsRepo.create({
      tenantId,
      organisationNumber: dto.organisationNumber,
      companyId: dto.companyId ?? null,
      ratingProvider: dto.ratingProvider ?? null,
      rating: dto.rating ?? null,
      ratingScore: dto.ratingScore ?? null,
      ratingDescription: dto.ratingDescription ?? null,
      riskClass: dto.riskClass ?? null,
      ratedAt: dto.ratedAt ? new Date(dto.ratedAt) : null,
      validUntil: dto.validUntil ? new Date(dto.validUntil) : null,
      isCurrent: dto.isCurrent ?? true,
      sourceData: dto.sourceData ?? {},
    });

    const saved = await this.ratingsRepo.save(rating);
    await this.auditService.log({
      tenantId,
      actorId,
      action: 'financial.rating.created',
      resourceType: 'credit_rating',
      resourceId: saved.id,
      metadata: dto,
    });
    return saved;
  }

  listRatings(tenantId: string, organisationNumber: string) {
    return this.ratingsRepo.find({
      where: { tenantId, organisationNumber },
      order: { ratedAt: 'DESC' },
    });
  }

  async getCurrentRating(tenantId: string, organisationNumber: string) {
    const rating = await this.ratingsRepo.findOne({
      where: { tenantId, organisationNumber, isCurrent: true },
      order: { ratedAt: 'DESC' },
    });
    if (!rating) throw new NotFoundException('No current rating found');
    return rating;
  }
}

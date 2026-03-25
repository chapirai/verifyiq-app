import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { CreateCompanyCaseDto } from './dto/create-company-case.dto';
import { RecordProhibitionDto } from './dto/record-prohibition.dto';
import { BusinessProhibitionEntity } from './entities/business-prohibition.entity';
import { CompanyCaseEntity } from './entities/company-case.entity';

@Injectable()
export class CompanyCasesService {
  constructor(
    @InjectRepository(CompanyCaseEntity)
    private readonly casesRepo: Repository<CompanyCaseEntity>,
    @InjectRepository(BusinessProhibitionEntity)
    private readonly prohibitionsRepo: Repository<BusinessProhibitionEntity>,
    private readonly auditService: AuditService,
  ) {}

  async createCase(tenantId: string, actorId: string | undefined, dto: CreateCompanyCaseDto) {
    const companyCase = this.casesRepo.create({
      tenantId,
      organisationNumber: dto.organisationNumber,
      companyId: dto.companyId ?? null,
      caseNumber: dto.caseNumber ?? null,
      caseType: dto.caseType ?? null,
      caseTypeDescription: dto.caseTypeDescription ?? null,
      status: dto.status ?? null,
      sourceAuthority: dto.sourceAuthority ?? null,
      effectiveDate: dto.effectiveDate ?? null,
      closedDate: dto.closedDate ?? null,
      description: dto.description ?? null,
      payload: dto.payload ?? {},
    });
    const saved = await this.casesRepo.save(companyCase);
    await this.auditService.log({
      tenantId,
      actorId: actorId ?? null,
      action: 'company_case.created',
      resourceType: 'company_case',
      resourceId: saved.id,
      metadata: dto,
    });
    return saved;
  }

  listCases(tenantId: string, organisationNumber: string) {
    return this.casesRepo.find({
      where: { tenantId, organisationNumber },
      order: { createdAt: 'DESC' },
    });
  }

  async recordProhibition(tenantId: string, actorId: string | undefined, dto: RecordProhibitionDto) {
    const prohibition = this.prohibitionsRepo.create({
      tenantId,
      personnummer: dto.personnummer,
      personName: dto.personName ?? null,
      prohibitionType: dto.prohibitionType ?? null,
      isActive: dto.isActive ?? true,
      fromDate: dto.fromDate ?? null,
      toDate: dto.toDate ?? null,
      reason: dto.reason ?? null,
      sourceAuthority: dto.sourceAuthority ?? null,
      linkedCompanies: dto.linkedCompanies ?? [],
      payload: dto.payload ?? {},
    });
    const saved = await this.prohibitionsRepo.save(prohibition);
    await this.auditService.log({
      tenantId,
      actorId: actorId ?? null,
      action: 'business_prohibition.recorded',
      resourceType: 'business_prohibition',
      resourceId: saved.id,
      metadata: dto,
    });
    return saved;
  }

  listProhibitions(tenantId: string, personnummer?: string) {
    const where: Record<string, unknown> = { tenantId };
    if (personnummer) where['personnummer'] = personnummer;
    return this.prohibitionsRepo.find({ where, order: { createdAt: 'DESC' } });
  }

  async checkPersonProhibition(tenantId: string, personnummer: string) {
    const activeProhibition = await this.prohibitionsRepo.findOne({
      where: { tenantId, personnummer, isActive: true },
    });
    return {
      hasProhibition: !!activeProhibition,
      details: activeProhibition ?? null,
    };
  }
}

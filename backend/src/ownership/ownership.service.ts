import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { CreateBeneficialOwnerDto } from './dto/create-beneficial-owner.dto';
import { CreateOwnershipLinkDto } from './dto/create-ownership-link.dto';
import { CreateWorkplaceDto } from './dto/create-workplace.dto';
import { BeneficialOwnerEntity } from './entities/beneficial-owner.entity';
import { OwnershipLinkEntity } from './entities/ownership-link.entity';
import { WorkplaceEntity } from './entities/workplace.entity';

@Injectable()
export class OwnershipService {
  constructor(
    @InjectRepository(OwnershipLinkEntity)
    private readonly ownershipLinksRepo: Repository<OwnershipLinkEntity>,
    @InjectRepository(BeneficialOwnerEntity)
    private readonly beneficialOwnersRepo: Repository<BeneficialOwnerEntity>,
    @InjectRepository(WorkplaceEntity)
    private readonly workplacesRepo: Repository<WorkplaceEntity>,
    private readonly auditService: AuditService,
  ) {}

  async createOwnershipLink(tenantId: string, actorId: string | null, dto: CreateOwnershipLinkDto) {
    const link = this.ownershipLinksRepo.create({
      tenantId,
      ownerType: dto.ownerType,
      ownerName: dto.ownerName,
      ownerPersonId: dto.ownerPersonId ?? null,
      ownerCompanyId: dto.ownerCompanyId ?? null,
      ownerOrganisationNumber: dto.ownerOrganisationNumber ?? null,
      ownerPersonnummer: dto.ownerPersonnummer ?? null,
      ownedCompanyId: dto.ownedCompanyId ?? null,
      ownedOrganisationNumber: dto.ownedOrganisationNumber,
      ownedCompanyName: dto.ownedCompanyName,
      ownershipPercentage: dto.ownershipPercentage ?? null,
      ownershipType: dto.ownershipType ?? null,
      ownershipClass: dto.ownershipClass ?? null,
      controlPercentage: dto.controlPercentage ?? null,
      validFrom: dto.validFrom ? new Date(dto.validFrom) : null,
      validTo: dto.validTo ? new Date(dto.validTo) : null,
      isCurrent: dto.isCurrent ?? true,
      sourceData: dto.sourceData ?? {},
    });
    const saved = await this.ownershipLinksRepo.save(link);
    await this.auditService.log({
      tenantId,
      actorId,
      action: 'ownership.link.created',
      resourceType: 'ownership_link',
      resourceId: saved.id,
      metadata: dto,
    });
    return saved;
  }

  listOwnershipLinks(tenantId: string, organisationNumber?: string) {
    const where: Record<string, unknown> = { tenantId };
    if (organisationNumber) {
      where['ownedOrganisationNumber'] = organisationNumber;
    }
    return this.ownershipLinksRepo.find({ where, order: { createdAt: 'DESC' } });
  }

  listOwners(tenantId: string, organisationNumber: string) {
    return this.ownershipLinksRepo.find({
      where: { tenantId, ownedOrganisationNumber: organisationNumber },
      order: { createdAt: 'DESC' },
    });
  }

  listOwnedCompanies(tenantId: string, ownerOrganisationNumber: string) {
    return this.ownershipLinksRepo.find({
      where: { tenantId, ownerOrganisationNumber },
      order: { createdAt: 'DESC' },
    });
  }

  async createBeneficialOwner(tenantId: string, actorId: string | null, dto: CreateBeneficialOwnerDto) {
    const owner = this.beneficialOwnersRepo.create({
      tenantId,
      organisationNumber: dto.organisationNumber,
      companyId: dto.companyId ?? null,
      personName: dto.personName,
      personnummer: dto.personnummer ?? null,
      ownershipPercentage: dto.ownershipPercentage ?? null,
      controlPercentage: dto.controlPercentage ?? null,
      ownershipType: dto.ownershipType ?? null,
      isAlternativeBeneficialOwner: dto.isAlternativeBeneficialOwner ?? false,
      alternativeReason: dto.alternativeReason ?? null,
      isCurrent: dto.isCurrent ?? true,
      validFrom: dto.validFrom ? new Date(dto.validFrom) : null,
      validTo: dto.validTo ? new Date(dto.validTo) : null,
      sourceType: dto.sourceType ?? null,
      sourceData: dto.sourceData ?? {},
    });
    const saved = await this.beneficialOwnersRepo.save(owner);
    await this.auditService.log({
      tenantId,
      actorId,
      action: 'ownership.beneficial_owner.created',
      resourceType: 'beneficial_owner',
      resourceId: saved.id,
      metadata: dto,
    });
    return saved;
  }

  listBeneficialOwners(tenantId: string, organisationNumber: string) {
    return this.beneficialOwnersRepo.find({
      where: { tenantId, organisationNumber },
      order: { createdAt: 'DESC' },
    });
  }

  async createWorkplace(tenantId: string, actorId: string | null, dto: CreateWorkplaceDto) {
    const workplace = this.workplacesRepo.create({
      tenantId,
      organisationNumber: dto.organisationNumber,
      companyId: dto.companyId ?? null,
      cfarNumber: dto.cfarNumber ?? null,
      workplaceName: dto.workplaceName ?? null,
      phone: dto.phone ?? null,
      email: dto.email ?? null,
      postalAddress: dto.postalAddress ?? {},
      deliveryAddress: dto.deliveryAddress ?? null,
      coordinates: dto.coordinates ?? null,
      municipalityCode: dto.municipalityCode ?? null,
      municipalityName: dto.municipalityName ?? null,
      countyCode: dto.countyCode ?? null,
      countyName: dto.countyName ?? null,
      industryCode: dto.industryCode ?? null,
      industryDescription: dto.industryDescription ?? null,
      isActive: dto.isActive ?? true,
      sourceData: dto.sourceData ?? {},
    });
    const saved = await this.workplacesRepo.save(workplace);
    await this.auditService.log({
      tenantId,
      actorId,
      action: 'ownership.workplace.created',
      resourceType: 'workplace',
      resourceId: saved.id,
      metadata: dto,
    });
    return saved;
  }

  listWorkplaces(tenantId: string, organisationNumber?: string) {
    const where: Record<string, unknown> = { tenantId };
    if (organisationNumber) {
      where['organisationNumber'] = organisationNumber;
    }
    return this.workplacesRepo.find({ where, order: { createdAt: 'DESC' } });
  }
}

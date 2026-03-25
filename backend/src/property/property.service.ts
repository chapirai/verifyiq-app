import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { RecordPropertyOwnershipDto } from './dto/record-property-ownership.dto';
import { PropertyOwnershipEntity } from './entities/property-ownership.entity';

@Injectable()
export class PropertyService {
  constructor(
    @InjectRepository(PropertyOwnershipEntity)
    private readonly ownershipRepo: Repository<PropertyOwnershipEntity>,
    private readonly auditService: AuditService,
  ) {}

  async recordPropertyOwnership(tenantId: string, actorId: string | undefined, dto: RecordPropertyOwnershipDto) {
    const ownership = this.ownershipRepo.create({
      tenantId,
      ownerType: dto.ownerType,
      ownerName: dto.ownerName,
      ownerOrganisationNumber: dto.ownerOrganisationNumber ?? null,
      ownerPersonnummer: dto.ownerPersonnummer ?? null,
      propertyDesignation: dto.propertyDesignation ?? null,
      propertyType: dto.propertyType ?? null,
      municipalityCode: dto.municipalityCode ?? null,
      municipalityName: dto.municipalityName ?? null,
      countyCode: dto.countyCode ?? null,
      countyName: dto.countyName ?? null,
      taxValue: dto.taxValue != null ? String(dto.taxValue) : null,
      taxValueYear: dto.taxValueYear ?? null,
      ownershipShare: dto.ownershipShare != null ? String(dto.ownershipShare) : null,
      acquisitionDate: dto.acquisitionDate ?? null,
      address: dto.address ?? {},
      sourceData: dto.sourceData ?? {},
      isCurrent: dto.isCurrent ?? true,
    });
    const saved = await this.ownershipRepo.save(ownership);
    await this.auditService.log({
      tenantId,
      actorId: actorId ?? null,
      action: 'property.ownership.recorded',
      resourceType: 'property_ownership',
      resourceId: saved.id,
      metadata: dto,
    });
    return saved;
  }

  listByCompany(tenantId: string, organisationNumber: string) {
    return this.ownershipRepo.find({
      where: { tenantId, ownerOrganisationNumber: organisationNumber },
      order: { createdAt: 'DESC' },
    });
  }

  listByPerson(tenantId: string, personnummer: string) {
    return this.ownershipRepo.find({
      where: { tenantId, ownerPersonnummer: personnummer },
      order: { createdAt: 'DESC' },
    });
  }

  async getPropertySummary(tenantId: string, ownerType: string, ownerId: string) {
    const where =
      ownerType === 'company'
        ? { tenantId, ownerOrganisationNumber: ownerId }
        : { tenantId, ownerPersonnummer: ownerId };

    const properties = await this.ownershipRepo.find({ where });
    const totalTaxValue = properties.reduce((sum, p) => sum + (p.taxValue != null ? parseFloat(p.taxValue) : 0), 0);

    return {
      ownerType,
      ownerId,
      propertyCount: properties.length,
      totalTaxValue,
    };
  }
}

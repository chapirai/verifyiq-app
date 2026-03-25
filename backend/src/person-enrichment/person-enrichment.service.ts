import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { UpsertPersonEnrichmentDto } from './dto/upsert-person-enrichment.dto';
import { PersonEnrichmentEntity } from './entities/person-enrichment.entity';

@Injectable()
export class PersonEnrichmentService {
  constructor(
    @InjectRepository(PersonEnrichmentEntity)
    private readonly enrichmentRepo: Repository<PersonEnrichmentEntity>,
    private readonly auditService: AuditService,
  ) {}

  async upsertPersonEnrichment(
    tenantId: string,
    actorId: string | undefined,
    personnummer: string,
    dto: UpsertPersonEnrichmentDto,
  ) {
    let enrichment = await this.enrichmentRepo.findOne({ where: { tenantId, personnummer } });

    if (enrichment) {
      Object.assign(enrichment, {
        partyId: dto.partyId ?? enrichment.partyId,
        fullName: dto.fullName ?? enrichment.fullName,
        firstName: dto.firstName ?? enrichment.firstName,
        lastName: dto.lastName ?? enrichment.lastName,
        gender: dto.gender ?? enrichment.gender,
        isDeceased: dto.isDeceased ?? enrichment.isDeceased,
        deceasedDate: dto.deceasedDate ?? enrichment.deceasedDate,
        officialAddress: dto.officialAddress ?? enrichment.officialAddress,
        municipalityCode: dto.municipalityCode ?? enrichment.municipalityCode,
        municipalityName: dto.municipalityName ?? enrichment.municipalityName,
        countyCode: dto.countyCode ?? enrichment.countyCode,
        boardAssignments: dto.boardAssignments ?? enrichment.boardAssignments,
        beneficialOwnerLinks: dto.beneficialOwnerLinks ?? enrichment.beneficialOwnerLinks,
        businessProhibition: dto.businessProhibition ?? enrichment.businessProhibition,
        sanctionsStatus: dto.sanctionsStatus ?? enrichment.sanctionsStatus,
        pepStatus: dto.pepStatus ?? enrichment.pepStatus,
        dataPermissions: dto.dataPermissions ?? enrichment.dataPermissions,
        sourceType: dto.sourceType ?? enrichment.sourceType,
        enrichedAt: dto.enrichedAt ? new Date(dto.enrichedAt) : new Date(),
      });
    } else {
      enrichment = this.enrichmentRepo.create({
        tenantId,
        personnummer,
        partyId: dto.partyId ?? null,
        fullName: dto.fullName ?? null,
        firstName: dto.firstName ?? null,
        lastName: dto.lastName ?? null,
        gender: dto.gender ?? null,
        isDeceased: dto.isDeceased ?? false,
        deceasedDate: dto.deceasedDate ?? null,
        officialAddress: dto.officialAddress ?? {},
        municipalityCode: dto.municipalityCode ?? null,
        municipalityName: dto.municipalityName ?? null,
        countyCode: dto.countyCode ?? null,
        boardAssignments: dto.boardAssignments ?? [],
        beneficialOwnerLinks: dto.beneficialOwnerLinks ?? [],
        businessProhibition: dto.businessProhibition ?? {},
        sanctionsStatus: dto.sanctionsStatus ?? {},
        pepStatus: dto.pepStatus ?? {},
        dataPermissions: dto.dataPermissions ?? {},
        sourceType: dto.sourceType ?? null,
        enrichedAt: dto.enrichedAt ? new Date(dto.enrichedAt) : new Date(),
      });
    }

    const saved = await this.enrichmentRepo.save(enrichment);
    await this.auditService.log({
      tenantId,
      actorId: actorId ?? null,
      action: 'person.enrichment.upserted',
      resourceType: 'person_enrichment',
      resourceId: saved.id,
      metadata: { personnummer },
    });
    return saved;
  }

  async getPersonEnrichment(tenantId: string, personnummer: string) {
    const enrichment = await this.enrichmentRepo.findOne({ where: { tenantId, personnummer } });
    if (!enrichment) throw new NotFoundException(`Person enrichment not found for personnummer: ${personnummer}`);
    return enrichment;
  }

  listPersonEnrichments(tenantId: string, limit = 50) {
    return this.enrichmentRepo.find({
      where: { tenantId },
      order: { updatedAt: 'DESC' },
      take: limit,
    });
  }

  maskSensitiveFields(enrichment: PersonEnrichmentEntity, permissions: Record<string, unknown>) {
    const result: PersonEnrichmentEntity & { personnummer: string } = { ...enrichment };
    if (!permissions['showAddress']) {
      result.officialAddress = { masked: true };
    }
    if (!permissions['showPersonalNumber']) {
      result.personnummer = '****';
    }
    if (!permissions['showDeceased']) {
      result.isDeceased = false;
      result.deceasedDate = null;
    }
    return result;
  }
}

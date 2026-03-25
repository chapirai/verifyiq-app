import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BvOrganisationEntity } from '../entities/bv-organisation.entity';
import { NormalisedCompany } from '../integrations/bolagsverket.mapper';

@Injectable()
export class BvPersistenceService {
  private readonly logger = new Logger(BvPersistenceService.name);

  constructor(
    @InjectRepository(BvOrganisationEntity)
    private readonly orgRepo: Repository<BvOrganisationEntity>,
  ) {}

  async upsertOrganisation(
    tenantId: string,
    normalised: NormalisedCompany,
    rawPayload: Record<string, unknown>,
  ): Promise<BvOrganisationEntity> {
    const existing = await this.orgRepo.findOne({
      where: { tenantId, organisationsnummer: normalised.organisationNumber },
    });

    const entity =
      existing ??
      this.orgRepo.create({
        tenantId,
        organisationsnummer: normalised.organisationNumber,
      });

    entity.namn = normalised.legalName;
    entity.organisationsformKlartext = normalised.companyForm;
    entity.aktuellStatusKlartext = normalised.status;
    entity.senastUppdaterad = new Date();
    entity.rawPayload = rawPayload;

    const saved = await this.orgRepo.save(entity);
    this.logger.log(
      `Upserted organisation ${normalised.organisationNumber} for tenant ${tenantId}`,
    );
    return saved;
  }

  async findByOrgNr(
    tenantId: string,
    organisationsnummer: string,
  ): Promise<BvOrganisationEntity | null> {
    return this.orgRepo.findOne({ where: { tenantId, organisationsnummer } });
  }
}

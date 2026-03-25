import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CreateBeneficialOwnerDto } from './dto/create-beneficial-owner.dto';
import { CreateOwnershipLinkDto } from './dto/create-ownership-link.dto';
import { CreateWorkplaceDto } from './dto/create-workplace.dto';
import { OwnershipService } from './ownership.service';

const TENANT_ID = '00000000-0000-0000-0000-000000000001';

@Controller('ownership')
@UseGuards(JwtAuthGuard)
export class OwnershipController {
  constructor(private readonly ownershipService: OwnershipService) {}

  @Post('links')
  createOwnershipLink(@Body() dto: CreateOwnershipLinkDto, @CurrentUser('id') actorId: string) {
    return this.ownershipService.createOwnershipLink(TENANT_ID, actorId, dto);
  }

  @Get('links')
  listOwnershipLinks(@Query('organisationNumber') organisationNumber?: string) {
    return this.ownershipService.listOwnershipLinks(TENANT_ID, organisationNumber);
  }

  @Get('links/owners/:orgNr')
  listOwners(@Param('orgNr') orgNr: string) {
    return this.ownershipService.listOwners(TENANT_ID, orgNr);
  }

  @Get('links/owned/:ownerOrgNr')
  listOwnedCompanies(@Param('ownerOrgNr') ownerOrgNr: string) {
    return this.ownershipService.listOwnedCompanies(TENANT_ID, ownerOrgNr);
  }

  @Post('beneficial-owners')
  createBeneficialOwner(@Body() dto: CreateBeneficialOwnerDto, @CurrentUser('id') actorId: string) {
    return this.ownershipService.createBeneficialOwner(TENANT_ID, actorId, dto);
  }

  @Get('beneficial-owners/:orgNr')
  listBeneficialOwners(@Param('orgNr') orgNr: string) {
    return this.ownershipService.listBeneficialOwners(TENANT_ID, orgNr);
  }

  @Post('workplaces')
  createWorkplace(@Body() dto: CreateWorkplaceDto, @CurrentUser('id') actorId: string) {
    return this.ownershipService.createWorkplace(TENANT_ID, actorId, dto);
  }

  @Get('workplaces')
  listWorkplaces(@Query('organisationNumber') organisationNumber?: string) {
    return this.ownershipService.listWorkplaces(TENANT_ID, organisationNumber);
  }
}

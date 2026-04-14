import { Body, Controller, Get, Param, Post, Query, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiQuotaBucket } from '../common/decorators/api-quota-bucket.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequiredScopes } from '../common/decorators/required-scopes.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ScopeGuard } from '../common/guards/scope.guard';
import { ApiQuotaInterceptor } from '../common/interceptors/api-quota.interceptor';
import { CreateBeneficialOwnerDto } from './dto/create-beneficial-owner.dto';
import { CreateOwnershipLinkDto } from './dto/create-ownership-link.dto';
import { CreateWorkplaceDto } from './dto/create-workplace.dto';
import { OwnershipService } from './ownership.service';

const TENANT_ID = '00000000-0000-0000-0000-000000000001';

@Controller('ownership')
@UseGuards(JwtAuthGuard, ScopeGuard)
@UseInterceptors(ApiQuotaInterceptor)
@ApiQuotaBucket('ownership')
export class OwnershipController {
  constructor(private readonly ownershipService: OwnershipService) {}

  @Post('links')
  @RequiredScopes('ownership:write')
  createOwnershipLink(@Body() dto: CreateOwnershipLinkDto, @CurrentUser('id') actorId: string) {
    return this.ownershipService.createOwnershipLink(TENANT_ID, actorId, dto);
  }

  @Get('links')
  @RequiredScopes('ownership:read')
  listOwnershipLinks(@Query('organisationNumber') organisationNumber?: string) {
    return this.ownershipService.listOwnershipLinks(TENANT_ID, organisationNumber);
  }

  @Get('links/owners/:orgNr')
  @RequiredScopes('ownership:read')
  listOwners(@Param('orgNr') orgNr: string) {
    return this.ownershipService.listOwners(TENANT_ID, orgNr);
  }

  @Get('links/owned/:ownerOrgNr')
  @RequiredScopes('ownership:read')
  listOwnedCompanies(@Param('ownerOrgNr') ownerOrgNr: string) {
    return this.ownershipService.listOwnedCompanies(TENANT_ID, ownerOrgNr);
  }

  @Post('beneficial-owners')
  @RequiredScopes('ownership:write')
  createBeneficialOwner(@Body() dto: CreateBeneficialOwnerDto, @CurrentUser('id') actorId: string) {
    return this.ownershipService.createBeneficialOwner(TENANT_ID, actorId, dto);
  }

  @Get('beneficial-owners/:orgNr')
  @RequiredScopes('ownership:read')
  listBeneficialOwners(@Param('orgNr') orgNr: string) {
    return this.ownershipService.listBeneficialOwners(TENANT_ID, orgNr);
  }

  @Post('workplaces')
  @RequiredScopes('ownership:write')
  createWorkplace(@Body() dto: CreateWorkplaceDto, @CurrentUser('id') actorId: string) {
    return this.ownershipService.createWorkplace(TENANT_ID, actorId, dto);
  }

  @Get('workplaces')
  @RequiredScopes('ownership:read')
  listWorkplaces(@Query('organisationNumber') organisationNumber?: string) {
    return this.ownershipService.listWorkplaces(TENANT_ID, organisationNumber);
  }
}

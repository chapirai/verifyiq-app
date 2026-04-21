import { Body, Controller, Get, Param, Post, Query, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiQuotaBucket } from '../common/decorators/api-quota-bucket.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequiredScopes } from '../common/decorators/required-scopes.decorator';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ScopeGuard } from '../common/guards/scope.guard';
import { ApiQuotaInterceptor } from '../common/interceptors/api-quota.interceptor';
import { CreateBeneficialOwnerDto } from './dto/create-beneficial-owner.dto';
import { CreateOwnershipLinkDto } from './dto/create-ownership-link.dto';
import { CreateWorkplaceDto } from './dto/create-workplace.dto';
import { OwnershipService } from './ownership.service';

@Controller('ownership')
@UseGuards(JwtAuthGuard, ScopeGuard)
@UseInterceptors(ApiQuotaInterceptor)
@ApiQuotaBucket('ownership')
export class OwnershipController {
  constructor(private readonly ownershipService: OwnershipService) {}

  @Post('links')
  @RequiredScopes('ownership:write')
  createOwnershipLink(@TenantId() tenantId: string, @Body() dto: CreateOwnershipLinkDto, @CurrentUser('sub') actorId: string) {
    return this.ownershipService.createOwnershipLink(tenantId, actorId, dto);
  }

  @Get('links')
  @RequiredScopes('ownership:read')
  listOwnershipLinks(@TenantId() tenantId: string, @Query('organisationNumber') organisationNumber?: string) {
    return this.ownershipService.listOwnershipLinks(tenantId, organisationNumber);
  }

  @Get('links/owners/:orgNr')
  @RequiredScopes('ownership:read')
  listOwners(@TenantId() tenantId: string, @Param('orgNr') orgNr: string) {
    return this.ownershipService.listOwners(tenantId, orgNr);
  }

  @Get('links/owned/:ownerOrgNr')
  @RequiredScopes('ownership:read')
  listOwnedCompanies(@TenantId() tenantId: string, @Param('ownerOrgNr') ownerOrgNr: string) {
    return this.ownershipService.listOwnedCompanies(tenantId, ownerOrgNr);
  }

  @Post('beneficial-owners')
  @RequiredScopes('ownership:write')
  createBeneficialOwner(@TenantId() tenantId: string, @Body() dto: CreateBeneficialOwnerDto, @CurrentUser('sub') actorId: string) {
    return this.ownershipService.createBeneficialOwner(tenantId, actorId, dto);
  }

  @Get('beneficial-owners/:orgNr')
  @RequiredScopes('ownership:read')
  listBeneficialOwners(@TenantId() tenantId: string, @Param('orgNr') orgNr: string) {
    return this.ownershipService.listBeneficialOwners(tenantId, orgNr);
  }

  @Post('workplaces')
  @RequiredScopes('ownership:write')
  createWorkplace(@TenantId() tenantId: string, @Body() dto: CreateWorkplaceDto, @CurrentUser('sub') actorId: string) {
    return this.ownershipService.createWorkplace(tenantId, actorId, dto);
  }

  @Get('workplaces')
  @RequiredScopes('ownership:read')
  listWorkplaces(@TenantId() tenantId: string, @Query('organisationNumber') organisationNumber?: string) {
    return this.ownershipService.listWorkplaces(tenantId, organisationNumber);
  }

  @Get('graph/:orgNr')
  @RequiredScopes('ownership:read')
  getOwnershipGraph(@TenantId() tenantId: string, @Param('orgNr') orgNr: string) {
    return this.ownershipService.getOwnershipGraph(tenantId, orgNr);
  }
}

import { Body, Controller, Delete, Get, Param, Post, UseGuards, UseInterceptors } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { ApiQuotaBucket } from '../../common/decorators/api-quota-bucket.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequiredScopes } from '../../common/decorators/required-scopes.decorator';
import { TenantId } from '../../common/decorators/tenant-id.decorator';
import { ScopeGuard } from '../../common/guards/scope.guard';
import { ApiQuotaInterceptor } from '../../common/interceptors/api-quota.interceptor';
import { AddTargetListItemsBulkDto } from '../dto/add-target-list-items-bulk.dto';
import { AddTargetListItemDto } from '../dto/add-target-list-item.dto';
import { CreateTargetListDto } from '../dto/create-target-list.dto';
import { UpdateTargetListPlaybookDto } from '../dto/update-target-list-playbook.dto';
import { TargetListsService } from '../services/target-lists.service';

@Controller('target-lists')
@UseGuards(JwtAuthGuard, ScopeGuard)
@UseInterceptors(ApiQuotaInterceptor)
@ApiQuotaBucket('companies')
export class TargetListsController {
  constructor(private readonly targetListsService: TargetListsService) {}

  @Get()
  @RequiredScopes('companies:read')
  listLists(@TenantId() tenantId: string) {
    return this.targetListsService.listLists(tenantId);
  }

  @Post()
  @RequiredScopes('companies:write')
  createList(
    @TenantId() tenantId: string,
    @CurrentUser('sub') actorId: string | undefined,
    @Body() dto: CreateTargetListDto,
  ) {
    return this.targetListsService.createList(tenantId, actorId ?? null, dto);
  }

  @Delete(':id')
  @RequiredScopes('companies:write')
  deleteList(
    @TenantId() tenantId: string,
    @CurrentUser('sub') actorId: string | undefined,
    @Param('id') id: string,
  ) {
    return this.targetListsService.deleteList(tenantId, actorId ?? null, id);
  }

  @Post(':id/items/bulk')
  @RequiredScopes('companies:write')
  addItemsBulk(
    @TenantId() tenantId: string,
    @CurrentUser('sub') actorId: string | undefined,
    @Param('id') id: string,
    @Body() dto: AddTargetListItemsBulkDto,
  ) {
    return this.targetListsService.addItemsBulk(tenantId, actorId ?? null, id, dto);
  }

  @Post(':id/playbook')
  @RequiredScopes('companies:write')
  updatePlaybook(
    @TenantId() tenantId: string,
    @CurrentUser('sub') actorId: string | undefined,
    @Param('id') id: string,
    @Body() dto: UpdateTargetListPlaybookDto,
  ) {
    return this.targetListsService.updatePlaybook(tenantId, actorId ?? null, id, dto);
  }

  @Post(':id/items')
  @RequiredScopes('companies:write')
  addItem(
    @TenantId() tenantId: string,
    @CurrentUser('sub') actorId: string | undefined,
    @Param('id') id: string,
    @Body() dto: AddTargetListItemDto,
  ) {
    return this.targetListsService.addItem(tenantId, actorId ?? null, id, dto);
  }

  @Delete(':id/items/:organisationNumber')
  @RequiredScopes('companies:write')
  removeItem(
    @TenantId() tenantId: string,
    @CurrentUser('sub') actorId: string | undefined,
    @Param('id') id: string,
    @Param('organisationNumber') organisationNumber: string,
  ) {
    return this.targetListsService.removeItem(tenantId, actorId ?? null, id, organisationNumber);
  }
}

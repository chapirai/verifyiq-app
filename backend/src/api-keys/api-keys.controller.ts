import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import type { JwtUser } from '../auth/interfaces/jwt-user.interface';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CreateApiKeyDto } from './dto/create-api-key.dto';
import { ApiKeysService } from './api-keys.service';

@Controller('api-keys')
@UseGuards(JwtAuthGuard)
export class ApiKeysController {
  constructor(private readonly apiKeysService: ApiKeysService) {}

  @Get()
  async list(@CurrentUser() currentUser: JwtUser) {
    return { data: await this.apiKeysService.listByTenant(currentUser.tenantId) };
  }

  @Get('sandbox/connection')
  async sandboxConnection(@CurrentUser() currentUser: JwtUser) {
    const keys = await this.apiKeysService.listByTenantAndEnvironment(currentUser.tenantId, 'sandbox');
    return {
      data: {
        environment: 'sandbox',
        baseUrl: '/sandbox/api/v1',
        hasActiveKey: keys.length > 0,
        keys,
      },
    };
  }

  @Post('sandbox/provision')
  async provisionSandbox(@CurrentUser() currentUser: JwtUser) {
    const result = await this.apiKeysService.ensureSandboxKey(currentUser.tenantId);
    return {
      data: {
        ...result.apiKey,
        key: result.key,
        environment: 'sandbox',
      },
    };
  }

  @Post()
  async create(@CurrentUser() currentUser: JwtUser, @Body() dto: CreateApiKeyDto) {
    const result = await this.apiKeysService.createKey(
      currentUser.tenantId,
      dto.name,
      dto.environment ?? 'live',
    );
    return {
      data: {
        ...result.apiKey,
        key: result.key,
      },
    };
  }

  @Delete(':id')
  async revoke(@CurrentUser() currentUser: JwtUser, @Param('id') id: string) {
    return this.apiKeysService.revokeKey(currentUser.tenantId, id);
  }
}

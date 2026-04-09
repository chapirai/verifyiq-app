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

  @Post()
  async create(@CurrentUser() currentUser: JwtUser, @Body() dto: CreateApiKeyDto) {
    const result = await this.apiKeysService.createKey(currentUser.tenantId, dto.name);
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

import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';

import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { TenantsService } from './tenants.service';

@Controller('tenants')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Get()
  @Roles('admin')
  async list() {
    return { data: await this.tenantsService.findAll() };
  }

  @Get(':id')
  @Roles('admin', 'compliance')
  async getById(@Param('id') id: string) {
    return { data: await this.tenantsService.findById(id) };
  }

  @Post()
  @Roles('admin')
  async create(@Body() dto: CreateTenantDto) {
    return { data: await this.tenantsService.create(dto) };
  }
}

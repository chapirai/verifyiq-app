import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';

import type { JwtUser } from '../auth/interfaces/jwt-user.interface';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  async me(@CurrentUser() currentUser: JwtUser) {
    return { data: await this.usersService.findById(currentUser.sub) };
  }

  @Get()
  @Roles('admin', 'compliance')
  async list(@CurrentUser() currentUser: JwtUser) {
    return { data: await this.usersService.findAllByTenant(currentUser.tenantId) };
  }

  @Get(':id')
  @Roles('admin', 'compliance')
  async getById(@Param('id') id: string) {
    return { data: await this.usersService.findById(id) };
  }

  @Post()
  @Roles('admin')
  async create(@Body() dto: CreateUserDto, @CurrentUser() currentUser: JwtUser) {
    return { data: await this.usersService.create(dto, currentUser.sub) };
  }

  @Patch(':id')
  @Roles('admin')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() currentUser: JwtUser,
  ) {
    return { data: await this.usersService.update(id, dto, currentUser.sub) };
  }
}

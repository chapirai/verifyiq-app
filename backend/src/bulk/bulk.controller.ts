import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import type { JwtUser } from '../auth/interfaces/jwt-user.interface';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CreateBulkJobDto } from './dto/create-bulk-job.dto';
import { BulkService } from './bulk.service';

@Controller('bulk')
@UseGuards(JwtAuthGuard)
export class BulkController {
  constructor(private readonly bulkService: BulkService) {}

  @Post('jobs')
  async createJob(@CurrentUser() currentUser: JwtUser, @Body() dto: CreateBulkJobDto) {
    return { data: await this.bulkService.createJob(currentUser.tenantId, dto) };
  }

  @Get('jobs')
  async listJobs(@CurrentUser() currentUser: JwtUser) {
    return { data: await this.bulkService.listJobs(currentUser.tenantId) };
  }
}

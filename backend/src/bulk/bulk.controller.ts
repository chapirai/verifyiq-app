import { Body, Controller, Get, Header, Param, Post, UseGuards } from '@nestjs/common';
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

  @Get('jobs/:id')
  async getJob(@CurrentUser() currentUser: JwtUser, @Param('id') id: string) {
    return { data: await this.bulkService.getJob(currentUser.tenantId, id) };
  }

  @Get('jobs/:id/items')
  async listItems(@CurrentUser() currentUser: JwtUser, @Param('id') id: string) {
    return { data: await this.bulkService.listJobItems(currentUser.tenantId, id) };
  }

  @Post('jobs/:id/retry-failures')
  async retryFailed(@CurrentUser() currentUser: JwtUser, @Param('id') id: string) {
    return { data: await this.bulkService.retryFailedItems(currentUser.tenantId, id) };
  }

  @Get('jobs/:id/download')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  async downloadCsv(@CurrentUser() currentUser: JwtUser, @Param('id') id: string) {
    return await this.bulkService.exportCsv(currentUser.tenantId, id);
  }
}

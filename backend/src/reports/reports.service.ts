import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Queue } from 'bullmq';
import { Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { GenerateReportDto } from './dto/generate-report.dto';
import { ReportEntity } from './report.entity';

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(ReportEntity)
    private readonly reportsRepo: Repository<ReportEntity>,
    @InjectQueue('reports') private readonly reportsQueue: Queue,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
  ) {}

  async generate(dto: GenerateReportDto, actorUserId?: string) {
    const report = this.reportsRepo.create({
      tenantId: '00000000-0000-0000-0000-000000000001',
      reportType: dto.reportType,
      status: 'queued',
      requestedByUserId: actorUserId ?? null,
      filters: dto.filters,
    });
    const saved = await this.reportsRepo.save(report);
    await this.reportsQueue.add('generate-report', { reportId: saved.id });
    await this.auditService.log({ action: 'report.queued', actorUserId, entityType: 'report', entityId: saved.id, payload: dto });
    return saved;
  }

  listReports() {
    return this.reportsRepo.find({ order: { createdAt: 'DESC' } });
  }

  async markCompleted(id: string, storageKey: string) {
    const bucket = this.configService.get<string>('S3_BUCKET', 'verifyiq-documents');
    await this.reportsRepo.update({ id }, { status: 'completed', storageBucket: bucket, storageKey, completedAt: new Date() });
    return this.reportsRepo.findOneBy({ id });
  }
}

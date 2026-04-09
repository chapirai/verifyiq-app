import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BulkJobEntity } from './entities/bulk-job.entity';
import { CreateBulkJobDto } from './dto/create-bulk-job.dto';

@Injectable()
export class BulkService {
  constructor(
    @InjectRepository(BulkJobEntity)
    private readonly bulkJobRepository: Repository<BulkJobEntity>,
  ) {}

  async createJob(tenantId: string, dto: CreateBulkJobDto): Promise<BulkJobEntity> {
    const job = this.bulkJobRepository.create({
      tenantId,
      fileName: dto.fileName,
      rowsTotal: dto.rowsTotal,
      rowsProcessed: 0,
      status: 'queued',
      errorMessage: null,
    });
    return this.bulkJobRepository.save(job);
  }

  async listJobs(tenantId: string): Promise<BulkJobEntity[]> {
    return this.bulkJobRepository.find({
      where: { tenantId },
      order: { createdAt: 'DESC' },
      take: 50,
    });
  }

  async markProcessing(jobId: string): Promise<BulkJobEntity> {
    const job = await this.bulkJobRepository.findOne({ where: { id: jobId } });
    if (!job) {
      throw new NotFoundException('Bulk job not found');
    }
    job.status = 'processing';
    return this.bulkJobRepository.save(job);
  }
}

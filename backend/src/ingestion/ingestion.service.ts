import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IngestionRunEntity } from './entities/ingestion-run.entity';
import { IngestionSourceStatusEntity } from './entities/ingestion-source-status.entity';
import { SourceFileEntity } from './entities/source-file.entity';
import { CompanySourceStatusEntity } from './entities/company-source-status.entity';

@Injectable()
export class IngestionService {
  constructor(
    @InjectRepository(IngestionRunEntity)
    private readonly ingestionRunRepo: Repository<IngestionRunEntity>,
    @InjectRepository(IngestionSourceStatusEntity)
    private readonly sourceStatusRepo: Repository<IngestionSourceStatusEntity>,
    @InjectRepository(SourceFileEntity)
    private readonly sourceFileRepo: Repository<SourceFileEntity>,
    @InjectRepository(CompanySourceStatusEntity)
    private readonly companySourceStatusRepo: Repository<CompanySourceStatusEntity>,
  ) {}

  getRun(id: string): Promise<IngestionRunEntity | null> {
    return this.ingestionRunRepo.findOne({ where: { id } });
  }

  async startRun(input: {
    sourceProvider: string;
    ingestionType: string;
    r2ObjectKey?: string | null;
  }): Promise<IngestionRunEntity> {
    return this.ingestionRunRepo.save(
      this.ingestionRunRepo.create({
        sourceProvider: input.sourceProvider,
        ingestionType: input.ingestionType,
        status: 'running',
        r2ObjectKey: input.r2ObjectKey ?? null,
      }),
    );
  }

  async updateRunProgress(
    runId: string,
    patch: {
      recordsSeen?: number;
      recordsInserted?: number;
      recordsFailed?: number;
      memoryPeakMb?: number;
      r2ObjectKey?: string | null;
    },
  ): Promise<void> {
    await this.ingestionRunRepo.update({ id: runId }, patch);
  }

  async finishRunSuccess(
    runId: string,
    patch: { recordsSeen: number; recordsInserted: number; recordsFailed: number; memoryPeakMb: number },
  ): Promise<void> {
    await this.ingestionRunRepo.update(
      { id: runId },
      {
        ...patch,
        status: 'applied',
        finishedAt: new Date(),
        errorMessage: null,
      },
    );
  }

  async finishRunFailure(
    runId: string,
    patch: { recordsSeen: number; recordsInserted: number; recordsFailed: number; memoryPeakMb: number; errorMessage: string },
  ): Promise<void> {
    await this.ingestionRunRepo.update(
      { id: runId },
      {
        recordsSeen: patch.recordsSeen,
        recordsInserted: patch.recordsInserted,
        recordsFailed: patch.recordsFailed,
        memoryPeakMb: patch.memoryPeakMb,
        status: 'failed',
        finishedAt: new Date(),
        errorMessage: patch.errorMessage,
      },
    );
  }

  async markSourceFailure(orgnr: string, sourceName: string, message: string): Promise<void> {
    await this.sourceStatusRepo.upsert(
      {
        companyOrgnr: orgnr,
        sourceName,
        status: 'failed',
        lastAttemptAt: new Date(),
        errorMessage: message,
      },
      ['companyOrgnr', 'sourceName'],
    );
  }

  async persistSourceFile(input: {
    provider: string;
    sha256: string;
    sizeBytes: number;
    r2ObjectKey: string;
    contentType?: string | null;
  }): Promise<SourceFileEntity> {
    const existing = await this.sourceFileRepo.findOne({
      where: { provider: input.provider, sha256: input.sha256 },
    });
    if (existing) return existing;
    return this.sourceFileRepo.save(
      this.sourceFileRepo.create({
        provider: input.provider,
        sha256: input.sha256,
        sizeBytes: String(input.sizeBytes),
        r2ObjectKey: input.r2ObjectKey,
        contentType: input.contentType ?? null,
      }),
    );
  }

  async upsertCompanySourceStatus(input: {
    organisationNumber: string;
    sourceName: string;
    status: string;
    errorMessage?: string | null;
    dataFreshUntil?: Date | null;
  }): Promise<void> {
    const now = new Date();
    const isOk = input.status === 'loaded' || input.status === 'ok' || input.status === 'success';
    await this.companySourceStatusRepo.upsert(
      {
        organisationNumber: input.organisationNumber.replace(/\D/g, ''),
        sourceName: input.sourceName,
        status: input.status,
        lastAttemptAt: now,
        lastSuccessAt: isOk ? now : null,
        errorMessage: input.errorMessage ?? null,
        dataFreshUntil: input.dataFreshUntil ?? null,
      },
      ['organisationNumber', 'sourceName'],
    );
  }

  async getCompanySourceStatuses(orgnr: string): Promise<CompanySourceStatusEntity[]> {
    const normalized = orgnr.replace(/\D/g, '');
    return this.companySourceStatusRepo.find({
      where: { organisationNumber: normalized },
      order: { sourceName: 'ASC' },
    });
  }
}


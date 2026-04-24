import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Job, Queue } from 'bullmq';
import { DataSource, MoreThanOrEqual, Repository } from 'typeorm';
import { firstValueFrom } from 'rxjs';
import { createHash } from 'crypto';
import * as readline from 'readline';
import { Readable } from 'stream';
import { monitorEventLoopDelay } from 'perf_hooks';
import { BolagsverketService } from '../companies/services/bolagsverket.service';
import { BolagsverketBulkStorageService } from './bolagsverket-bulk.storage.service';
import { BolagsverketBulkUpsertService } from './bolagsverket-bulk-upsert.service';
import { BvBulkFileRunEntity } from './entities/bv-bulk-file-run.entity';
import { BvBulkRawRowEntity } from './entities/bv-bulk-raw-row.entity';
import { BvBulkCompanyStagingEntity } from './entities/bv-bulk-company-staging.entity';
import { BvBulkCompanyCurrentEntity } from './entities/bv-bulk-company-current.entity';
import { BvBulkRunCheckpointEntity } from './entities/bv-bulk-run-checkpoint.entity';
import { UsageEventEntity } from '../audit/usage-event.entity';
import { AuditService } from '../audit/audit.service';
import { SubscriptionEntity } from '../billing/entities/subscription.entity';
import { Tenant } from '../tenants/tenant.entity';
import { User } from '../users/user.entity';
import { CompanyEntity } from '../companies/entities/company.entity';
import {
  BvBulkEnrichmentReason,
  BvBulkEnrichmentRequestEntity,
} from './entities/bv-bulk-enrichment-request.entity';
import {
  BOLAGSVERKET_BULK_QUEUE,
  BolagsverketBulkJobName,
  ProcessEnrichmentRequestJobData,
} from './queues/bolagsverket-bulk.queue';
import { BatchWriterService } from '../ingestion/batch-writer.service';
import { BolagsverketLineParserService } from '../ingestion/bolagsverket-line-parser.service';
import { IngestionService } from '../ingestion/ingestion.service';
import { IngestionLoggerService } from '../ingestion/ingestion-logger.service';
import { MemoryGuardService } from '../ingestion/memory-guard.service';

const ADMIN_READ_ROLES = ['admin'] as const;
type IngestStats = { lineCount: number; rowsInserted: number; rowsFailed: number; memoryPeakMb: number };

@Injectable()
export class BolagsverketBulkService {
  private readonly logger = new Logger(BolagsverketBulkService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly httpService: HttpService,
    private readonly auditService: AuditService,
    private readonly storage: BolagsverketBulkStorageService,
    private readonly lineParser: BolagsverketLineParserService,
    private readonly batchWriter: BatchWriterService,
    private readonly ingestionService: IngestionService,
    private readonly ingestionLogger: IngestionLoggerService,
    private readonly memoryGuard: MemoryGuardService,
    private readonly upsert: BolagsverketBulkUpsertService,
    private readonly bolagsverketService: BolagsverketService,
    @InjectRepository(BvBulkFileRunEntity)
    private readonly runRepo: Repository<BvBulkFileRunEntity>,
    @InjectRepository(BvBulkRawRowEntity)
    private readonly rawRepo: Repository<BvBulkRawRowEntity>,
    @InjectRepository(BvBulkRunCheckpointEntity)
    private readonly checkpointRepo: Repository<BvBulkRunCheckpointEntity>,
    @InjectRepository(BvBulkCompanyCurrentEntity)
    private readonly currentRepo: Repository<BvBulkCompanyCurrentEntity>,
    @InjectRepository(BvBulkEnrichmentRequestEntity)
    private readonly enrichmentRepo: Repository<BvBulkEnrichmentRequestEntity>,
    @InjectRepository(SubscriptionEntity)
    private readonly subscriptionRepo: Repository<SubscriptionEntity>,
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(UsageEventEntity)
    private readonly usageEventRepo: Repository<UsageEventEntity>,
    @InjectRepository(CompanyEntity)
    private readonly companyRepo: Repository<CompanyEntity>,
    @InjectQueue(BOLAGSVERKET_BULK_QUEUE)
    private readonly queue: Queue,
    private readonly dataSource: DataSource,
  ) {}

  ensureAdminRole(role?: string | null, tenantId?: string | null): void {
    if (!role || !(ADMIN_READ_ROLES as readonly string[]).includes(role)) {
      throw new Error('Access restricted to platform admin role.');
    }
    const platformTenantId = this.config.get<string>('BV_BULK_PLATFORM_ADMIN_TENANT_ID', '').trim();
    if (platformTenantId && tenantId && tenantId !== platformTenantId) {
      throw new Error('Access restricted to platform admin tenant.');
    }
  }

  async enqueueWeeklyIngestion(): Promise<{ queued: true }> {
    await this.queue.add(
      BolagsverketBulkJobName.RUN_WEEKLY_INGESTION,
      {},
      { removeOnComplete: { count: 20 }, removeOnFail: { count: 20 } },
    );
    return { queued: true };
  }

  async enqueueForcedIngestion(sourceUrl?: string): Promise<{
    queued: true;
    mode: 'queued';
    job: 'run-weekly-ingestion';
    sourceUrlOverride: boolean;
    note: string;
  }> {
    await this.queue.add(
      BolagsverketBulkJobName.RUN_WEEKLY_INGESTION,
      sourceUrl ? { sourceUrl } : {},
      { removeOnComplete: { count: 20 }, removeOnFail: { count: 20 } },
    );
    return {
      queued: true,
      mode: 'queued',
      job: BolagsverketBulkJobName.RUN_WEEKLY_INGESTION,
      sourceUrlOverride: !!sourceUrl,
      note: 'Queued to avoid web-request memory spikes; worker executes ZIP/TXT pipeline in background.',
    };
  }

  async runWeeklyIngestion(sourceUrlOverride?: string, force = false): Promise<{
    runId: string;
    rowCount: number;
    applied: number;
    changed: number;
    seeded: number;
    deduplicatedByHash: boolean;
  }> {
    const sourceUrl =
      sourceUrlOverride ||
      this.config.get<string>(
        'BV_BULK_WEEKLY_URL',
        'https://example.invalid/bolagsverket_bulkfil.zip',
      );
    const now = new Date();
    const parserProfile = this.config.get<string>('BV_BULK_PARSER_PROFILE', 'default_v1');
    const ingestionRun = await this.ingestionService.startRun({
      sourceProvider: 'bolagsverket',
      ingestionType: 'weekly_bulk',
    });
    const dl = await this.storage.downloadAndArchiveWeeklyZip(sourceUrl);
    await this.ingestionService.updateRunProgress(ingestionRun.id, { r2ObjectKey: dl.zipObjectKey });
    await this.ingestionService.persistSourceFile({
      provider: 'bolagsverket.bulk.zip',
      sha256: dl.zipSha256,
      sizeBytes: dl.zipSizeBytes,
      r2ObjectKey: dl.zipObjectKey,
      contentType: 'application/zip',
    });
    await this.ingestionService.persistSourceFile({
      provider: 'bolagsverket.bulk.txt',
      sha256: dl.txtSha256,
      sizeBytes: dl.txtSizeBytes,
      r2ObjectKey: dl.txtObjectKey,
      contentType: 'text/plain; charset=utf-8',
    });
    const maxTxtBytes = Number(this.config.get<number>('BV_BULK_MAX_TXT_BYTES', 350_000_000));
    if (maxTxtBytes > 0 && dl.txtSizeBytes > maxTxtBytes) {
      const msg = `Bulk TXT too large (${dl.txtSizeBytes} bytes), exceeds BV_BULK_MAX_TXT_BYTES=${maxTxtBytes}`;
      await this.ingestionService.finishRunFailure(ingestionRun.id, {
        recordsSeen: 0,
        recordsInserted: 0,
        recordsFailed: 0,
        memoryPeakMb: this.memoryGuard.snapshot().rssMb,
        errorMessage: msg,
      });
      throw new Error(msg);
    }

    const existingByHash = await this.runRepo.findOne({ where: { zipSha256: dl.zipSha256 } });
    if (existingByHash && !force) {
      await this.ingestionService.finishRunSuccess(ingestionRun.id, {
        recordsSeen: existingByHash.rowCount,
        recordsInserted: 0,
        recordsFailed: 0,
        memoryPeakMb: this.memoryGuard.snapshot().rssMb,
      });
      return {
        runId: existingByHash.id,
        rowCount: existingByHash.rowCount,
        applied: 0,
        changed: 0,
        seeded: 0,
        deduplicatedByHash: true,
      };
    }

    const run = await this.runRepo.save(
      this.runRepo.create({
        sourceUrl,
        downloadedAt: now,
        effectiveDate: now.toISOString().slice(0, 10),
        zipObjectKey: dl.zipObjectKey,
        txtObjectKey: dl.txtObjectKey,
        zipSha256: force ? this.hashReplayFingerprint(dl.zipSha256) : dl.zipSha256,
        txtSha256: dl.txtSha256,
        rowCount: 0,
        parserProfile,
        status: 'downloaded',
      }),
    );
    let lastIngestStats: IngestStats | null = null;

    try {
      const txtStream = await this.storage.getObjectStream(dl.txtObjectKey);
      const ingestStats = await this.ingestStreamWithCheckpoints(run.id, txtStream, parserProfile, dl.txtObjectKey, ingestionRun.id);
      lastIngestStats = ingestStats;
      const lineCount = ingestStats.lineCount;

      run.rowCount = lineCount;
      run.status = 'parsed';
      await this.runRepo.save(run);

      const applied = await this.upsert.applyStagingToCurrent(run.id, now);
      const removed = await this.upsert.detectRemovedCompanies(run.id, now);
      const seeded = await this.upsert.seedCompaniesFromCurrent(
        this.config.get<string>('BV_BULK_DEFAULT_TENANT_ID', ''),
      );

      run.status = 'applied';
      await this.runRepo.save(run);
      await this.maybeEmitOpsAlert(run.id);
      await this.ingestionService.finishRunSuccess(ingestionRun.id, {
        recordsSeen: ingestStats.lineCount,
        recordsInserted: ingestStats.rowsInserted,
        recordsFailed: ingestStats.rowsFailed,
        memoryPeakMb: ingestStats.memoryPeakMb,
      });
      return {
        runId: run.id,
        rowCount: lineCount,
        applied: applied.upserted,
        changed: applied.changed + removed,
        seeded,
        deduplicatedByHash: false,
      };
    } catch (err) {
      run.status = 'failed';
      run.errorMessage = err instanceof Error ? err.message : String(err);
      await this.runRepo.save(run);
      const partial = this.extractPartialStats(err) ?? lastIngestStats;
      await this.ingestionService.finishRunFailure(ingestionRun.id, {
        recordsSeen: partial?.lineCount ?? 0,
        recordsInserted: partial?.rowsInserted ?? 0,
        recordsFailed: partial?.rowsFailed ?? 0,
        memoryPeakMb: partial?.memoryPeakMb ?? this.memoryGuard.snapshot().rssMb,
        errorMessage: run.errorMessage ?? 'Bulk ingestion failed',
      });
      throw err;
    }
  }

  async replayRunFromArchive(runId: string): Promise<{
    replayRunId: string;
    sourceRunId: string;
    rowCount: number;
    applied: number;
    changed: number;
    seeded: number;
  }> {
    const sourceRun = await this.runRepo.findOneByOrFail({ id: runId });
    const now = new Date();
    const parserProfile = sourceRun.parserProfile ?? this.config.get<string>('BV_BULK_PARSER_PROFILE', 'default_v1');
    const replayRun = await this.runRepo.save(
      this.runRepo.create({
        sourceUrl: `replay:${sourceRun.id}`,
        downloadedAt: now,
        effectiveDate: now.toISOString().slice(0, 10),
        zipObjectKey: sourceRun.zipObjectKey,
        txtObjectKey: sourceRun.txtObjectKey,
        zipSha256: this.hashReplayFingerprint(sourceRun.zipSha256),
        txtSha256: sourceRun.txtSha256,
        rowCount: 0,
        parserProfile,
        status: 'downloaded',
      }),
    );
    const ingestionRun = await this.ingestionService.startRun({
      sourceProvider: 'bolagsverket',
      ingestionType: 'replay_bulk',
      r2ObjectKey: sourceRun.zipObjectKey,
    });
    let lastIngestStats: IngestStats | null = null;
    try {
      const txtStream = await this.storage.getObjectStream(sourceRun.txtObjectKey);
      const ingestStats = await this.ingestStreamWithCheckpoints(
        replayRun.id,
        txtStream,
        parserProfile,
        sourceRun.txtObjectKey,
        ingestionRun.id,
      );
      lastIngestStats = ingestStats;
      const lineCount = ingestStats.lineCount;
      replayRun.rowCount = lineCount;
      replayRun.status = 'parsed';
      await this.runRepo.save(replayRun);
      const applied = await this.upsert.applyStagingToCurrent(replayRun.id, now);
      const removed = await this.upsert.detectRemovedCompanies(replayRun.id, now);
      const seeded = await this.upsert.seedCompaniesFromCurrent(this.config.get<string>('BV_BULK_DEFAULT_TENANT_ID', ''));
      replayRun.status = 'applied';
      await this.runRepo.save(replayRun);
      await this.maybeEmitOpsAlert(replayRun.id);
      await this.ingestionService.finishRunSuccess(ingestionRun.id, {
        recordsSeen: ingestStats.lineCount,
        recordsInserted: ingestStats.rowsInserted,
        recordsFailed: ingestStats.rowsFailed,
        memoryPeakMb: ingestStats.memoryPeakMb,
      });
      return {
        replayRunId: replayRun.id,
        sourceRunId: sourceRun.id,
        rowCount: lineCount,
        applied: applied.upserted,
        changed: applied.changed + removed,
        seeded,
      };
    } catch (err) {
      replayRun.status = 'failed';
      replayRun.errorMessage = err instanceof Error ? err.message : String(err);
      await this.runRepo.save(replayRun);
      const partial = this.extractPartialStats(err) ?? lastIngestStats;
      await this.ingestionService.finishRunFailure(ingestionRun.id, {
        recordsSeen: partial?.lineCount ?? 0,
        recordsInserted: partial?.rowsInserted ?? 0,
        recordsFailed: partial?.rowsFailed ?? 0,
        memoryPeakMb: partial?.memoryPeakMb ?? this.memoryGuard.snapshot().rssMb,
        errorMessage: replayRun.errorMessage ?? 'Replay ingestion failed',
      });
      throw err;
    }
  }

  private hashReplayFingerprint(base: string): string {
    const seed = `${base}:${Date.now()}:${Math.random()}`;
    return createHash('sha256').update(seed).digest('hex');
  }

  private async ingestStreamWithCheckpoints(
    fileRunId: string,
    stream: Readable,
    parserProfile: string,
    sourceFileKey: string,
    ingestionRunId: string,
  ): Promise<IngestStats> {
    const configuredBatch = Number(this.config.get<number>('INGESTION_BATCH_SIZE', 250));
    const initialBatchSize = Math.max(50, Math.min(1000, configuredBatch));
    let currentBatchSize = initialBatchSize;
    const yieldEveryLines = Math.max(1000, Number(this.config.get<number>('BV_BULK_YIELD_EVERY_LINES', 5000)));
    const progressLogEveryRows = Math.max(
      1000,
      Number(this.config.get<number>('INGESTION_PROGRESS_LOG_EVERY_ROWS', 5000)),
    );
    const baseChunkPauseMs = Math.max(0, Number(this.config.get<number>('BV_BULK_CHUNK_PAUSE_MS', 5)));
    const autoThrottleEnabled = String(this.config.get<string>('BV_BULK_AUTO_THROTTLE_ENABLED', 'true')).toLowerCase() === 'true';
    const autoThrottleMaxPauseMs = Math.max(baseChunkPauseMs, Number(this.config.get<number>('BV_BULK_AUTO_THROTTLE_MAX_PAUSE_MS', 100)));
    const memWarnMb = Math.max(64, Number(this.config.get<number>('INGESTION_MEMORY_WARN_MB', 350)));
    const memHardMb = Math.max(memWarnMb, Number(this.config.get<number>('INGESTION_MEMORY_PAUSE_MB', 425)));
    const lagWarnMs = Math.max(10, Number(this.config.get<number>('BV_BULK_AUTO_THROTTLE_EVENT_LOOP_WARN_MS', 80)));
    const lagHardMs = Math.max(lagWarnMs, Number(this.config.get<number>('BV_BULK_AUTO_THROTTLE_EVENT_LOOP_HARD_MS', 140)));
    const loopLag = monitorEventLoopDelay({ resolution: 20 });
    loopLag.enable();
    const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
    let lineNumber = 0;
    let checkpointSeq = 0;
    let rowsInserted = 0;
    let rowsFailed = 0;
    let memoryPeakMb = this.memoryGuard.snapshot().rssMb;
    let rawChunk: Array<Partial<BvBulkRawRowEntity>> = [];
    let stagingChunk: Array<Partial<BvBulkCompanyStagingEntity>> = [];
    const adaptivePauseMs = (): number => {
      if (!autoThrottleEnabled) return baseChunkPauseMs;
      const memoryUsedMb = Math.round(process.memoryUsage().rss / (1024 * 1024));
      const p95LagMs = Number(loopLag.percentile(95) / 1_000_000);
      let pause = baseChunkPauseMs;
      if (memoryUsedMb >= memWarnMb || p95LagMs >= lagWarnMs) pause += 15;
      if (memoryUsedMb >= memHardMb || p95LagMs >= lagHardMs) pause += 45;
      return Math.min(autoThrottleMaxPauseMs, pause);
    };
    const flush = async () => {
      if (rawChunk.length === 0 && stagingChunk.length === 0) return;
      checkpointSeq += 1;
      const write = await this.batchWriter.writeStagingBatch({
        fileRunId,
        checkpointSeq,
        lastLineNumber: lineNumber,
        sourceFileKey,
        rawRows: rawChunk,
        stagingRows: stagingChunk,
      });
      rowsInserted += write.stagingWritten;
      rowsFailed += write.failedRows;
      rawChunk = [];
      stagingChunk = [];
      const mem = this.memoryGuard.snapshot();
      memoryPeakMb = Math.max(memoryPeakMb, mem.rssMb);
      await this.ingestionService.updateRunProgress(ingestionRunId, {
        recordsSeen: lineNumber,
        recordsInserted: rowsInserted,
        recordsFailed: rowsFailed,
        memoryPeakMb,
      });
      if (lineNumber % progressLogEveryRows === 0 || this.memoryGuard.shouldWarn(mem)) {
        this.ingestionLogger.progress({
          runId: ingestionRunId,
          phase: 'flush_batch',
          recordsSeen: lineNumber,
          recordsInserted: rowsInserted,
          recordsFailed: rowsFailed,
          memoryRssMb: mem.rssMb,
          at: new Date().toISOString(),
        });
      }
      if (this.memoryGuard.shouldFail(mem)) {
        throw new Error('Stopped before Render OOM: memory exceeded safe threshold');
      }
      if (this.memoryGuard.shouldWarn(mem) && currentBatchSize > 50) {
        currentBatchSize = Math.max(50, Math.floor(currentBatchSize * 0.8));
        this.logger.warn(
          `Ingestion memory warning at ${mem.rssMb}MB; reducing batch size to ${currentBatchSize}.`,
        );
      }
      if (this.memoryGuard.shouldPause(mem)) {
        this.logger.warn(
          `Ingestion memory critical at ${mem.rssMb}MB; pausing parser and attempting recovery.`,
        );
        const recovered = await this.memoryGuard.recoverFromCriticalPressure();
        if (this.memoryGuard.shouldFail(recovered)) {
          throw new Error('Stopped before Render OOM: memory exceeded safe threshold');
        }
      }
      const pauseMs = adaptivePauseMs();
      if (pauseMs > 0) await new Promise(resolve => setTimeout(resolve, pauseMs));
    };

    try {
      for await (const raw of rl) {
        const line = String(raw);
        if (!line.trim()) continue;
        lineNumber += 1;
        try {
          const parsed = this.lineParser.parseLine(line, lineNumber, parserProfile);
          rawChunk.push({ fileRunId, lineNumber, rawLine: line, parsedOk: true, parseError: null });
          stagingChunk.push({
            fileRunId,
            organisationIdentityRaw: parsed.identityRaw,
            identityValue: parsed.identityValue,
            identityType: parsed.identityType,
            namnskyddslopnummer: parsed.namnskyddslopnummer,
            registrationCountryCode: parsed.registrationCountryCode,
            organisationNamesRaw: parsed.namesRaw,
            organisationFormCode: parsed.organisationFormCode,
            deregistrationDate: parsed.deregistrationDate,
            deregistrationReasonCode: parsed.deregistrationReasonCode,
            deregistrationReasonText: parsed.deregistrationReasonText,
            restructuringRaw: parsed.restructuringRaw,
            registrationDate: parsed.registrationDate,
            businessDescription: parsed.businessDescription,
            postalAddressRaw: parsed.postalAddressRaw,
            deliveryAddress: parsed.deliveryAddress,
            coAddress: parsed.coAddress,
            postalCode: parsed.postalCode,
            city: parsed.city,
            countryCode: parsed.countryCode,
            contentHash: parsed.contentHash,
          });
        } catch (err) {
          rawChunk.push({
            fileRunId,
            lineNumber,
            rawLine: line,
            parsedOk: false,
            parseError: err instanceof Error ? err.message : String(err),
          });
        }
        if (rawChunk.length >= currentBatchSize) await flush();
        if (lineNumber % yieldEveryLines === 0) await new Promise(resolve => setImmediate(resolve));
      }
      await flush();
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      (e as Error & { ingestStats?: IngestStats }).ingestStats = {
        lineCount: lineNumber,
        rowsInserted,
        rowsFailed,
        memoryPeakMb,
      };
      throw e;
    } finally {
      loopLag.disable();
    }
    return { lineCount: lineNumber, rowsInserted, rowsFailed, memoryPeakMb };
  }

  private extractPartialStats(err: unknown): IngestStats | null {
    const stats = (err as { ingestStats?: IngestStats } | null)?.ingestStats;
    if (!stats) return null;
    if (
      typeof stats.lineCount !== 'number' ||
      typeof stats.rowsInserted !== 'number' ||
      typeof stats.rowsFailed !== 'number' ||
      typeof stats.memoryPeakMb !== 'number'
    ) {
      return null;
    }
    return stats;
  }

  async listCurrentShallow(query: { q?: string; page?: number; limit?: number; seedState?: string }) {
    await this.applyStaleEnrichedPolicy();
    const page = Math.max(1, Number(query.page ?? 1));
    const limit = Math.max(1, Math.min(100, Number(query.limit ?? 20)));
    const qb = this.currentRepo.createQueryBuilder('c');
    if (query.q?.trim()) {
      qb.andWhere('(c.organisation_number ILIKE :q OR c.name_primary ILIKE :q)', { q: `%${query.q.trim()}%` });
    }
    if (query.seedState?.trim()) {
      qb.andWhere('c.seed_state = :s', { s: query.seedState.trim().toUpperCase() });
    }
    qb.orderBy('c.updated_at', 'DESC').skip((page - 1) * limit).take(limit);
    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, limit };
  }

  async getShallowByOrg(orgNumber: string) {
    await this.applyStaleEnrichedPolicy();
    const org = orgNumber.replace(/\D/g, '');
    return this.currentRepo.findOne({ where: { organisationNumber: org } });
  }

  async listWeeklyRuns(limit = 52) {
    return this.runRepo.find({
      order: { downloadedAt: 'DESC' },
      take: Math.max(1, Math.min(200, limit)),
    });
  }

  async getOpsDashboardSummary(filters: {
    weekStart?: string;
    tenantId?: string;
    planCode?: string;
    tenantPage?: number;
    tenantLimit?: number;
  } = {}): Promise<Record<string, unknown>> {
    return this.getOpsDashboardSummaryWithFilters(filters);
  }

  async getOpsDashboardSummaryWithFilters(filters: {
    weekStart?: string;
    tenantId?: string;
    planCode?: string;
    tenantPage?: number;
    tenantLimit?: number;
  }): Promise<Record<string, unknown>> {
    const now = new Date();
    const weekStart = filters.weekStart ? new Date(filters.weekStart) : new Date(now);
    if (!filters.weekStart) {
      weekStart.setDate(now.getDate() - ((now.getDay() + 6) % 7));
      weekStart.setHours(0, 0, 0, 0);
    }
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);

    const weekRuns = await this.runRepo.find({
      where: { downloadedAt: MoreThanOrEqual(weekStart) },
      order: { downloadedAt: 'DESC' },
      take: 8,
    });
    const scopedWeekRuns = weekRuns.filter(r => r.downloadedAt < weekEnd);
    const latest = weekRuns[0] ?? null;
    const latestRunId = latest?.id ?? null;

    const [newCount, updatedCount, removedCount] = latestRunId
      ? await Promise.all([
          this.dataSource
            .query(`SELECT COUNT(1)::int AS c FROM bv_bulk_company_history WHERE file_run_id = $1 AND change_type = 'new'`, [latestRunId])
            .then(r => Number(r?.[0]?.c ?? 0)),
          this.dataSource
            .query(`SELECT COUNT(1)::int AS c FROM bv_bulk_company_history WHERE file_run_id = $1 AND change_type = 'updated'`, [latestRunId])
            .then(r => Number(r?.[0]?.c ?? 0)),
          this.dataSource
            .query(`SELECT COUNT(1)::int AS c FROM bv_bulk_company_history WHERE file_run_id = $1 AND change_type = 'removed'`, [latestRunId])
            .then(r => Number(r?.[0]?.c ?? 0)),
        ])
      : [0, 0, 0];

    const [failedLines, checkpoints, subscriptions, tenants, users, companyCounts, usageRows, dailyUsageRows] = await Promise.all([
      latestRunId
        ? this.rawRepo.count({ where: { fileRunId: latestRunId, parsedOk: false } })
        : 0,
      latestRunId
        ? this.checkpointRepo.find({ where: { fileRunId: latestRunId }, order: { checkpointSeq: 'ASC' } })
        : [],
      this.subscriptionRepo.find(),
      this.tenantRepo.find(filters.tenantId ? { where: { id: filters.tenantId } } : undefined),
      this.userRepo.find(),
      this.companyRepo
        .createQueryBuilder('c')
        .select('c.tenantId', 'tenantId')
        .addSelect('COUNT(1)', 'count')
        .groupBy('c.tenantId')
        .getRawMany<{ tenantId: string; count: string }>(),
      this.usageEventRepo
        .createQueryBuilder('u')
        .select('u.tenantId', 'tenantId')
        .addSelect(
          `COALESCE(SUM(CASE WHEN (u.cost_impact->>'apiCallCount') ~ '^[0-9]+$' THEN (u.cost_impact->>'apiCallCount')::int ELSE 0 END), 0)`,
          'apiCalls',
        )
        .where('u.createdAt >= :from', { from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) })
        .groupBy('u.tenantId')
        .getRawMany<{ tenantId: string; apiCalls: string }>(),
      this.usageEventRepo
        .createQueryBuilder('u')
        .select(`DATE_TRUNC('day', u.created_at)`, 'day')
        .addSelect(
          `COALESCE(SUM(CASE WHEN (u.cost_impact->>'apiCallCount') ~ '^[0-9]+$' THEN (u.cost_impact->>'apiCallCount')::int ELSE 0 END), 0)`,
          'apiCalls',
        )
        .where('u.createdAt >= :from', { from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) })
        .groupBy(`DATE_TRUNC('day', u.created_at)`)
        .orderBy(`DATE_TRUNC('day', u.created_at)`, 'ASC')
        .getRawMany<{ day: string; apiCalls: string }>(),
    ]);

    const companyByTenant = new Map(companyCounts.map(r => [r.tenantId, Number(r.count)]));
    const apiCallsByTenant = new Map(usageRows.map(r => [r.tenantId, Number(r.apiCalls)]));
    const usersByTenant = users.reduce<Map<string, number>>((m, u) => {
      m.set(u.tenantId, (m.get(u.tenantId) ?? 0) + 1);
      return m;
    }, new Map());

    const planByTenant = new Map(subscriptions.map(s => [s.tenantId, s.planCode ?? 'free']));
    const tenantUsage = tenants.map(t => {
      const plan = (planByTenant.get(t.id) ?? 'free').toLowerCase();
      const apiCalls30d = apiCallsByTenant.get(t.id) ?? 0;
      const included = plan === 'pro' ? 50000 : plan === 'basic' ? 5000 : 500;
      const pct = included > 0 ? Math.round((apiCalls30d / included) * 1000) / 10 : 0;
      return {
        tenantId: t.id,
        tenantName: t.name,
        planCode: plan,
        users: usersByTenant.get(t.id) ?? 0,
        companies: companyByTenant.get(t.id) ?? 0,
        apiCalls30d,
        includedCallsPerDay: included,
        packageUtilizationPct: pct,
      };
    });

    const filteredTenantUsage = tenantUsage.filter(t => {
      if (filters.tenantId && t.tenantId !== filters.tenantId) return false;
      if (filters.planCode && t.planCode !== filters.planCode.toLowerCase()) return false;
      return true;
    });
    const tenantLimit = Math.max(1, Math.min(100, Number(filters.tenantLimit ?? 10)));
    const tenantPage = Math.max(1, Number(filters.tenantPage ?? 1));
    const tenantOffset = (tenantPage - 1) * tenantLimit;
    const pagedTenantUsage = [...filteredTenantUsage]
      .sort((a, b) => b.apiCalls30d - a.apiCalls30d)
      .slice(tenantOffset, tenantOffset + tenantLimit);

    let checkpointRowsWritten = 0;
    let checkpointStagingWritten = 0;
    for (const cp of checkpoints) {
      checkpointRowsWritten += Number(cp.rowsWritten ?? 0);
      checkpointStagingWritten += Number(cp.stagingWritten ?? 0);
    }

    const checkpointsProgress = checkpoints.length
      ? {
          completedCheckpoints: checkpoints.length,
          lastCheckpointSeq: checkpoints[checkpoints.length - 1]?.checkpointSeq ?? 0,
          lastLineNumber: checkpoints[checkpoints.length - 1]?.lastLineNumber ?? 0,
          rowsWritten: checkpointRowsWritten,
          stagingWritten: checkpointStagingWritten,
        }
      : {
          completedCheckpoints: 0,
          lastCheckpointSeq: 0,
          lastLineNumber: 0,
          rowsWritten: 0,
          stagingWritten: 0,
        };

    const cfgNoRunPenalty = Number(this.config.get<number>('BV_BULK_HEALTH_NO_RUN_PENALTY', 50));
    const cfgFailedPenalty = Number(this.config.get<number>('BV_BULK_HEALTH_FAILED_RUN_PENALTY', 60));
    const cfgNotAppliedPenalty = Number(this.config.get<number>('BV_BULK_HEALTH_NOT_APPLIED_PENALTY', 20));
    const cfgFailedLinePenaltyBase = Number(this.config.get<number>('BV_BULK_HEALTH_FAILED_LINE_PENALTY_BASE', 5));
    const cfgIncompletePenalty = Number(this.config.get<number>('BV_BULK_HEALTH_INCOMPLETE_CHECKPOINT_PENALTY', 20));
    const cfgYellowThreshold = Number(this.config.get<number>('BV_BULK_HEALTH_YELLOW_THRESHOLD', 50));
    const cfgGreenThreshold = Number(this.config.get<number>('BV_BULK_HEALTH_GREEN_THRESHOLD', 80));

    let healthScore = 100;
    const healthReasons: string[] = [];
    if (!latest) {
      healthScore -= cfgNoRunPenalty;
      healthReasons.push('No weekly run detected.');
    } else if (latest.status === 'failed') {
      healthScore -= cfgFailedPenalty;
      healthReasons.push('Latest run failed.');
    } else if (latest.status !== 'applied') {
      healthScore -= cfgNotAppliedPenalty;
      healthReasons.push('Latest run not fully applied.');
    }
    if (failedLines > 0) {
      healthScore -= Math.min(25, Math.floor(failedLines / 10) + cfgFailedLinePenaltyBase);
      healthReasons.push(`Found ${failedLines} failed parse lines.`);
    }
    if (latest?.rowCount && checkpointsProgress.lastLineNumber < latest.rowCount) {
      healthScore -= cfgIncompletePenalty;
      healthReasons.push('Checkpoint progress indicates incomplete ingestion.');
    }
    healthScore = Math.max(0, Math.min(100, healthScore));
    const healthColor = healthScore >= cfgGreenThreshold ? 'green' : healthScore >= cfgYellowThreshold ? 'yellow' : 'red';

    return {
      weekly_run: {
        this_week_runs: scopedWeekRuns.length,
        latest_run: latest,
        this_week_status: latest?.status ?? 'not_run',
        parser_profile_used: latest?.parserProfile ?? this.config.get<string>('BV_BULK_PARSER_PROFILE', 'default_v1'),
        row_deltas: {
          new: newCount,
          updated: updatedCount,
          removed: removedCount,
        },
        failed_lines: failedLines,
        checkpoint_progress: checkpointsProgress,
        health_score: {
          score: healthScore,
          color: healthColor,
          reasons: healthReasons,
        },
      },
      customer_usage: {
        tenants_total: filteredTenantUsage.length,
        page: tenantPage,
        limit: tenantLimit,
        has_next: tenantOffset + pagedTenantUsage.length < filteredTenantUsage.length,
        by_tenant: pagedTenantUsage,
      },
      weekly_runs_recent: scopedWeekRuns,
      charts: {
        package_utilization_series: [...filteredTenantUsage]
          .sort((a, b) => b.packageUtilizationPct - a.packageUtilizationPct)
          .slice(0, 20)
          .map(t => ({
            tenantId: t.tenantId,
            tenantName: t.tenantName,
            utilizationPct: t.packageUtilizationPct,
          })),
        run_health_series: scopedWeekRuns.map(r => ({
          runId: r.id,
          downloadedAt: r.downloadedAt,
          status: r.status,
          score: r.status === 'applied' ? 90 : r.status === 'parsed' ? 65 : r.status === 'failed' ? 25 : 45,
        })),
        api_calls_30d_daily: dailyUsageRows.map(d => ({
          day: d.day,
          apiCalls: Number(d.apiCalls),
        })),
      },
    };
  }

  async exportOpsDashboardCsv(
    type: 'tenant_usage' | 'run_deltas',
    filters: { weekStart?: string; tenantId?: string; planCode?: string },
    actor?: { actorUserId: string | null; actorTenantId: string | null },
  ): Promise<string> {
    const summary = await this.getOpsDashboardSummaryWithFilters(filters);
    await this.auditService.log({
      tenantId: actor?.actorTenantId ?? '00000000-0000-0000-0000-000000000000',
      actorId: actor?.actorUserId ?? null,
      action: 'ops.dashboard.export_csv',
      resourceType: 'bolagsverket_bulk_ops',
      resourceId: type,
      metadata: {
        type,
        filters,
      },
    });
    if (type === 'tenant_usage') {
      const rows = (summary.customer_usage as { by_tenant: Array<Record<string, unknown>> }).by_tenant;
      const header = 'tenant_id,tenant_name,plan_code,users,companies,api_calls_30d,included_calls_per_day,package_utilization_pct';
      const body = rows
        .map(r =>
          [
            r.tenantId,
            `"${String(r.tenantName ?? '').replace(/"/g, '""')}"`,
            r.planCode,
            r.users,
            r.companies,
            r.apiCalls30d,
            r.includedCallsPerDay,
            r.packageUtilizationPct,
          ].join(','),
        )
        .join('\n');
      return `${header}\n${body}\n`;
    }
    const weekly = summary.weekly_run as Record<string, unknown>;
    const deltas = weekly.row_deltas as Record<string, unknown>;
    const cp = weekly.checkpoint_progress as Record<string, unknown>;
    const hs = weekly.health_score as Record<string, unknown>;
    return [
      'week_status,parser_profile,new_rows,updated_rows,removed_rows,failed_lines,checkpoints,last_line,rows_written,health_score,health_color',
      [
        weekly.this_week_status,
        weekly.parser_profile_used,
        deltas.new,
        deltas.updated,
        deltas.removed,
        weekly.failed_lines,
        cp.completedCheckpoints,
        cp.lastLineNumber,
        cp.rowsWritten,
        hs.score,
        hs.color,
      ].join(','),
      '',
    ].join('\n');
  }

  async getRunFileLinks(runId: string) {
    const run = await this.runRepo.findOneByOrFail({ id: runId });
    const [zip, txt] = await Promise.all([
      this.storage.getPresignedObjectUrl(run.zipObjectKey),
      this.storage.getPresignedObjectUrl(run.txtObjectKey),
    ]);
    return {
      runId: run.id,
      zip: { objectKey: run.zipObjectKey, ...zip },
      txt: { objectKey: run.txtObjectKey, ...txt },
    };
  }

  async getRuntimeSafetyReport(): Promise<Record<string, unknown>> {
    const expectedPolicy = 'noeviction';
    let redisPolicy: string | null = null;
    let redisInfoError: string | null = null;
    try {
      const client = (await this.queue.client) as {
        config: (subcommand: string, key: string) => Promise<string[]>;
      };
      const rows = await client.config('GET', 'maxmemory-policy');
      redisPolicy = Array.isArray(rows) && rows.length >= 2 ? rows[1] : null;
    } catch (err) {
      redisInfoError = err instanceof Error ? err.message : String(err);
    }

    const cfg = {
      batchSize: Math.max(50, Math.min(1000, Number(this.config.get<number>('INGESTION_BATCH_SIZE', 250)))),
      maxTxtBytes: Number(this.config.get<number>('BV_BULK_MAX_TXT_BYTES', 350_000_000)),
      yieldEveryLines: Number(this.config.get<number>('BV_BULK_YIELD_EVERY_LINES', 5000)),
      baseChunkPauseMs: Number(this.config.get<number>('BV_BULK_CHUNK_PAUSE_MS', 5)),
      autoThrottleEnabled:
        String(this.config.get<string>('BV_BULK_AUTO_THROTTLE_ENABLED', 'true')).toLowerCase() === 'true',
      autoThrottleMaxPauseMs: Number(this.config.get<number>('BV_BULK_AUTO_THROTTLE_MAX_PAUSE_MS', 100)),
      autoThrottleMemWarnMb: Number(this.config.get<number>('BV_BULK_AUTO_THROTTLE_MEM_WARN_MB', 350)),
      autoThrottleMemHardMb: Number(this.config.get<number>('BV_BULK_AUTO_THROTTLE_MEM_HARD_MB', 500)),
      ingestionMemoryWarnMb: Number(this.config.get<number>('INGESTION_MEMORY_WARN_MB', 350)),
      ingestionMemoryPauseMb: Number(this.config.get<number>('INGESTION_MEMORY_PAUSE_MB', 425)),
      ingestionMemoryFailMb: Number(this.config.get<number>('INGESTION_MEMORY_FAIL_MB', 475)),
      autoThrottleLagWarnMs: Number(this.config.get<number>('BV_BULK_AUTO_THROTTLE_EVENT_LOOP_WARN_MS', 80)),
      autoThrottleLagHardMs: Number(this.config.get<number>('BV_BULK_AUTO_THROTTLE_EVENT_LOOP_HARD_MS', 140)),
      queueConcurrency: 1,
    };

    const warnings: string[] = [];
    if (!redisPolicy) warnings.push('Unable to read Redis maxmemory-policy.');
    if (redisPolicy && redisPolicy !== expectedPolicy) {
      warnings.push(`Redis eviction policy is "${redisPolicy}" (recommended "${expectedPolicy}" for queues).`);
    }
    if (cfg.batchSize > 1000) warnings.push('INGESTION_BATCH_SIZE is above safe cap; use <= 1000 (prefer 250 for 512MB tiers).');
    if (!cfg.autoThrottleEnabled) warnings.push('Auto-throttle is disabled; ingestion may impact API latency on small instances.');
    if (cfg.autoThrottleMaxPauseMs < 20) warnings.push('Auto-throttle max pause is low; burst pressure may still occur under load.');

    return {
      status: warnings.length === 0 ? 'ok' : 'warning',
      checkedAt: new Date().toISOString(),
      redis: {
        maxmemoryPolicy: redisPolicy,
        expectedPolicy,
        safeForBullQueues: redisPolicy === expectedPolicy,
        error: redisInfoError,
      },
      bulkIngestionSafety: cfg,
      warnings,
    };
  }

  private async applyStaleEnrichedPolicy(): Promise<void> {
    const days = Math.max(1, Number(this.config.get<number>('BV_BULK_ENRICH_STALE_DAYS', 30)));
    await this.currentRepo
      .createQueryBuilder()
      .update(BvBulkCompanyCurrentEntity)
      .set({ seedState: 'STALE_ENRICHED' })
      .where(`seed_state = 'ENRICHED'`)
      .andWhere('deep_data_fresh_at IS NOT NULL')
      .andWhere(`deep_data_fresh_at < NOW() - INTERVAL '${days} days'`)
      .execute();
  }

  async requestDeepEnrichment(input: {
    organisationNumber: string;
    tenantId: string;
    userId: string | null;
    reason: BvBulkEnrichmentReason;
    priority?: number;
  }) {
    const org = input.organisationNumber.replace(/\D/g, '');
    const req = await this.enrichmentRepo.save(
      this.enrichmentRepo.create({
        organisationNumber: org,
        requestedByTenantId: input.tenantId,
        requestedByUserId: input.userId,
        reason: input.reason,
        status: 'queued',
        priority: input.priority ?? 100,
        requestedAt: new Date(),
      }),
    );
    await this.currentRepo
      .createQueryBuilder()
      .update(BvBulkCompanyCurrentEntity)
      .set({ seedState: 'ENRICH_QUEUED' })
      .where('organisation_number = :org', { org })
      .execute();

    await this.queue.add(
      BolagsverketBulkJobName.PROCESS_ENRICHMENT_REQUEST,
      { requestId: req.id } as ProcessEnrichmentRequestJobData,
      { priority: Math.max(1, 1000 - (input.priority ?? 100)), removeOnComplete: { count: 200 }, removeOnFail: { count: 200 } },
    );
    return req;
  }

  async processEnrichmentRequest(requestId: string): Promise<void> {
    const req = await this.enrichmentRepo.findOne({ where: { id: requestId } });
    if (!req) return;
    const org = req.organisationNumber.replace(/\D/g, '');
    req.status = 'started';
    req.startedAt = new Date();
    await this.enrichmentRepo.save(req);
    await this.currentRepo
      .createQueryBuilder()
      .update(BvBulkCompanyCurrentEntity)
      .set({ seedState: 'ENRICHING' })
      .where('organisation_number = :org', { org })
      .execute();
    try {
      await this.bolagsverketService.enrichAndSave(req.requestedByTenantId, org, false, null, req.requestedByUserId);
      req.status = 'finished';
      req.finishedAt = new Date();
      req.errorMessage = null;
      await this.enrichmentRepo.save(req);
      await this.currentRepo
        .createQueryBuilder()
        .update(BvBulkCompanyCurrentEntity)
        .set({ seedState: 'ENRICHED', deepDataFreshAt: new Date() })
        .where('organisation_number = :org', { org })
        .execute();
    } catch (err) {
      req.status = 'failed';
      req.finishedAt = new Date();
      req.errorMessage = err instanceof Error ? err.message : String(err);
      await this.enrichmentRepo.save(req);
      await this.currentRepo
        .createQueryBuilder()
        .update(BvBulkCompanyCurrentEntity)
        .set({ seedState: 'ENRICH_FAILED' })
        .where('organisation_number = :org', { org })
        .execute();
      this.logger.warn(`Bulk enrichment request failed for ${org}: ${req.errorMessage}`);
    }
  }

  /**
   * BullMQ jobs + recent DB file runs so operators can see what is queued vs what hit the archive tables.
   */
  async getFileIngestionQueueSnapshot(): Promise<Record<string, unknown>> {
    const counts = await this.queue.getJobCounts(
      'wait',
      'waiting',
      'paused',
      'delayed',
      'active',
      'completed',
      'failed',
    );

    const states = [
      'wait',
      'waiting',
      'delayed',
      'paused',
      'active',
      'failed',
      'completed',
    ] as const;

    const collected: Job[] = [];
    const seen = new Set<string>();
    for (const state of states) {
      let list: Job[] = [];
      try {
        const limit =
          state === 'completed' ? 6 : state === 'failed' ? 12 : state === 'active' ? 15 : 25;
        list = await this.queue.getJobs([state], 0, limit, false);
      } catch {
        continue;
      }
      for (const j of list) {
        const key = `${j.id ?? 'noid'}:${j.name}:${j.timestamp}`;
        if (seen.has(key)) continue;
        seen.add(key);
        collected.push(j);
      }
    }

    collected.sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0));

    const jobs = await Promise.all(
      collected.slice(0, 40).map(async (j: Job) => {
        let state: string;
        try {
          state = await j.getState();
        } catch {
          state = 'unknown';
        }
        return {
          id: j.id != null ? String(j.id) : null,
          name: j.name,
          state,
          data: j.data ?? {},
          timestamp: j.timestamp,
          processedOn: j.processedOn ?? null,
          finishedOn: j.finishedOn ?? null,
          failedReason: j.failedReason ?? null,
        };
      }),
    );

    const recentRuns = await this.runRepo.find({
      order: { downloadedAt: 'DESC' },
      take: 15,
      select: {
        id: true,
        sourceUrl: true,
        status: true,
        downloadedAt: true,
        rowCount: true,
        errorMessage: true,
        parserProfile: true,
        zipObjectKey: true,
        txtObjectKey: true,
        effectiveDate: true,
      },
    });

    return {
      pipelineKind: 'bolagsverket_bulk_archive',
      description: {
        headline:
          'Bolagsverket bulk ingestion is a file pipeline: download a ZIP archive, extract the bulk TXT, parse lines, and write to bv_* bulk tables. It is not the same as live per-company HVD or Företagsinformation API calls.',
        not_customer_bulk_ui:
          'This queue is not the in-app /bulk page: customer bulk jobs submit org numbers and call normal company APIs per row. They never download the national ZIP or populate bv_bulk_* from that archive.',
        tables_written: [
          'bv_bulk_file_runs — archive metadata (object keys, hashes, parser profile, status).',
          'bv_bulk_raw_rows — raw line staging; bv_bulk_run_checkpoints — resumable ingest progress.',
          'bv_bulk_companies_staging — parsed rows; bv_bulk_company_current — latest bulk snapshot per org.',
          'bv_bulk_company_history — new/updated/removed tied to file_run_id.',
        ],
        company_read_model_flags:
          'Seeding into the main company table sets sourcePayloadSummary.depth_source to "bolagsverket_bulk" and source_file_run_id so bulk-file provenance is visible next to live API snapshots.',
      },
      queueName: BOLAGSVERKET_BULK_QUEUE,
      jobNames: BolagsverketBulkJobName,
      counts,
      jobs,
      recentFileRuns: recentRuns.map(r => ({
        id: r.id,
        sourceUrl: r.sourceUrl,
        status: r.status,
        downloadedAt: r.downloadedAt,
        effectiveDate: r.effectiveDate,
        rowCount: r.rowCount,
        errorMessage: r.errorMessage,
        parserProfile: r.parserProfile,
        zipObjectKey: r.zipObjectKey,
        txtObjectKey: r.txtObjectKey,
      })),
    };
  }

  private async maybeEmitOpsAlert(runId: string): Promise<void> {
    const url = this.config.get<string>('OPS_ALERT_WEBHOOK_URL', '').trim();
    if (!url) return;
    try {
      const summary = await this.getOpsDashboardSummaryWithFilters({});
      const health = (summary.weekly_run as Record<string, unknown>).health_score as {
        score: number;
        color: 'green' | 'yellow' | 'red';
        reasons: string[];
      };
      if (health.color !== 'red') return;
      await firstValueFrom(
        this.httpService.post(url, {
          kind: 'verifyiq.bulk_ops_alert',
          severity: 'high',
          runId,
          health,
          weeklyRun: summary.weekly_run,
        }),
      );
    } catch (err) {
      this.logger.warn(`Failed to send ops alert webhook: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}


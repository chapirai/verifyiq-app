import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Queue } from 'bullmq';
import { DataSource, MoreThanOrEqual, Repository } from 'typeorm';
import { BolagsverketService } from '../companies/services/bolagsverket.service';
import { BolagsverketBulkStorageService } from './bolagsverket-bulk.storage.service';
import { BolagsverketBulkParser } from './bolagsverket-bulk.parser';
import { BolagsverketBulkUpsertService } from './bolagsverket-bulk-upsert.service';
import { BvBulkFileRunEntity } from './entities/bv-bulk-file-run.entity';
import { BvBulkRawRowEntity } from './entities/bv-bulk-raw-row.entity';
import { BvBulkCompanyStagingEntity } from './entities/bv-bulk-company-staging.entity';
import { BvBulkCompanyCurrentEntity } from './entities/bv-bulk-company-current.entity';
import { BvBulkRunCheckpointEntity } from './entities/bv-bulk-run-checkpoint.entity';
import { UsageEventEntity } from '../audit/usage-event.entity';
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

const ADMIN_READ_ROLES = ['admin'] as const;

@Injectable()
export class BolagsverketBulkService {
  private readonly logger = new Logger(BolagsverketBulkService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly storage: BolagsverketBulkStorageService,
    private readonly parser: BolagsverketBulkParser,
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

  async runWeeklyIngestion(sourceUrlOverride?: string): Promise<{
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
    const dl = await this.storage.downloadAndArchiveWeeklyZip(sourceUrl);

    const existingByHash = await this.runRepo.findOne({ where: { zipSha256: dl.zipSha256 } });
    if (existingByHash) {
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
        zipSha256: dl.zipSha256,
        txtSha256: dl.txtSha256,
        rowCount: 0,
        parserProfile,
        status: 'downloaded',
      }),
    );

    try {
      const text = dl.txtBuffer.toString('utf8');
      const lines = text.split(/\r?\n/).filter(x => x.trim().length > 0);

      const rawRows: Array<Partial<BvBulkRawRowEntity>> = [];
      const stagingRows: Array<Partial<BvBulkCompanyStagingEntity>> = [];
      for (let i = 0; i < lines.length; i += 1) {
        const line = lines[i]!;
        try {
          const parsed = this.parser.parseLineToStaging(
            line,
            parserProfile,
          );
          rawRows.push({ fileRunId: run.id, lineNumber: i + 1, rawLine: line, parsedOk: true, parseError: null });
          stagingRows.push({
            fileRunId: run.id,
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
          rawRows.push({
            fileRunId: run.id,
            lineNumber: i + 1,
            rawLine: line,
            parsedOk: false,
            parseError: err instanceof Error ? err.message : String(err),
          });
        }
      }

      const chunk = Math.max(100, Number(this.config.get<number>('BV_BULK_BATCH_SIZE', 2000)));
      let seq = 0;
      for (let i = 0; i < rawRows.length; i += chunk) {
        seq += 1;
        const rawChunk = rawRows.slice(i, i + chunk);
        const stagingChunk = stagingRows.slice(i, i + chunk);
        await this.dataSource.transaction(async manager => {
          if (rawChunk.length > 0) await manager.insert(BvBulkRawRowEntity, rawChunk);
          if (stagingChunk.length > 0) await manager.insert(BvBulkCompanyStagingEntity, stagingChunk);
          await manager.insert(BvBulkRunCheckpointEntity, {
            fileRunId: run.id,
            checkpointSeq: seq,
            lastLineNumber: Math.min(lines.length, i + chunk),
            rowsWritten: rawChunk.length,
            stagingWritten: stagingChunk.length,
          });
        });
      }

      run.rowCount = lines.length;
      run.status = 'parsed';
      await this.runRepo.save(run);

      const applied = await this.upsert.applyStagingToCurrent(run.id, now);
      const removed = await this.upsert.detectRemovedCompanies(run.id, now);
      const seeded = await this.upsert.seedCompaniesFromCurrent(
        this.config.get<string>('BV_BULK_DEFAULT_TENANT_ID', ''),
      );

      run.status = 'applied';
      await this.runRepo.save(run);
      return {
        runId: run.id,
        rowCount: lines.length,
        applied: applied.upserted,
        changed: applied.changed + removed,
        seeded,
        deduplicatedByHash: false,
      };
    } catch (err) {
      run.status = 'failed';
      run.errorMessage = err instanceof Error ? err.message : String(err);
      await this.runRepo.save(run);
      throw err;
    }
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

  async getOpsDashboardSummary(): Promise<Record<string, unknown>> {
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    weekStart.setHours(0, 0, 0, 0);

    const weekRuns = await this.runRepo.find({
      where: { downloadedAt: MoreThanOrEqual(weekStart) },
      order: { downloadedAt: 'DESC' },
      take: 8,
    });
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

    const [failedLines, checkpoints, subscriptions, tenants, users, companyCounts, usageRows] = await Promise.all([
      latestRunId
        ? this.rawRepo.count({ where: { fileRunId: latestRunId, parsedOk: false } })
        : 0,
      latestRunId
        ? this.checkpointRepo.find({ where: { fileRunId: latestRunId }, order: { checkpointSeq: 'ASC' } })
        : [],
      this.subscriptionRepo.find(),
      this.tenantRepo.find(),
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
        .addSelect(`COALESCE(SUM(CASE WHEN (u.costImpact->>'apiCallCount') ~ '^[0-9]+$' THEN (u.costImpact->>'apiCallCount')::int ELSE 0 END), 0)`, 'apiCalls')
        .where('u.createdAt >= :from', { from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) })
        .groupBy('u.tenantId')
        .getRawMany<{ tenantId: string; apiCalls: string }>(),
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

    const checkpointsProgress = checkpoints.length
      ? {
          completedCheckpoints: checkpoints.length,
          lastCheckpointSeq: checkpoints[checkpoints.length - 1]?.checkpointSeq ?? 0,
          lastLineNumber: checkpoints[checkpoints.length - 1]?.lastLineNumber ?? 0,
          rowsWritten: checkpoints.reduce((a, c) => a + c.rowsWritten, 0),
          stagingWritten: checkpoints.reduce((a, c) => a + c.stagingWritten, 0),
        }
      : {
          completedCheckpoints: 0,
          lastCheckpointSeq: 0,
          lastLineNumber: 0,
          rowsWritten: 0,
          stagingWritten: 0,
        };

    return {
      weekly_run: {
        this_week_runs: weekRuns.length,
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
      },
      customer_usage: {
        tenants_total: tenants.length,
        by_tenant: tenantUsage.sort((a, b) => b.apiCalls30d - a.apiCalls30d),
      },
      weekly_runs_recent: weekRuns,
    };
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
}


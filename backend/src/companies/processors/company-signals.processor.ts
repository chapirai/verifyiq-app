import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Job } from 'bullmq';
import { Repository } from 'typeorm';
import { CompanySignalEntity } from '../entities/company-signal.entity';
import { CompanyEntity } from '../entities/company.entity';
import { FinancialStatementEntity } from '../../financial/entities/financial-statement.entity';
import { OwnershipLinkEntity } from '../../ownership/entities/ownership-link.entity';
import { CompanyCaseEntity } from '../../company-cases/entities/company-case.entity';
import {
  COMPANY_SIGNALS_QUEUE,
  CompanySignalsJobData,
  CompanySignalsJobName,
} from '../queues/company-signals.queue';
import { SIGNAL_ENGINE_VERSION, computeAllSignalsForCompany } from '../signals/signals-catalog';
import { DecisionRefreshTriggerService } from '../services/decision-refresh-trigger.service';

@Processor(COMPANY_SIGNALS_QUEUE)
export class CompanySignalsProcessor extends WorkerHost {
  private readonly logger = new Logger(CompanySignalsProcessor.name);

  constructor(
    @InjectRepository(CompanyEntity)
    private readonly companyRepo: Repository<CompanyEntity>,
    @InjectRepository(CompanySignalEntity)
    private readonly signalRepo: Repository<CompanySignalEntity>,
    @InjectRepository(FinancialStatementEntity)
    private readonly financialRepo: Repository<FinancialStatementEntity>,
    @InjectRepository(OwnershipLinkEntity)
    private readonly ownershipRepo: Repository<OwnershipLinkEntity>,
    @InjectRepository(CompanyCaseEntity)
    private readonly companyCaseRepo: Repository<CompanyCaseEntity>,
    private readonly decisionRefreshTrigger: DecisionRefreshTriggerService,
  ) {
    super();
  }

  async process(job: Job<CompanySignalsJobData>): Promise<void> {
    if (job.name !== CompanySignalsJobName.RECOMPUTE_ORG) {
      this.logger.warn(`Ignoring unknown job name ${job.name}`);
      return;
    }
    const { tenantId, organisationNumber, engineVersion } = job.data;
    const org = organisationNumber.replace(/\D/g, '');
    if (org.length !== 10 && org.length !== 12) {
      this.logger.warn(`Invalid org in signal job ${org}`);
      return;
    }
    const company = await this.companyRepo.findOne({ where: { tenantId, organisationNumber: org } });
    if (!company) {
      this.logger.warn(`Company ${org} not in tenant index — skipping signals`);
      return;
    }
    const [financialStatementsCount, ownershipLinksCount, companyCasesCount, latestFs] = await Promise.all([
      this.financialRepo.count({ where: { tenantId, organisationNumber: org } }),
      this.ownershipRepo.count({ where: { tenantId, ownedOrganisationNumber: org, isCurrent: true } }),
      this.companyCaseRepo.count({ where: { tenantId, organisationNumber: org } }),
      this.financialRepo.findOne({
        where: { tenantId, organisationNumber: org },
        order: { fiscalYearEnd: 'DESC', updatedAt: 'DESC' },
      }),
    ]);
    const version = engineVersion || SIGNAL_ENGINE_VERSION;
    const latestRevenue = latestFs?.revenue != null ? Number(latestFs.revenue) : null;
    const latestNetResult = latestFs?.netResult != null ? Number(latestFs.netResult) : null;
    const latestEquityRatio =
      latestFs?.totalEquity != null && latestFs?.totalAssets != null && Number(latestFs.totalAssets) !== 0
        ? Number(latestFs.totalEquity) / Number(latestFs.totalAssets)
        : null;
    const rows = computeAllSignalsForCompany(company, {
      financialStatementsCount,
      ownershipLinksCount,
      companyCasesCount,
      latestRevenue,
      latestNetResult,
      latestEquityRatio,
    });
    const entities = rows.map((r) =>
      this.signalRepo.create({
        tenantId,
        organisationNumber: org,
        signalType: r.signalType,
        engineVersion: version,
        score: String(r.score),
        explanation: r.explanation,
        jobId: job.id != null ? String(job.id) : null,
      }),
    );
    await this.signalRepo.save(entities);
    await this.decisionRefreshTrigger.enqueue({
      tenantId,
      organisationNumber: org,
      reason: 'signal_recompute',
      triggerId: job.id != null ? String(job.id) : `${Date.now()}`,
    });
    this.logger.log(`Stored ${entities.length} signal rows for ${org} (${version})`);
  }
}

import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ScopeGuard } from '../common/guards/scope.guard';
import { RequiredScopes } from '../common/decorators/required-scopes.decorator';
import { CompanyRefreshOrchestratorService } from './company-refresh-orchestrator.service';
import { IngestionService } from './ingestion.service';

@Controller('admin')
@UseGuards(JwtAuthGuard, ScopeGuard)
@RequiredScopes('companies:write')
export class IngestionController {
  constructor(
    private readonly ingestionService: IngestionService,
    private readonly refreshOrchestrator: CompanyRefreshOrchestratorService,
  ) {}

  @Post('ingestion/bolagsverket/weekly-bulk/start')
  async startWeeklyBulkPlaceholder() {
    // TODO: wire to queue orchestrator once ingestion module owns the bulk workflow end-to-end.
    return { accepted: true, message: 'Use /bolagsverket-bulk/runs/weekly until ingestion orchestration is fully moved.' };
  }

  @Get('ingestion/runs/:id')
  async runById(@Param('id') id: string) {
    return this.ingestionService.getRun(id);
  }

  @Post('companies/:orgnr/rebuild')
  async rebuildCompany(@Param('orgnr') orgnr: string) {
    // TODO: wire read-model rebuild job.
    return { accepted: true, orgnr };
  }

  @Post('companies/:orgnr/refresh')
  async refreshCompany(@Param('orgnr') orgnr: string) {
    return this.refreshOrchestrator.refreshCompany(orgnr);
  }

  @Get('companies/:orgnr/source-status')
  async companySourceStatus(@Param('orgnr') orgnr: string) {
    const statuses = await this.ingestionService.getCompanySourceStatuses(orgnr);
    return { orgnr: orgnr.replace(/\D/g, ''), statuses };
  }
}


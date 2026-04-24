import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BolagsverketService } from '../companies/services/bolagsverket.service';
import { IngestionService } from './ingestion.service';
import { SourceRefreshResult } from './source-refresh-result.type';

@Injectable()
export class CompanyRefreshOrchestratorService {
  constructor(
    private readonly bolagsverketService: BolagsverketService,
    private readonly ingestionService: IngestionService,
    private readonly config: ConfigService,
  ) {}

  async refreshCompany(orgnr: string): Promise<SourceRefreshResult[]> {
    const normalized = orgnr.replace(/\D/g, '');
    const staleDays = Math.max(1, Number(this.config.get<number>('BV_BULK_ENRICH_STALE_DAYS', 31)));
    const freshUntil = new Date(Date.now() + staleDays * 24 * 60 * 60 * 1000);
    const nowIso = new Date().toISOString();
    try {
      const profile = await this.bolagsverketService.getCompleteCompanyData(normalized);
      const sources = Array.isArray(profile?.providerFetchDiagnostics) ? profile.providerFetchDiagnostics : [];
      const results: SourceRefreshResult[] = [];
      for (const s of sources) {
        const status = String(s.status ?? 'unknown');
        const isOk = status === 'loaded' || status === 'ok' || status === 'success';
        await this.ingestionService.upsertCompanySourceStatus({
          organisationNumber: normalized,
          sourceName: String(s.provider ?? 'unknown'),
          status,
          errorMessage: isOk ? null : String(s.message ?? 'Source refresh failed'),
          dataFreshUntil: isOk ? freshUntil : null,
        });
        results.push({
          source: String(s.provider ?? 'unknown'),
          status: isOk ? 'ok' : 'failed',
          errorMessage: isOk ? undefined : String(s.message ?? 'Source refresh failed'),
          attemptedAt: nowIso,
        });
      }
      return results;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await this.ingestionService.upsertCompanySourceStatus({
        organisationNumber: normalized,
        sourceName: 'profile.aggregate',
        status: 'failed',
        errorMessage: msg,
        dataFreshUntil: null,
      });
      return [{ source: 'profile.aggregate', status: 'failed', errorMessage: msg, attemptedAt: nowIso }];
    }
  }
}


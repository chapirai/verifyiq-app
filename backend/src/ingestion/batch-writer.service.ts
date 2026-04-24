import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { BvBulkRawRowEntity } from '../bolagsverket-bulk/entities/bv-bulk-raw-row.entity';
import { BvBulkCompanyStagingEntity } from '../bolagsverket-bulk/entities/bv-bulk-company-staging.entity';
import { BvBulkRunCheckpointEntity } from '../bolagsverket-bulk/entities/bv-bulk-run-checkpoint.entity';
import { RawRecordLineageEntity } from './entities/raw-record-lineage.entity';

@Injectable()
export class BatchWriterService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
  ) {}

  async writeStagingBatch(input: {
    fileRunId: string;
    checkpointSeq: number;
    lastLineNumber: number;
    sourceFileKey: string;
    rawRows: Array<Partial<BvBulkRawRowEntity>>;
    stagingRows: Array<Partial<BvBulkCompanyStagingEntity>>;
  }): Promise<{ rowsWritten: number; stagingWritten: number; failedRows: number }> {
    const rowsWritten = input.rawRows.length;
    const stagingWritten = input.stagingRows.length;
    const failedRows = input.rawRows.reduce((acc, row) => acc + (row.parsedOk ? 0 : 1), 0);

    const timeoutMs = Math.max(1000, Number(this.config.get<number>('INGESTION_DB_WRITE_TIMEOUT_MS', 30000)));
    await Promise.race([
      this.dataSource.transaction(async manager => {
      if (rowsWritten > 0) await manager.insert(BvBulkRawRowEntity, input.rawRows);
      if (stagingWritten > 0) await manager.insert(BvBulkCompanyStagingEntity, input.stagingRows);

      const lineageRows = input.stagingRows.map((row, idx) => ({
        runId: input.fileRunId,
        provider: 'bolagsverket',
        companyOrgnr: row.identityValue ?? null,
        rowNumber: Number(input.rawRows[idx]?.lineNumber ?? 0),
        rawRecordHash: String(row.contentHash ?? ''),
        sourceFileKey: input.sourceFileKey,
      }));
      if (lineageRows.length > 0) await manager.insert(RawRecordLineageEntity, lineageRows);

      await manager.insert(BvBulkRunCheckpointEntity, {
        fileRunId: input.fileRunId,
        checkpointSeq: input.checkpointSeq,
        lastLineNumber: input.lastLineNumber,
        rowsWritten,
        stagingWritten,
      });
      }),
      new Promise((_resolve, reject) =>
        setTimeout(() => reject(new Error(`DB batch write timed out after ${timeoutMs}ms`)), timeoutMs),
      ),
    ]);

    return { rowsWritten, stagingWritten, failedRows };
  }
}


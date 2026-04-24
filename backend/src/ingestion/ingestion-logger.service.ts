import { Injectable, Logger } from '@nestjs/common';
import { IngestionProgress } from './ingestion-progress.type';

@Injectable()
export class IngestionLoggerService {
  private readonly logger = new Logger(IngestionLoggerService.name);

  progress(p: IngestionProgress): void {
    this.logger.log(JSON.stringify({ kind: 'ingestion_progress', ...p }));
  }
}


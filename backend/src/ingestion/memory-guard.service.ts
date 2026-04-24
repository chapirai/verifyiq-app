import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MemoryGuardService {
  constructor(private readonly config: ConfigService) {}

  snapshot(): { rssMb: number; warnMb: number; failMb: number; unsafe: boolean } {
    const rssMb = Math.round(process.memoryUsage().rss / (1024 * 1024));
    const warnMb = Number(this.config.get<number>('INGESTION_MEMORY_WARN_MB', 500));
    const failMb = Number(this.config.get<number>('INGESTION_MEMORY_FAIL_MB', 700));
    return { rssMb, warnMb, failMb, unsafe: rssMb >= failMb };
  }
}


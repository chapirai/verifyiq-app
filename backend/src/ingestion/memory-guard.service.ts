import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type MemorySnapshot = {
  rssMb: number;
  heapUsedMb: number;
  heapTotalMb: number;
  externalMb: number;
  arrayBuffersMb: number;
  warnMb: number;
  pauseMb: number;
  failMb: number;
  at: string;
};

@Injectable()
export class MemoryGuardService {
  constructor(private readonly config: ConfigService) {}

  snapshot(): MemorySnapshot {
    const mem = process.memoryUsage();
    const warnMb = Number(this.config.get<number>('INGESTION_MEMORY_WARN_MB', 350));
    const pauseMb = Number(this.config.get<number>('INGESTION_MEMORY_PAUSE_MB', 425));
    const failMb = Number(this.config.get<number>('INGESTION_MEMORY_FAIL_MB', 475));
    return {
      rssMb: Math.round(mem.rss / (1024 * 1024)),
      heapUsedMb: Math.round(mem.heapUsed / (1024 * 1024)),
      heapTotalMb: Math.round(mem.heapTotal / (1024 * 1024)),
      externalMb: Math.round(mem.external / (1024 * 1024)),
      arrayBuffersMb: Math.round(mem.arrayBuffers / (1024 * 1024)),
      warnMb,
      pauseMb,
      failMb,
      at: new Date().toISOString(),
    };
  }

  shouldWarn(s: MemorySnapshot): boolean {
    return s.rssMb >= s.warnMb;
  }

  shouldPause(s: MemorySnapshot): boolean {
    return s.rssMb >= s.pauseMb;
  }

  shouldFail(s: MemorySnapshot): boolean {
    return s.rssMb >= s.failMb;
  }

  async recoverFromCriticalPressure(): Promise<MemorySnapshot> {
    if (typeof global.gc === 'function') global.gc();
    await new Promise(resolve => setTimeout(resolve, 250));
    return this.snapshot();
  }
}


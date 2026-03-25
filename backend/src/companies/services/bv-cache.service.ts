import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BvFetchSnapshotEntity } from '../entities/bv-fetch-snapshot.entity';

export const CACHE_TTL_DAYS = 30;

export interface CacheCheckResult {
  isFresh: boolean;
  snapshot: BvFetchSnapshotEntity | null;
  ageInDays: number | null;
}

@Injectable()
export class BvCacheService {
  constructor(
    @InjectRepository(BvFetchSnapshotEntity)
    private readonly snapshotRepo: Repository<BvFetchSnapshotEntity>,
  ) {}

  async checkFreshness(tenantId: string, organisationsnummer: string): Promise<CacheCheckResult> {
    const snapshot = await this.snapshotRepo.findOne({
      where: {
        tenantId,
        organisationsnummer,
        fetchStatus: 'success',
      },
      order: { fetchedAt: 'DESC' },
    });

    if (!snapshot) {
      return { isFresh: false, snapshot: null, ageInDays: null };
    }

    const ageMs = Date.now() - snapshot.fetchedAt.getTime();
    const ageInDays = Math.floor(ageMs / (1000 * 60 * 60 * 24));
    const isFresh = ageInDays < CACHE_TTL_DAYS;

    return { isFresh, snapshot, ageInDays };
  }

  async listSnapshots(
    tenantId: string,
    organisationsnummer: string,
    limit = 20,
  ): Promise<BvFetchSnapshotEntity[]> {
    return this.snapshotRepo.find({
      where: { tenantId, organisationsnummer },
      order: { fetchedAt: 'DESC' },
      take: limit,
    });
  }

  async createSnapshot(data: Partial<BvFetchSnapshotEntity>): Promise<BvFetchSnapshotEntity> {
    const entity = this.snapshotRepo.create(data);
    return this.snapshotRepo.save(entity);
  }
}

import 'dotenv/config';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { BolagsverketBulkUpsertService } from '../bolagsverket-bulk/bolagsverket-bulk-upsert.service';

function getArg(flag: string): string | null {
  const idx = process.argv.indexOf(flag);
  if (idx < 0) return null;
  return process.argv[idx + 1] ?? null;
}

async function main(): Promise<void> {
  const runId = getArg('--run-id');
  if (!runId) {
    throw new Error('Missing required --run-id <uuid>');
  }
  const tenantId = (getArg('--tenant-id') ?? process.env.BV_BULK_DEFAULT_TENANT_ID ?? '').trim();
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  try {
    const upsert = app.get(BolagsverketBulkUpsertService);
    const now = new Date();
    const applied = await upsert.applyStagingToCurrent(runId, now);
    const removed = await upsert.detectRemovedCompanies(runId, now);
    const seeded = tenantId ? await upsert.seedCompaniesFromCurrent(tenantId) : 0;
    console.log(
      JSON.stringify(
        {
          runId,
          tenantId: tenantId || null,
          appliedUpserted: applied.upserted,
          appliedChanged: applied.changed,
          removed,
          seeded,
          at: now.toISOString(),
        },
        null,
        2,
      ),
    );
  } finally {
    await app.close();
  }
}

void main().catch((err) => {
  console.error('Promote staging failed:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});


import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCompanyIndexes1000000000005 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      -- =============================================================================
      -- Migration 005: Add Company Search Indexes
      --
      -- Adds indexes to support the companies list endpoint with search & pagination:
      --   • idx_companies_tenant_status    – Fast filtering by tenant + status
      --   • idx_companies_tenant_legal_name – Fast ILIKE search by tenant + legal_name
      --
      -- The (tenant_id, organisation_number) unique index already exists from
      -- migration 001 and is retained unchanged.
      -- =============================================================================

      -- ---------------------------------------------------------------------------
      -- 1. (tenant_id, status) index
      --    Supports: GET /api/v1/companies?status=ACTIVE
      --    Reason: status filter is expected to be the most frequent filter and
      --    status values have low cardinality, making a composite index with
      --    tenant_id very effective.
      -- ---------------------------------------------------------------------------
      CREATE INDEX IF NOT EXISTS idx_companies_tenant_status
        ON companies (tenant_id, status);

      -- ---------------------------------------------------------------------------
      -- 2. (tenant_id, legal_name) index
      --    Supports: GET /api/v1/companies?q=nordic (ILIKE %q% fuzzy search)
      --    Reason: prefix-anchored ILIKE queries benefit from a btree index;
      --    for wildcard-both-sides ILIKE (e.g. %nordic%) a GIN/trigram index
      --    would be optimal, but a btree index still improves tenant isolation
      --    filtering and allows the planner to choose efficient plans.
      -- ---------------------------------------------------------------------------
      CREATE INDEX IF NOT EXISTS idx_companies_tenant_legal_name
        ON companies (tenant_id, legal_name);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_companies_tenant_legal_name;
      DROP INDEX IF EXISTS idx_companies_tenant_status;
    `);
  }
}

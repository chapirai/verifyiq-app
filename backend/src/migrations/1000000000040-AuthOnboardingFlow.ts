import { MigrationInterface, QueryRunner } from 'typeorm';

export class AuthOnboardingFlow1000000000040 implements MigrationInterface {
  name = 'AuthOnboardingFlow1000000000040';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);

    await queryRunner.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS status VARCHAR(64) NOT NULL DEFAULT 'active',
      ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ NULL,
      ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT false
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS pending_signups (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) NOT NULL UNIQUE,
        full_name VARCHAR(255) NOT NULL,
        company_name VARCHAR(255) NULL,
        status VARCHAR(64) NOT NULL DEFAULT 'pending_verification',
        email_verified_at TIMESTAMPTZ NULL,
        tenant_id UUID NULL REFERENCES tenants(id) ON DELETE SET NULL,
        user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS email_verification_tokens (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        pending_signup_id UUID NOT NULL REFERENCES pending_signups(id) ON DELETE CASCADE,
        email VARCHAR(255) NOT NULL,
        token_hash VARCHAR(128) NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        consumed_at TIMESTAMPTZ NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_pending_signup
      ON email_verification_tokens(pending_signup_id, created_at DESC)
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS password_setup_tokens (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_type VARCHAR(32) NOT NULL DEFAULT 'setup',
        token_hash VARCHAR(128) NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        consumed_at TIMESTAMPTZ NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_password_setup_tokens_user
      ON password_setup_tokens(user_id, created_at DESC)
    `);

    await queryRunner.query(`
      UPDATE users
      SET email_verified_at = COALESCE(email_verified_at, NOW()),
          status = CASE WHEN is_active THEN 'active' ELSE 'suspended' END
      WHERE email_verified_at IS NULL OR status NOT IN ('pending_verification', 'verified_pending_password', 'active', 'suspended')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS password_setup_tokens`);
    await queryRunner.query(`DROP TABLE IF EXISTS email_verification_tokens`);
    await queryRunner.query(`DROP TABLE IF EXISTS pending_signups`);
    await queryRunner.query(`
      ALTER TABLE users
      DROP COLUMN IF EXISTS must_change_password,
      DROP COLUMN IF EXISTS email_verified_at,
      DROP COLUMN IF EXISTS status
    `);
  }
}


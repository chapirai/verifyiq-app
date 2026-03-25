import { MigrationInterface, QueryRunner } from 'typeorm';

export class EnterpriseDatasetTables1000000000004 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      -- =============================================================================
      -- Migration 004: Enterprise Dataset Tables
      --
      -- Creates:
      --   • ownership_links            – Corporate ownership graph edges
      --   • beneficial_owners          – UBO records per company
      --   • workplaces                 – SCB/CFAR workplace establishments
      --   • dataset_entitlements       – Per-tenant feature-flag & quota config
      --   • dataset_usage_events       – Immutable billing/audit event log
      --   • financial_statements       – Annual report financials per org/year
      --   • credit_ratings             – Provider-sourced credit scores
      --   • credit_decision_templates  – Configurable rule-sets for decisions
      --   • credit_decision_results    – Logged decision outcomes
      --   • risk_indicator_configs     – Named risk-flag rule definitions
      --   • risk_indicator_results     – Evaluated risk flag snapshots
      --   • property_ownerships        – Real-estate ownership records
      --   • person_enrichments         – Cached natural-person data
      --   • company_cases              – Regulatory/legal cases per company
      --   • business_prohibitions      – Näringsforbud records per person
      -- =============================================================================

      -- ---------------------------------------------------------------------------
      -- 1. ownership_links
      --    Each row is a directed ownership edge: owner → owned company.
      -- ---------------------------------------------------------------------------
      CREATE TABLE IF NOT EXISTS ownership_links (
        id                        UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id                 UUID          NOT NULL,
        owner_type                VARCHAR(32)   NOT NULL,
        owner_person_id           UUID,
        owner_company_id          UUID,
        owner_name                VARCHAR(255)  NOT NULL,
        owner_organisation_number VARCHAR(32),
        owner_personnummer        VARCHAR(32),
        owned_company_id          UUID,
        owned_organisation_number VARCHAR(32)   NOT NULL,
        owned_company_name        VARCHAR(255)  NOT NULL,
        ownership_percentage      DECIMAL(8,4),
        ownership_type            VARCHAR(64),
        ownership_class           VARCHAR(64),
        control_percentage        DECIMAL(8,4),
        valid_from                DATE,
        valid_to                  DATE,
        is_current                BOOLEAN       NOT NULL DEFAULT TRUE,
        source_data               JSONB         NOT NULL DEFAULT '{}'::jsonb,
        created_at                TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        updated_at                TIMESTAMPTZ   NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_ownership_links_tenant_owned_org
        ON ownership_links (tenant_id, owned_organisation_number);

      CREATE INDEX IF NOT EXISTS idx_ownership_links_tenant_owner_org
        ON ownership_links (tenant_id, owner_organisation_number);

      -- ---------------------------------------------------------------------------
      -- 2. beneficial_owners
      --    UBO records tied to a Swedish organisation number.
      -- ---------------------------------------------------------------------------
      CREATE TABLE IF NOT EXISTS beneficial_owners (
        id                              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id                       UUID         NOT NULL,
        organisation_number             VARCHAR(32)  NOT NULL,
        company_id                      UUID,
        person_name                     VARCHAR(255) NOT NULL,
        personnummer                    VARCHAR(32),
        ownership_percentage            DECIMAL(8,4),
        control_percentage              DECIMAL(8,4),
        ownership_type                  VARCHAR(64),
        is_alternative_beneficial_owner BOOLEAN      NOT NULL DEFAULT FALSE,
        alternative_reason              TEXT,
        is_current                      BOOLEAN      NOT NULL DEFAULT TRUE,
        valid_from                      DATE,
        valid_to                        DATE,
        source_type                     VARCHAR(64),
        source_data                     JSONB        NOT NULL DEFAULT '{}'::jsonb,
        created_at                      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        updated_at                      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_beneficial_owners_tenant_org
        ON beneficial_owners (tenant_id, organisation_number);

      -- ---------------------------------------------------------------------------
      -- 3. workplaces
      --    SCB/CFAR establishment records linked to a legal entity.
      -- ---------------------------------------------------------------------------
      CREATE TABLE IF NOT EXISTS workplaces (
        id                   UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id            UUID         NOT NULL,
        organisation_number  VARCHAR(32)  NOT NULL,
        company_id           UUID,
        cfar_number          VARCHAR(32),
        workplace_name       VARCHAR(255),
        phone                VARCHAR(64),
        email                VARCHAR(255),
        postal_address       JSONB        NOT NULL DEFAULT '{}'::jsonb,
        delivery_address     JSONB,
        coordinates          JSONB,
        municipality_code    VARCHAR(16),
        municipality_name    VARCHAR(128),
        county_code          VARCHAR(8),
        county_name          VARCHAR(128),
        industry_code        VARCHAR(32),
        industry_description TEXT,
        is_active            BOOLEAN      NOT NULL DEFAULT TRUE,
        source_data          JSONB        NOT NULL DEFAULT '{}'::jsonb,
        created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        updated_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_workplaces_tenant_org
        ON workplaces (tenant_id, organisation_number);

      -- ---------------------------------------------------------------------------
      -- 4. dataset_entitlements
      --    Per-tenant dataset access flags and monthly quota settings.
      -- ---------------------------------------------------------------------------
      CREATE TABLE IF NOT EXISTS dataset_entitlements (
        id                   UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id            UUID         NOT NULL,
        dataset_family       VARCHAR(64)  NOT NULL,
        is_enabled           BOOLEAN      NOT NULL DEFAULT TRUE,
        monthly_quota        INTEGER,
        current_month_usage  INTEGER      NOT NULL DEFAULT 0,
        quota_reset_at       TIMESTAMPTZ,
        plan_tier            VARCHAR(64),
        metadata             JSONB        NOT NULL DEFAULT '{}'::jsonb,
        created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        updated_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        UNIQUE (tenant_id, dataset_family)
      );

      -- ---------------------------------------------------------------------------
      -- 5. dataset_usage_events
      --    Immutable append-only event log for billing and quota tracking.
      -- ---------------------------------------------------------------------------
      CREATE TABLE IF NOT EXISTS dataset_usage_events (
        id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id      UUID         NOT NULL,
        user_id        UUID,
        dataset_family VARCHAR(64)  NOT NULL,
        action         VARCHAR(128) NOT NULL,
        resource_id    VARCHAR(256),
        resource_type  VARCHAR(64),
        billing_units  INTEGER      NOT NULL DEFAULT 1,
        metadata       JSONB        NOT NULL DEFAULT '{}'::jsonb,
        occurred_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_dataset_usage_events_tenant_family_occurred
        ON dataset_usage_events (tenant_id, dataset_family, occurred_at);

      CREATE INDEX IF NOT EXISTS idx_dataset_usage_events_tenant_occurred
        ON dataset_usage_events (tenant_id, occurred_at);

      -- ---------------------------------------------------------------------------
      -- 6. financial_statements
      --    Annual report key figures per organisation and fiscal year.
      -- ---------------------------------------------------------------------------
      CREATE TABLE IF NOT EXISTS financial_statements (
        id                   UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id            UUID          NOT NULL,
        organisation_number  VARCHAR(32)   NOT NULL,
        company_id           UUID,
        fiscal_year          VARCHAR(16)   NOT NULL,
        fiscal_year_start    DATE,
        fiscal_year_end      DATE,
        report_type          VARCHAR(64),
        currency             VARCHAR(8)    NOT NULL DEFAULT 'SEK',
        revenue              DECIMAL(20,2),
        operating_result     DECIMAL(20,2),
        net_result           DECIMAL(20,2),
        total_assets         DECIMAL(20,2),
        total_equity         DECIMAL(20,2),
        total_liabilities    DECIMAL(20,2),
        cash_and_equivalents DECIMAL(20,2),
        number_of_employees  INTEGER,
        ratios               JSONB         NOT NULL DEFAULT '{}'::jsonb,
        raw_data             JSONB         NOT NULL DEFAULT '{}'::jsonb,
        source_type          VARCHAR(64),
        document_id          UUID,
        created_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        updated_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        UNIQUE (tenant_id, organisation_number, fiscal_year)
      );

      CREATE INDEX IF NOT EXISTS idx_financial_statements_tenant_org
        ON financial_statements (tenant_id, organisation_number);

      -- ---------------------------------------------------------------------------
      -- 7. credit_ratings
      --    Point-in-time credit scores from external providers.
      -- ---------------------------------------------------------------------------
      CREATE TABLE IF NOT EXISTS credit_ratings (
        id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id           UUID         NOT NULL,
        organisation_number VARCHAR(32)  NOT NULL,
        company_id          UUID,
        rating_provider     VARCHAR(128),
        rating              VARCHAR(32),
        rating_score        INTEGER,
        rating_description  TEXT,
        risk_class          VARCHAR(64),
        rated_at            TIMESTAMPTZ,
        valid_until         TIMESTAMPTZ,
        is_current          BOOLEAN      NOT NULL DEFAULT TRUE,
        source_data         JSONB        NOT NULL DEFAULT '{}'::jsonb,
        created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_credit_ratings_tenant_org_rated
        ON credit_ratings (tenant_id, organisation_number, rated_at);

      -- ---------------------------------------------------------------------------
      -- 8. credit_decision_templates
      --    Tenant-scoped rule-sets that drive automated credit decisions.
      -- ---------------------------------------------------------------------------
      CREATE TABLE IF NOT EXISTS credit_decision_templates (
        id                       UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id                UUID         NOT NULL,
        name                     VARCHAR(255) NOT NULL,
        description              TEXT,
        is_active                BOOLEAN      NOT NULL DEFAULT TRUE,
        target_entity_type       VARCHAR(32)  NOT NULL DEFAULT 'company',
        rules                    JSONB        NOT NULL DEFAULT '[]'::jsonb,
        approve_conditions       JSONB        NOT NULL DEFAULT '{}'::jsonb,
        reject_conditions        JSONB        NOT NULL DEFAULT '{}'::jsonb,
        manual_review_conditions JSONB        NOT NULL DEFAULT '{}'::jsonb,
        metadata                 JSONB        NOT NULL DEFAULT '{}'::jsonb,
        created_by_user_id       UUID,
        created_at               TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        updated_at               TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_credit_decision_templates_tenant_active
        ON credit_decision_templates (tenant_id, is_active);

      -- ---------------------------------------------------------------------------
      -- 9. credit_decision_results
      --    Logged outcome of running a decision template against an entity.
      -- ---------------------------------------------------------------------------
      CREATE TABLE IF NOT EXISTS credit_decision_results (
        id                    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id             UUID         NOT NULL,
        template_id           UUID,
        template_name         VARCHAR(255),
        organisation_number   VARCHAR(32),
        personnummer          VARCHAR(32),
        entity_type           VARCHAR(32)  NOT NULL DEFAULT 'company',
        decision              VARCHAR(32)  NOT NULL,
        score                 INTEGER,
        reasons               JSONB        NOT NULL DEFAULT '[]'::jsonb,
        rule_results          JSONB        NOT NULL DEFAULT '[]'::jsonb,
        input_data            JSONB        NOT NULL DEFAULT '{}'::jsonb,
        requested_by_user_id  UUID,
        decided_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        updated_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_credit_decision_results_tenant_org_decided
        ON credit_decision_results (tenant_id, organisation_number, decided_at);

      -- ---------------------------------------------------------------------------
      -- 10. risk_indicator_configs
      --     Named, configurable risk-flag definitions per tenant.
      -- ---------------------------------------------------------------------------
      CREATE TABLE IF NOT EXISTS risk_indicator_configs (
        id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id           UUID         NOT NULL,
        name                VARCHAR(255) NOT NULL,
        description         TEXT,
        category            VARCHAR(64)  NOT NULL,
        dataset_family      VARCHAR(64),
        is_enabled          BOOLEAN      NOT NULL DEFAULT TRUE,
        severity            VARCHAR(32)  NOT NULL DEFAULT 'medium',
        threshold           JSONB        NOT NULL DEFAULT '{}'::jsonb,
        condition_logic     JSONB        NOT NULL DEFAULT '{}'::jsonb,
        metadata            JSONB        NOT NULL DEFAULT '{}'::jsonb,
        created_by_user_id  UUID,
        created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_risk_indicator_configs_tenant_category_enabled
        ON risk_indicator_configs (tenant_id, category, is_enabled);

      -- ---------------------------------------------------------------------------
      -- 11. risk_indicator_results
      --     Snapshot of a single evaluated risk indicator for an entity.
      -- ---------------------------------------------------------------------------
      CREATE TABLE IF NOT EXISTS risk_indicator_results (
        id                 UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id          UUID         NOT NULL,
        config_id          UUID,
        indicator_name     VARCHAR(255) NOT NULL,
        indicator_category VARCHAR(64)  NOT NULL,
        organisation_number VARCHAR(32),
        personnummer       VARCHAR(32),
        entity_type        VARCHAR(32)  NOT NULL DEFAULT 'company',
        is_triggered       BOOLEAN      NOT NULL DEFAULT FALSE,
        severity           VARCHAR(32),
        trigger_reason     TEXT,
        trigger_details    JSONB        NOT NULL DEFAULT '{}'::jsonb,
        evaluated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        created_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        updated_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_risk_indicator_results_tenant_org_evaluated
        ON risk_indicator_results (tenant_id, organisation_number, evaluated_at);

      -- ---------------------------------------------------------------------------
      -- 12. property_ownerships
      --     Real-estate holdings for both companies and natural persons.
      -- ---------------------------------------------------------------------------
      CREATE TABLE IF NOT EXISTS property_ownerships (
        id                       UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id                UUID         NOT NULL,
        owner_type               VARCHAR(32)  NOT NULL,
        owner_organisation_number VARCHAR(32),
        owner_personnummer       VARCHAR(32),
        owner_name               VARCHAR(255) NOT NULL,
        property_designation     VARCHAR(256),
        property_type            VARCHAR(64),
        municipality_code        VARCHAR(16),
        municipality_name        VARCHAR(128),
        county_code              VARCHAR(8),
        county_name              VARCHAR(128),
        tax_value                DECIMAL(20,2),
        tax_value_year           INTEGER,
        ownership_share          DECIMAL(8,4),
        acquisition_date         DATE,
        address                  JSONB        NOT NULL DEFAULT '{}'::jsonb,
        source_data              JSONB        NOT NULL DEFAULT '{}'::jsonb,
        is_current               BOOLEAN      NOT NULL DEFAULT TRUE,
        created_at               TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        updated_at               TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_property_ownerships_tenant_owner_org
        ON property_ownerships (tenant_id, owner_organisation_number);

      CREATE INDEX IF NOT EXISTS idx_property_ownerships_tenant_owner_pnr
        ON property_ownerships (tenant_id, owner_personnummer);

      -- ---------------------------------------------------------------------------
      -- 13. person_enrichments
      --     Cached natural-person data (folkbokföring + derived enrichments).
      --     One row per (tenant_id, personnummer) – upserted on refresh.
      -- ---------------------------------------------------------------------------
      CREATE TABLE IF NOT EXISTS person_enrichments (
        id                    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id             UUID         NOT NULL,
        personnummer          VARCHAR(32)  NOT NULL,
        party_id              UUID,
        full_name             VARCHAR(255),
        first_name            VARCHAR(128),
        last_name             VARCHAR(128),
        gender                VARCHAR(16),
        is_deceased           BOOLEAN      NOT NULL DEFAULT FALSE,
        deceased_date         DATE,
        official_address      JSONB        NOT NULL DEFAULT '{}'::jsonb,
        municipality_code     VARCHAR(16),
        municipality_name     VARCHAR(128),
        county_code           VARCHAR(8),
        board_assignments     JSONB        NOT NULL DEFAULT '[]'::jsonb,
        beneficial_owner_links JSONB       NOT NULL DEFAULT '[]'::jsonb,
        business_prohibition  JSONB        NOT NULL DEFAULT '{}'::jsonb,
        sanctions_status      JSONB        NOT NULL DEFAULT '{}'::jsonb,
        pep_status            JSONB        NOT NULL DEFAULT '{}'::jsonb,
        data_permissions      JSONB        NOT NULL DEFAULT '{}'::jsonb,
        source_type           VARCHAR(64),
        enriched_at           TIMESTAMPTZ,
        created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        updated_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        UNIQUE (tenant_id, personnummer)
      );

      -- ---------------------------------------------------------------------------
      -- 14. company_cases
      --     Regulatory, legal, or administrative cases linked to a company.
      -- ---------------------------------------------------------------------------
      CREATE TABLE IF NOT EXISTS company_cases (
        id                   UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id            UUID         NOT NULL,
        organisation_number  VARCHAR(32)  NOT NULL,
        company_id           UUID,
        case_number          VARCHAR(128),
        case_type            VARCHAR(64),
        case_type_description TEXT,
        status               VARCHAR(64),
        source_authority     VARCHAR(128),
        effective_date       DATE,
        closed_date          DATE,
        description          TEXT,
        payload              JSONB        NOT NULL DEFAULT '{}'::jsonb,
        created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        updated_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_company_cases_tenant_org
        ON company_cases (tenant_id, organisation_number);

      -- ---------------------------------------------------------------------------
      -- 15. business_prohibitions
      --     Näringsforbud (business prohibition) records per natural person.
      -- ---------------------------------------------------------------------------
      CREATE TABLE IF NOT EXISTS business_prohibitions (
        id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id        UUID         NOT NULL,
        personnummer     VARCHAR(32)  NOT NULL,
        person_name      VARCHAR(255),
        prohibition_type VARCHAR(64),
        is_active        BOOLEAN      NOT NULL DEFAULT TRUE,
        from_date        DATE,
        to_date          DATE,
        reason           TEXT,
        source_authority VARCHAR(128),
        linked_companies JSONB        NOT NULL DEFAULT '[]'::jsonb,
        payload          JSONB        NOT NULL DEFAULT '{}'::jsonb,
        created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_business_prohibitions_tenant_pnr
        ON business_prohibitions (tenant_id, personnummer);

      CREATE INDEX IF NOT EXISTS idx_business_prohibitions_tenant_active
        ON business_prohibitions (tenant_id, is_active);

      -- ---------------------------------------------------------------------------
      -- 16. Extend monitoring_subscriptions with new dataset-aware columns
      -- ---------------------------------------------------------------------------
      ALTER TABLE monitoring_subscriptions
        ADD COLUMN IF NOT EXISTS subject_type         VARCHAR(64)  NOT NULL DEFAULT 'company',
        ADD COLUMN IF NOT EXISTS organisation_number  VARCHAR(64),
        ADD COLUMN IF NOT EXISTS personnummer         VARCHAR(32),
        ADD COLUMN IF NOT EXISTS dataset_families     JSONB        NOT NULL DEFAULT '[]'::jsonb,
        ADD COLUMN IF NOT EXISTS alert_config         JSONB        NOT NULL DEFAULT '{}'::jsonb;

      -- ---------------------------------------------------------------------------
      -- 17. Extend monitoring_alerts with dataset-family and acknowledgement columns
      -- ---------------------------------------------------------------------------
      ALTER TABLE monitoring_alerts
        ADD COLUMN IF NOT EXISTS dataset_family          VARCHAR(64),
        ADD COLUMN IF NOT EXISTS organisation_number     VARCHAR(32),
        ADD COLUMN IF NOT EXISTS personnummer            VARCHAR(32),
        ADD COLUMN IF NOT EXISTS is_acknowledged         BOOLEAN      NOT NULL DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS acknowledged_at         TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS acknowledged_by_user_id UUID;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      -- Revert monitoring_alerts extensions
      ALTER TABLE monitoring_alerts
        DROP COLUMN IF EXISTS acknowledged_by_user_id,
        DROP COLUMN IF EXISTS acknowledged_at,
        DROP COLUMN IF EXISTS is_acknowledged,
        DROP COLUMN IF EXISTS personnummer,
        DROP COLUMN IF EXISTS organisation_number,
        DROP COLUMN IF EXISTS dataset_family;

      -- Revert monitoring_subscriptions extensions
      ALTER TABLE monitoring_subscriptions
        DROP COLUMN IF EXISTS alert_config,
        DROP COLUMN IF EXISTS dataset_families,
        DROP COLUMN IF EXISTS personnummer,
        DROP COLUMN IF EXISTS organisation_number,
        DROP COLUMN IF EXISTS subject_type;

      -- Drop in reverse dependency order (most dependent first).
      DROP TABLE IF EXISTS business_prohibitions;
      DROP TABLE IF EXISTS company_cases;
      DROP TABLE IF EXISTS person_enrichments;
      DROP TABLE IF EXISTS property_ownerships;
      DROP TABLE IF EXISTS risk_indicator_results;
      DROP TABLE IF EXISTS risk_indicator_configs;
      DROP TABLE IF EXISTS credit_decision_results;
      DROP TABLE IF EXISTS credit_decision_templates;
      DROP TABLE IF EXISTS credit_ratings;
      DROP TABLE IF EXISTS financial_statements;
      DROP TABLE IF EXISTS dataset_usage_events;
      DROP TABLE IF EXISTS dataset_entitlements;
      DROP TABLE IF EXISTS workplaces;
      DROP TABLE IF EXISTS beneficial_owners;
      DROP TABLE IF EXISTS ownership_links;
    `);
  }
}

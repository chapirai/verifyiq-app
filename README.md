# VerifyIQ

## Overview

VerifyIQ is a **multi-tenant backend API** and **Next.js dashboard** oriented around **Swedish company registry and financial data**. The system:

- Integrates with **Bolagsverket** APIs (high-value dataset “HVD”, Företagsinformation, Finansinspektionen-related organisation data, documents, officers, cases, etc.).
- Persists **raw API payloads**, runs **SQL- and application-driven parsing/enrichment**, and exposes **normalized “serving” read models** (e.g. `bv_read.*`) for dashboards and APIs.
- Supports **annual report ZIP / iXBRL ingestion**, storage in **object storage**, parsing (including **Arelle** via Python in container images), and **API-facing financial tables** derived from normalized facts.
- Provides **tenant-scoped authentication** (JWT access + refresh), **role-based access** for sensitive operations, **Stripe** billing hooks, **API keys** (live/sandbox), and **OAuth 2.0 client credentials** for machine clients.
- Includes additional domains visible in code: **bulk jobs**, **screening**, **risk / risk indicators**, **onboarding cases**, **credit decisioning**, **webhooks**, **monitoring**, **documents**, **reports**, **parties**, **person enrichment**, **property/ownership summaries**, **company cases**, **audit and usage events**, and **entitlements**.

**Primary user types (from code):**

- **Dashboard users** — email/password login per tenant; JWT includes `tenantId`, `role`, `sub` (user id).
- **API clients** — OAuth client-credentials tokens carry `role: 'api_client'`, `scopes[]`, `environment` (`live` | `sandbox`), and `clientId`; certain routes enforce scopes and **per-day Redis quotas** by subscription plan.

**Problem space (inferred from implementation, not marketing copy):** operational tooling for compliance, credit, and data teams that need **traceable** fetches from Bolagsverket, **historical snapshots**, **parsed annual reports**, and **governed API access** with billing and audit hooks.

---

## High-Level Architecture

| Layer | Technology | Role |
|--------|------------|------|
| **Frontend** | Next.js 14 (App Router), React 18, Tailwind | Authenticated dashboard: companies, workspace, billing, API keys, OAuth clients, bulk jobs, sandbox helpers, etc. |
| **Backend** | NestJS 10, TypeORM 0.3, PostgreSQL | REST API under global prefix `api/v1`; modules per domain; ValidationPipe globally. |
| **Cache / queues** | Redis, BullMQ (`@nestjs/bullmq`) | Job queues: annual report parse, BV enrichment, bulk jobs, screening, reports. |
| **Object storage** | MinIO client (`minio` package); S3-compatible keys (`AWS_*`, `S3_BUCKET`) | Stored documents, annual report blobs, etc. |
| **External APIs** | Bolagsverket (HTTP via `@nestjs/axios` / `axios`) | Source of truth for registry data; token URLs configurable per product. |
| **Billing** | Stripe (`stripe` package) | Checkout, portal, webhooks; subscription rows linked to tenants. |
| **Scheduled / periodic work** | `@nestjs/schedule` | e.g. `BvPipelineWorker` drains SQL-backed parse/refresh queues on a fixed interval. |

There is **no** `render.yaml` or `.github/workflows` in this repository snapshot; deployment is inferred from **Dockerfile(s)** and **docker-compose.yml** only.

---

## Repository Structure

```
verifyiq-app/
├── backend/                 # NestJS application (@verifyiq/backend)
│   ├── src/
│   │   ├── main.ts          # HTTP server, CORS, global prefix, ValidationPipe
│   │   ├── app.module.ts    # Root module wiring
│   │   ├── app.controller.ts# GET /api/v1  health
│   │   ├── data-source.ts   # TypeORM CLI DataSource (migrations)
│   │   ├── seed.ts          # Optional demo tenant/users (raw SQL via pg)
│   │   ├── config/          # env loader + zod validate-env
│   │   ├── migrations/      # Versioned SQL migrations (source of truth for schema)
│   │   ├── auth/            # Login, signup, refresh, logout, JWT strategy
│   │   ├── users/, tenants/, parties/, companies/, annual-reports/, …
│   │   ├── common/          # Guards, decorators, ApiQuotaModule, interceptors
│   │   └── …                # See “Backend modules” below
│   ├── tools/               # Python iXBRL helper(s) for Arelle pipeline
│   ├── requirements-arelle.txt
│   ├── Dockerfile           # Compose references backend/Dockerfile
│   └── docker-entrypoint.sh # Runs TypeORM migrations then `node dist/main.js`
├── frontend/                # Next.js app (@verifyiq/frontend)
│   └── src/
│       ├── app/             # App Router pages (marketing + (app) dashboard)
│       ├── components/    # UI shell, company panels, etc.
│       ├── lib/             # api.ts, auth.ts (localStorage session), api-base-url
│       └── types/           # Shared TS types for API payloads
├── docs/                    # UI reference assets + reference-ui-spec.md (not API docs)
├── docker-compose.yml       # postgres, redis, minio, backend, frontend
├── Dockerfile               # Root image (comment: Render vs backend/Dockerfile alignment)
├── tsconfig.base.json       # Shared TS strict options for backend
└── package.json             # Root: devDependency playwright only (no workspace orchestration)
```

---

## Application Components

### Web dashboard (`frontend/`)

- **Framework:** Next.js 14.2, React 18, TypeScript, Tailwind.
- **Routes (actual `page.tsx` files):** landing (`app/page.tsx`), auth (`login`, `signup`, `forgot-password`, `reset-password`), and an **`(app)` group** with dashboard, companies list/detail/workspace, search, settings, billing (+ success/cancel), API keys, OAuth API clients, API sandbox, bulk jobs.
- **API access:** `src/lib/api.ts` uses `fetch` to `${NEXT_PUBLIC_API_BASE_URL}` with `Authorization: Bearer` from `localStorage` (`src/lib/auth.ts`). On **401**, the client clears the session.
- **Default API URL:** `frontend/src/lib/api-base-url.ts` defaults `NEXT_PUBLIC_API_BASE_URL` to `http://localhost:3001/api/v1` if unset — **docker-compose** overrides to `http://localhost:4000/api/v1` for the `frontend` service. Local setups should set this explicitly to match the backend port.

### API service (`backend/`)

- Single Nest application; **global prefix** `api/v1` (`main.ts`).
- **CORS:** `FRONTEND_URL`, `FRONTEND_URLS`, plus `http://localhost:3000`; allows `Stripe-Signature` header for billing webhooks.
- **Raw body:** `NestFactory.create(AppModule, { rawBody: true })` — used for Stripe webhook verification.

### Auth

- **User auth:** `POST /auth/login`, `POST /auth/signup`, `POST /auth/refresh`, `POST /auth/logout`; JWT access (15m in `AuthModule`) + refresh tokens stored hashed in DB (`RefreshToken` entity).
- **Machine auth:** `POST /oauth/token` (`grant_type=client_credentials`) issues JWTs with `role: 'api_client'` and configured `scopes` (`oauth.service.ts`).

### Billing

- `BillingModule` — Stripe checkout/portal, subscription upsert, webhook idempotency table (`billing_webhook_events` in migration `1000000000032`).

### Ingestion / pipelines

- **Bolagsverket orchestration** — `CompaniesService`, `BolagsverketService`, `BvPipelineService`, SQL functions under migrations (`bv_parsed`, `bv_pipeline` schemas).
- **Annual reports** — upload/HVD ingest → MinIO → `annual_report_files` → BullMQ `annual-report-parse` → Arelle/normalize → serving + API table rows.

### Workers / processors

- Implemented as **BullMQ `@Processor` classes** and one **`@Interval` worker** (see [Background jobs](#background-jobs--queues--scheduled-processes)).

---

## Frontend Architecture

| Topic | Implementation |
|--------|------------------|
| **Routing** | App Router: `(app)` segment for authenticated shell (`AppShell` in `(app)/layout.tsx`). |
| **Data fetching** | Central `api` object in `src/lib/api.ts` — no React Query in `package.json`; components call `api.*` directly. |
| **Auth session** | `localStorage` keys `verifyiq_access_token`, `verifyiq_refresh_token`, `verifyiq_user`; cookie flag set on login for SameSite=Lax. |
| **UI** | Tailwind + local components under `src/components/`. |

---

## Backend Architecture

| Topic | Implementation |
|--------|------------------|
| **Runtime** | Node 20 (Dockerfile), NestJS 10. |
| **Modules** | One Nest module per domain folder (`*.module.ts`), imported in `app.module.ts`. |
| **Persistence** | TypeORM `autoLoadEntities: true`, **`synchronize: false`** — schema from **migrations** only. |
| **Validation** | `class-validator` / `class-transformer` DTOs + global `ValidationPipe` (`whitelist`, `transform`). |
| **Cross-cutting** | `JwtAuthGuard` (Passport JWT), `RolesGuard` + `@Roles()`, `ScopeGuard` + `@RequiredScopes()` for OAuth scopes, `ApiQuotaInterceptor` + `@ApiQuotaBucket()` for rate limits on selected routes. |

---

## API Endpoints

All paths below are **relative to** `http(s)://<host>:<port>/api/v1` (e.g. local `http://localhost:4000/api/v1`).  
**Auth column:** `JWT` = `JwtAuthGuard` on class or method; `none` = public; `mixed` = some routes guarded inside controller.

### Root / health

| Method | Path | Purpose | Auth |
|--------|------|---------|------|
| GET | `/` | Service health JSON (`AppController`) | none |

### Auth (`auth/`)

| Method | Path | Purpose | Auth |
|--------|------|---------|------|
| GET | `/auth/tenant/:slug` | Resolve tenant id by slug | none |
| POST | `/auth/login` | Email/password login | none |
| POST | `/auth/signup` | Create tenant + admin user + default entitlements + sandbox key + sandbox OAuth client | none |
| POST | `/auth/refresh` | Rotate tokens | none |
| POST | `/auth/logout` | Revoke refresh token | none |

### Users (`users/`)

| Method | Path | Purpose | Auth |
|--------|------|---------|------|
| GET | `/users/me` | Current user profile | JWT + RolesGuard |
| GET | `/users` | List users in tenant | JWT; roles `admin`, `compliance` |
| GET | `/users/:id` | User by id | JWT; roles `admin`, `compliance` |
| POST | `/users` | Create user | JWT; role `admin` |
| PATCH | `/users/:id` | Update user | JWT; role `admin` |

### Tenants (`tenants/`)

| Method | Path | Purpose | Auth |
|--------|------|---------|------|
| GET | `/tenants` | List tenants | JWT (guard on controller) |
| GET | `/tenants/:id` | Tenant by id | JWT |
| POST | `/tenants` | Create tenant | JWT |

### Companies (`companies/`)

| Method | Path | Purpose | Auth |
|--------|------|---------|------|
| POST | `/companies/lookup` | Orchestrated Bolagsverket lookup | JWT |
| GET | `/companies` | List companies (query DTO) | JWT |
| GET | `/companies/:id` | Company by id | JWT |
| GET | `/companies/:orgNumber/freshness` | Freshness metadata | JWT |
| GET | `/companies/:orgNumber/snapshots` | Snapshot history | JWT |

**Note:** Class-level `ScopeGuard` + `@RequiredScopes('companies:read')` + quota interceptor apply to this controller (OAuth clients need the scope).

### Company serving read API (`company-serving/`)

Read models from **`bv_read.*`** tables (see [Database](#database-overview)).

| Method | Path | Purpose | Auth |
|--------|------|---------|------|
| GET | `/company-serving/:organisationNumber/overview` | Overview row | JWT; scope `companies:read`; quota bucket `company-serving` |
| GET | `/company-serving/:organisationNumber/officers` | Officers | same |
| GET | `/company-serving/:organisationNumber/financial-reports` | FI reports | same |
| GET | `/company-serving/:organisationNumber/documents` | HVD documents | same |
| GET | `/company-serving/:organisationNumber/fi-cases` | FI cases | same |
| GET | `/company-serving/:organisationNumber/share-capital` | Share capital | same |
| GET | `/company-serving/:organisationNumber/engagements` | Engagements | same |

### Company lookups (`company-lookups/`)

| Method | Path | Purpose | Auth |
|--------|------|---------|------|
| POST | `/company-lookups` | Create lookup request + orchestration + parse enqueue | JWT; `companies:read` + quota |
| GET | `/company-lookups/:lookupRequestId/status` | Lookup status | JWT; `companies:read` + quota |

### Bolagsverket integration surface (`bolagsverket/`)

Controller is **`@UseGuards(JwtAuthGuard)`** on the class. Large surface: health/isalive, proxy-style **POST** endpoints for organisation/document/officer/financial/case/enrichment calls, **GET** snapshot and raw-payload inspection. **Raw payload GET routes** call `assertRawPayloadAccess` — only roles **`admin`** and **`compliance`** (see `RAW_PAYLOAD_ALLOWED_ROLES` in `bolagsverket.controller.ts`).

Representative routes (not exhaustive — see controller for full list):

| Method | Path pattern | Purpose |
|--------|----------------|--------|
| GET | `/bolagsverket/health`, `/bolagsverket/hvd/isalive`, `/bolagsverket/fi/isalive` | Connectivity checks |
| POST | `/bolagsverket/company`, `/bolagsverket/hvd/organisationer`, `/bolagsverket/company-information`, `/bolagsverket/fi/organisationer`, … | Trigger / cache Bolagsverket fetches |
| POST | `/bolagsverket/documents`, `/bolagsverket/hvd/dokumentlista` | Document list / metadata |
| GET | `/bolagsverket/documents/:dokumentId/download`, `/bolagsverket/hvd/dokument/:dokumentId` | Document download / proxy |
| GET | `/bolagsverket/snapshots`, `/bolagsverket/snapshots/:id`, `/bolagsverket/snapshots/history`, … | Snapshot introspection |
| GET | `/bolagsverket/raw-payloads/...` | Raw payload browsing (**restricted roles**) |
| GET | `/bolagsverket/stored-documents`, `.../:id/download` | Stored document metadata/download |

### Annual reports (`annual-reports/`)

Class-level **`JwtAuthGuard`**. Selected routes add **`ScopeGuard`**, **`@RequiredScopes('financials:read')`**, and **`ApiQuotaInterceptor`** / `@ApiQuotaBucket('financial-api')` for the public-style financial table endpoint.

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/annual-reports/upload` | Register ZIP (multipart); optional enqueue parse |
| POST | `/annual-reports/from-bv-document/:documentId` | Register from stored BV document |
| POST | `/annual-reports/ingest-hvd-dokument` | Server-side HVD fetch → storage → DB |
| POST | `/annual-reports/files/:fileId/enqueue-parse` | Queue parse |
| POST | `/annual-reports/jobs/backfill` | Queue backfill |
| POST | `/annual-reports/files/:fileId/rebuild-serving` | Rebuild serving |
| GET | `/annual-reports/companies/:organisationNumber/latest` | Latest header |
| GET | `/annual-reports/companies/:organisationNumber/history` | Header history |
| GET | `/annual-reports/companies/:organisationNumber/financials` | Financials |
| GET | `/annual-reports/companies/:organisationNumber/workspace-read-model` | Workspace read model |
| GET | `/annual-reports/companies/:organisationNumber/api-financial-table` | API financial table (**scope + quota**); may return **202** while processing |
| POST | `/annual-reports/companies/:organisationNumber/api-financial-table/rebuild` | Manual rebuild |
| GET | `/annual-reports/companies/:organisationNumber/financial-comparison` | Multi-year comparison |
| GET | `/annual-reports/files/:fileId/meta`, `/annual-reports/files/:fileId/detail` | File metadata/detail |

### OAuth (`oauth.controller.ts` — **no** path prefix beyond global `api/v1`)

| Method | Path | Purpose | Auth |
|--------|------|---------|------|
| POST | `/oauth/token` | Client credentials token | none (client id/secret) |
| POST | `/oauth/revoke` | Revoke client | none |
| GET | `/me/oauth-clients` | List OAuth clients for tenant | JWT |
| POST | `/me/oauth-clients` | Create client (returns secret once) | JWT |
| DELETE | `/me/oauth-clients/:id` | Revoke client | JWT |

### API keys (`api-keys/`)

| Method | Path | Purpose | Auth |
|--------|------|---------|------|
| GET | `/api-keys` | List keys | JWT |
| GET | `/api-keys/sandbox/connection` | Sandbox connection metadata | JWT |
| POST | `/api-keys/sandbox/provision` | Ensure sandbox API key | JWT |
| POST | `/api-keys` | Create API key | JWT |
| DELETE | `/api-keys/:id` | Revoke key | JWT |

### Billing (`billing/`)

| Method | Path | Purpose | Auth |
|--------|------|---------|------|
| GET | `/billing/plans` | List plan metadata | JWT |
| GET | `/billing/subscription` | Current subscription | JWT |
| POST | `/billing/subscription` | Upsert subscription record | JWT |
| POST | `/billing/checkout-session` | Stripe Checkout | JWT |
| POST | `/billing/portal-session` | Stripe Customer Portal | JWT |
| POST | `/billing/payment/confirm` | Confirm payment session | JWT |
| POST | `/billing/webhook` | Stripe webhooks | none (Stripe signature); uses `rawBody` |

### Entitlements (`entitlements/`)

| Method | Path | Purpose | Auth |
|--------|------|---------|------|
| GET | `/entitlements` | List entitlements | JWT |
| PUT | `/entitlements/:datasetFamily` | Set entitlement | JWT |
| GET | `/entitlements/usage/summary` | Usage summary | JWT |
| GET | `/entitlements/usage/events` | Usage events | JWT |
| POST | `/entitlements/usage` | Record usage | JWT |
| POST | `/entitlements/initialize` | Initialize defaults | JWT |

### Bulk (`bulk/`)

| Method | Path | Purpose | Auth |
|--------|------|---------|------|
| POST | `/bulk/jobs` | Create bulk job | JWT |
| GET | `/bulk/jobs` | List jobs | JWT |
| GET | `/bulk/jobs/:id` | Job detail | JWT |
| GET | `/bulk/jobs/:id/items` | Line items | JWT |
| POST | `/bulk/jobs/:id/retry-failures` | Retry failures | JWT |
| GET | `/bulk/jobs/:id/download` | CSV download | JWT |

### Screening (`screening/`)

| Method | Path | Purpose | Auth |
|--------|------|---------|------|
| POST | `/screening/run` | Enqueue / run screening | JWT |
| GET | `/screening/queue` | Queue status | JWT |
| POST | `/screening/matches/:id/review` | Review match | JWT |
| POST | `/screening/linked-entity` | Linked entity action | JWT |

### Risk & risk indicators

**`risk/`:** `POST /risk/assess`, `GET /risk/party/:partyId/latest` (JWT).  
**`risk-indicators/`:** configs CRUD, evaluate, list results (JWT).

### Other controllers (JWT unless noted)

- **`documents/`** — upload intents, list, download intent (`JwtAuthGuard` on class).
- **`reports/`** — `POST /reports/generate`, `GET /reports` (JWT).
- **`webhooks/`** — endpoints CRUD + deliver + list deliveries (JWT on class).
- **`monitoring/`** — subscriptions and alerts (JWT).
- **`audit/`** — `JwtAuthGuard`; **role check inside handlers** for audit/usage event lists — roles `admin`, `audit`, `evidence`, `compliance` per `AUDIT_READ_ROLES` in `audit.controller.ts`.
- **`parties/`** — CRUD-style party management (JWT).
- **`ownership/`** — ownership links, beneficial owners, workplaces; **per-route** `@RequiredScopes('ownership:read' | 'ownership:write')` + quota bucket `ownership`. **Note:** service layer still uses a **hard-coded demo tenant UUID** in `ownership.controller.ts` — data tenancy for this module does not follow JWT `tenantId` in the controller as written.
- **`financial/`** — statements and ratings (JWT); **hard-coded stub tenant** in controller.
- **`credit-decisioning/`** — templates and decisions (JWT).
- **`company-cases/`** — cases and prohibitions (JWT).
- **`person-enrichment/`** — list/get/update enrichment (JWT).
- **`property/`** — ownership summaries (JWT).
- **`onboarding/onboarding/cases`** — cases lifecycle (JWT).
- **`cache-policies/`**, **`change-events/`**, **`lineage/`** — operational / lineage APIs (JWT).

---

## Authentication and Authorization

### Dashboard (human) users

1. **Signup** creates a tenant, an `admin` user, default entitlements, sandbox API key, and sandbox OAuth client (`auth.service.ts`).
2. **Login** validates password → issues **access JWT** (15m) and **refresh token** (persisted hashed).
3. **`JwtAuthGuard`** (`common/jwt-auth.guard.ts`) extracts **Bearer** token, validates with `JWT_SECRET`, requires payload fields `sub`, `tenantId`, `role`.
4. **`RolesGuard`** + `@Roles(...)` restrict specific routes (e.g. user management, audit reads).
5. **`TenantId` decorator** resolves tenant from `request.user.tenantId` or `X-Tenant-Id` header.

### OAuth API clients

1. **`POST /oauth/token`** with `grant_type=client_credentials`, `client_id`, `client_secret`, optional `scope`.
2. JWT payload includes `role: 'api_client'`, `tenantId`, `environment`, `scopes`, `clientId`, `authType` (`oauth.service.ts`).
3. **`ScopeGuard`** — if handler/class has `@RequiredScopes(...)`, users with `role === 'api_client'` must include **all** required scopes; non–`api_client` roles **bypass** scope checks (guard returns true).
4. **`ApiQuotaInterceptor`** — if `@ApiQuotaBucket` is set, increments **per-day Redis counter** keyed by tenant, environment, client, and bucket; sets rate-limit headers; returns 429 when over limit. Plan limits come from **`subscriptions.plan_code`** via `ApiQuotaService`.

### Bolagsverket raw payload access

Separate from OAuth: **JWT role** must be `admin` or `compliance` for raw payload read routes (`bolagsverket.controller.ts`).

---

## External Connections and Integrations

| Integration | Purpose in codebase | Where configured / used |
|-------------|---------------------|---------------------------|
| **Bolagsverket HVD** | Organisation, documents, etc. | `BV_HVD_*`, `BV_CLIENT_ID` / `BV_CLIENT_SECRET` in `validate-env.ts` / `bolagsverket.client.ts` |
| **Bolagsverket Företagsinformation** | Extended company information | `BV_FORETAGSINFO_*` vars; optional OAuth vs static header/token auth |
| **Stripe** | Checkout, portal, subscription webhooks | `STRIPE_*` optional in env schema; `billing.service.ts`, `billing.controller.ts` |
| **PostgreSQL** | Primary datastore | `PG_*` required |
| **Redis** | BullMQ + quota counters + annual-report locks | `REDIS_*` required |
| **S3-compatible object storage** | MinIO / R2 / AWS S3 | `MINIO_*`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `S3_BUCKET` — `annual-reports.service.ts`, `bv-document-storage.service.ts`, etc. |
| **Python / Arelle** | iXBRL extraction in annual report pipeline | `ARELLE_PYTHON`, `ARELLE_EXTRACT_SCRIPT`, `ARELLE_EXTRACT_TIMEOUT_MS`; Dockerfile installs venv + `requirements-arelle.txt` |
| **Screening provider** | Abstraction with mock in repo | `screening/providers/mock-screening.provider.ts` (appears to be mock/default for dev) |

No email (SendGrid, etc.) or dedicated APM SDK appeared in backend `package.json` dependencies.

---

## Database Overview

### Engine and access pattern

- **PostgreSQL** (docker-compose uses `postgres:16-alpine`).
- **TypeORM** for application entities; **synchronize: false**.
- **Schema evolution:** SQL files under `backend/src/migrations/` executed via TypeORM DataSource (`data-source.ts` points to compiled `migrations/*.js` in `dist/`).
- **Heavy use of SQL migrations** for Bolagsverket mirror tables, `bv_pipeline` queue tables, `bv_parsed` loader functions, `bv_read` views/tables, and annual report tables — this is the authoritative schema documentation.

### Logical schemas / areas (from migrations and code)

| Area | Description |
|------|-------------|
| **`public` app tables** | Tenants, users, refresh tokens, companies, parties, documents, reports, webhooks, monitoring, onboarding, screening, risk, bulk jobs, integration tokens, subscriptions, API keys, OAuth clients, billing webhook events, audit/usage, ownership entities, annual report entities, etc. |
| **`bolagsverket_*`** | Normalised tables for API responses (organisation, persons, documents, financials, cases, …) plus `bolagsverket_api_calls` audit of outbound HTTP. Created in `1000000000002-BolagsverketSchema.ts` and related migrations. |
| **`bv_raw_payloads`** | Raw JSON payloads keyed for idempotent ingestion (`1000000000007` etc.). |
| **`bv_parsed` / loader functions** | PL/pgSQL functions dispatching parsing from raw payloads into structured tables (`bv_parsed.dispatch_raw_payload` updated in `1000000000028`). |
| **`bv_pipeline` schema** | `lookup_requests`, `parse_queue`, `refresh_queue`, enqueue function `bv_pipeline.enqueue_raw_payload_for_parse` (`1000000000028`). |
| **`bv_read` schema** | Current-state **read models** consumed by `CompanyServingReadService` (`company_overview_current`, `company_officers_current`, etc.). |
| **`annual_report_*` tables** | File storage metadata, parse runs, XBRL facts/contexts, mapped values, API financial rows, import workspace (`1000000000029`, `1000000000030`, `1000000000031`, …). |

### Core database domains (grouped)

- **Identity & tenancy:** `tenants`, `users`, `refresh_tokens`.
- **Billing:** `subscriptions`, `billing_webhook_events`, Stripe customer ids stored in service layer (see `BillingService` / entities).
- **API access:** `api_keys`, `oauth_clients`.
- **Companies & BV mirror:** `companies`, `bolagsverket_*`, `bv_raw_payloads`, `bv_fetch_snapshots`, stored documents, document lists, etc.
- **Pipeline & serving:** `bv_pipeline.*` queues; `bv_read.*` current tables/views; enrichment queue consumer writes serving data.
- **Annual reports:** `annual_report_files`, entries, parse runs, facts, labels, units, contexts, mapped values, summaries, imports, source files, sections, API financial rows.
- **Operational:** `bulk_jobs`, `screening_*`, `onboarding_*`, `audit_logs`, `audit_events`, usage tables, `webhook_*`, `monitoring_*`.
- **Ownership / financial stubs:** `ownership_*` entities, `financial_*` entities (separate from annual report API table).

### Data flow (Bolagsverket → read API)

1. **Ingress:** Dashboard or API calls `POST /companies/lookup` or Bolagsverket controller endpoints → `BolagsverketService` / `BvPersistenceService` persists responses and raw payloads.
2. **Queue:** Raw payload id enqueued into **`bv_pipeline.parse_queue`** (SQL function or app).
3. **Parse:** `BvPipelineService.processParseQueue` (invoked from API flows and periodically from **`BvPipelineWorker`**) runs DB-side dispatch into **`bv_parsed`** loaders.
4. **Refresh:** `refresh_queue` models downstream refresh when data is stale.
5. **Serving:** Materialized / physical **`bv_read.*`** structures hold **current** projection per tenant + org.
6. **Read API:** `GET /company-serving/:org/...` reads **`bv_read`** via raw SQL in `CompanyServingReadService`.
7. **UI:** Frontend `api.getCompanyServing*` methods (see `api.ts` remainder) consume JSON for workspace/dashboard panels.

### Data flow (annual reports)

1. **Ingest:** Upload ZIP or HVD ingest or BV stored document → binary in **MinIO/S3** → row in **`annual_report_files`**.
2. **Queue:** BullMQ job on queue name **`annual-report-parse`** (`AnnualReportParseProcessor`).
3. **Parse / normalize:** `AnnualReportPipelineService`, Arelle invocation (`annual-report-arelle.service.ts`), normalization and mapped summary services.
4. **Persist:** XBRL graph tables + `annual_report_api_financial_rows` etc.
5. **Expose:** Workspace read model endpoint; **`api-financial-table`** for external API consumers (scope + Redis quota + optional async 202).

---

## Background Jobs / Queues / Scheduled Processes

| Mechanism | Name / interval | Responsibility |
|-----------|-----------------|----------------|
| **BullMQ processor** | `annual-report-parse` | `AnnualReportParseProcessor` — parse, backfill, rebuild serving, auto-ingest HVD batches; concurrency from `ANNUAL_REPORT_PARSE_CONCURRENCY`. |
| **BullMQ processor** | `bv-enrichment` (constant `BV_ENRICHMENT_QUEUE` in `bv-enrichment.queue.ts`) | `BvEnrichmentProcessor` — enrichment jobs from companies module. |
| **BullMQ processor** | `bulk-jobs` | `BulkProcessor` — bulk CSV processing. |
| **BullMQ processor** | `screening` | `ScreeningProcessor` — screening jobs. |
| **BullMQ processor** | `reports` | `ReportsProcessor` — report generation jobs. |
| **Nest schedule** | `@Interval(15000)` on `BvPipelineWorker` | Calls `BvPipelineService.processParseQueue` and `processRefreshQueue` with small batch sizes; can be disabled with `BV_PIPELINE_WORKER_ENABLED=false`. |

**No `@Cron` decorators** were found in `backend/src`; scheduled work is the interval worker above.

**Webhooks:** Stripe at `/billing/webhook`; separate **`webhooks`** module for tenant-configured webhook endpoints and deliveries (Bull usage appears in module — see `webhooks` + `reports` modules for job flow).

---

## Environment Variables and Configuration

### Validated at startup (`backend/src/config/validate-env.ts`)

Required unless noted optional (Zod schema):

- **Runtime:** `NODE_ENV`, `PORT`
- **Database:** `PG_HOST`, `PG_PORT`, `PG_DBNAME`, `PG_USER`, `PG_PASSWORD`; `DATABASE_URL` optional
- **Redis:** `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD` (may be empty string)
- **Auth:** `JWT_SECRET` (min 16), `JWT_REFRESH_SECRET` (min 16); `INTEGRATION_TOKEN_ENCRYPTION_KEY` optional (min 16 if set)
- **Object storage:** `MINIO_ENDPOINT`, `MINIO_PORT`, `MINIO_USE_SSL`, `MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `S3_BUCKET`
- **Bolagsverket:** `BV_CLIENT_ID`, `BV_CLIENT_SECRET`; many `BV_HVD_*` and `BV_FORETAGSINFO_*` optional with URL format rules when present
- **URLs:** `API_BASE_URL` (required URL); `FRONTEND_URL`, `FRONTEND_URLS`, `APP_BASE_URL`, `DASHBOARD_BASE_URL` optional
- **Stripe:** `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID_*` optional

### Loaded via `config/env.ts` defaults / app usage (not all duplicated in Zod)

Includes defaults for local Postgres name `Company`, MinIO host, etc.

### Runtime-only / feature toggles (grep-derived; not all in Zod)

| Variable | Appears in |
|----------|------------|
| `BULLMQ_SKIP_REDIS_VERSION_CHECK` | `app.module.ts` |
| `BV_PIPELINE_WORKER_ENABLED` | `bv-pipeline.worker.ts` |
| `AR_UPLOAD_MAX_BYTES`, `AR_HISTORY_LIMIT`, `AR_FINANCIAL_COMPARISON_MAX_YEARS` | `annual-reports.controller.ts` |
| `AR_ZIP_MAX_*`, `AR_HVD_INGEST_DELAY_MS`, `AR_PARSER_VERSION`, `AR_FINANCIAL_STALE_DAYS` | annual report services |
| `API_RATE_LIMIT_*_PER_DAY`, `AR_RATE_LIMIT_*_PER_DAY` | `api-quota.service.ts` |
| `ARELLE_PYTHON`, `ARELLE_EXTRACT_SCRIPT`, `ARELLE_EXTRACT_TIMEOUT_MS` | `annual-report-arelle.service.ts` |
| `MINIO_REGION` | `env.ts`, MinIO client construction in services |

### Frontend

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_API_BASE_URL` | Base URL for `fetch` including `/api/v1` |

---

## Local Development

### Prerequisites

- **Node.js 20+** (matches Docker image).
- **PostgreSQL**, **Redis**, **S3-compatible storage** (local MinIO is easiest; see compose).
- **Python 3** if running Arelle extraction locally outside Docker (see `backend/tools` and `requirements-arelle.txt`).

### Install

```bash
cd backend && npm ci
cd ../frontend && npm ci
```

Root `package.json` only lists Playwright as a devDependency; backend and frontend install separately.

### Environment

1. Copy **`.env.example`** to **`.env`** at the repo root (compose expects root `.env`; adjust paths if you run services natively).
2. Set all **required** variables from `validate-env.ts` (Bolagsverket and JWT secrets must be non-placeholder for real fetches).
3. Set **`NEXT_PUBLIC_API_BASE_URL`** to your backend, e.g. `http://localhost:4000/api/v1` (avoid relying on the frontend default `3001` port).

### Database setup

- Start Postgres (or `docker compose up postgres`).
- **Migrations:** production Docker entrypoint runs `AppDataSource.runMigrations()` automatically. For local development without Docker, run TypeORM migration commands **using compiled `dist/`** the same way as `data-source.ts` expects, or run SQL manually — the repo’s **authoritative** path for production is **`docker-entrypoint.sh`** against **`dist/data-source.js`**.

### Seed

```bash
cd backend
npm run seed
```

Seeds tenant slug **`demo-bank`** and users `admin@demo-bank.se`, `compliance@demo-bank.se` with documented passwords in `seed.ts`.

### Run backend / frontend

```bash
# Backend
cd backend && npm run start:dev   # default PORT from env (4000 in compose)

# Frontend
cd frontend && npm run dev        # port 3000
```

### Build

```bash
cd backend && npm run build
cd frontend && npm run build
```

### Tests

```bash
cd backend && npm test
```

Jest is configured in `backend/package.json` (`*.spec.ts` under `src/`).

---

## Deployment / Environments

### Docker

- **`docker-compose.yml`** defines **postgres**, **redis**, **minio**, **backend** (build `context: .`, `dockerfile: ./backend/Dockerfile`), and **frontend** (references **`./frontend/Dockerfile`**).
- **Gap:** In this repository snapshot, **`frontend/Dockerfile` is not present** while compose declares a build for it — the compose stack may be incomplete until that file exists or the service is removed.

- **Root `Dockerfile`** comment states alignment with Render vs `backend/Dockerfile` — **Render** is mentioned as a **likely** deployment target but **no Render blueprint file** exists in the repo.

### Backend image (`Dockerfile` at repo root)

- Multi-stage: `npm ci`, `nest build`, runtime **Alpine** with **Python venv** for Arelle, `EXPOSE 4000`, entrypoint runs **migrations then** `node dist/main.js`.

### SSL

- TypeORM uses `ssl: rejectUnauthorized: false` when `NODE_ENV === production'` in `app.module.ts` (typical for managed Postgres).

---

## Data Flow End-to-End (Concrete)

1. **User** opens the Next.js app → logs in → access token stored in `localStorage`.
2. **Frontend** calls e.g. `POST /companies/lookup` with Bearer token.
3. **Backend** `CompaniesService` / Bolagsverket integration fetches from Bolagsverket, persists **raw payloads** and related rows, enqueues **parse queue** rows.
4. **`BvPipelineWorker`** (or an explicit API-triggered drain) processes **`bv_pipeline.parse_queue`**, invoking **`bv_parsed.dispatch_raw_payload`** logic in the database.
5. **Serving layer** updates **`bv_read.*`** projections.
6. **Dashboard** loads company pages → may call **`GET /company-serving/...`** for fast read models and **`GET /annual-reports/.../workspace-read-model`** for iXBRL workspace data.
7. **External API consumer** exchanges OAuth client credentials → calls **`GET .../api-financial-table`** → **ScopeGuard** + **Redis quota** + subscription plan → JSON (+ optional `202` while rebuild queued).

---

## Key Dependencies

| Dependency | Role |
|------------|------|
| `@nestjs/*` | HTTP API, DI, config, JWT, Passport, scheduling, TypeORM, BullMQ integration |
| `typeorm` / `pg` | ORM + Postgres driver |
| `bullmq` / `ioredis` | Queues + Redis |
| `minio` | S3-compatible uploads |
| `stripe` | Billing |
| `passport-jwt` | Bearer JWT validation |
| `bcrypt` | Password and refresh-token hashing |
| `class-validator` | DTO validation |
| `zod` | Environment schema validation |
| `axios` | Outbound HTTP to Bolagsverket |
| `unzipper` | Annual report ZIP handling |
| `next` / `react` | Dashboard |

---

## Gaps / Unknowns

- **`frontend/Dockerfile`** referenced by `docker-compose.yml` **is missing** from the workspace — compose may not build as-is.
- **CI/CD pipelines** (GitHub Actions, etc.) are **not** present in the repository snapshot.
- **Full enumeration** of every `bolagsverket_*` table and every PL/pgSQL function is **not** inlined here; migrations **`1000000000002`** and **`1000000000028`** are the source of truth.
- Some modules (**`financial`**, **`ownership`**, parts of **`risk-indicators`**) use a **fixed UUID tenant** in controllers — behavior vs JWT tenant should be treated as **technical debt / incomplete multi-tenancy** until refactored.
- **Screening “provider”** includes a **mock** implementation; production provider wiring is not fully described in code reviewed.
- **`JwtUser` TypeScript interface** does not list OAuth fields (`scopes`, `clientId`, …) but **runtime** JWT payloads from OAuth include them — types are incomplete relative to runtime.

---

## Developer Notes

- **Start reading:** `backend/src/app.module.ts` → domain module → `*.controller.ts` + `*.service.ts`.
- **Schema truth:** `backend/src/migrations/*.ts` — especially `0001`, `0002`, `0028`, `0029`, `0030`, `0032`.
- **Bolagsverket HTTP:** `companies/integrations/bolagsverket.client.ts`.
- **Read models for org dashboard:** `companies/services/company-serving-read.service.ts` (`bv_read`).
- **Annual report pipeline:** `annual-reports/services/annual-report-pipeline.service.ts`, `annual-report-parse.processor.ts`, `annual-report-arelle.service.ts`.
- **Auth / machine access:** `auth/auth.service.ts`, `oauth/oauth.service.ts`, `common/guards/scope.guard.ts`, `common/interceptors/api-quota.interceptor.ts`.
- **Risky / central areas:** SQL dispatcher `bv_parsed.dispatch_raw_payload`, migration ordering, Stripe webhook raw body dependency, Arelle + Python path in containers.
- **Existing design docs in repo:** `docs/reference-ui-spec.md` and static reference images — UI-oriented, not backend architecture.

---

*This README was generated from the repository source and migration files as of the last full pass over the codebase structure, controllers, workers, and configuration.*

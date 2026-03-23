# VerifyIQ

VerifyIQ is a Swedish B2B KYC / AML / company verification platform starter monorepo. This repository is being assembled in chunks. This root package contains the shared workspace setup, development orchestration, environment template, and root-level linting / formatting configuration.

The finished monorepo is designed to include:
- a NestJS backend for KYC, AML, company verification, monitoring, documents, reports, and webhooks
- a Next.js frontend dashboard for compliance operations
- PostgreSQL for persistence
- Redis for queues and background processing
- MinIO for local S3-compatible file storage
- Docker Compose for local development

## Repository Structure

This chunk provides the root files listed below. The backend and frontend package contents are delivered in later chunks.

```text
verifyiq-app/
├── .env.example
├── .gitignore
├── README.md
├── docker-compose.yml
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── eslint.config.js
├── prettier.config.js
├── backend/                  # delivered in later chunks
│   ├── Dockerfile
│   ├── package.json
│   ├── tsconfig.json
│   ├── tsconfig.build.json
│   ├── nest-cli.json
│   ├── .eslintrc.js
│   ├── migrations/
│   │   └── 001_initial_schema.sql
│   └── src/
│       ├── main.ts
│       ├── app.module.ts
│       ├── data-source.ts
│       ├── seed.ts
│       ├── config/
│       ├── common/
│       ├── auth/
│       ├── audit/
│       ├── tenants/
│       ├── users/
│       ├── parties/
│       ├── companies/
│       ├── onboarding/
│       ├── screening/
│       ├── risk/
│       ├── webhooks/
│       ├── reports/
│       ├── documents/
│       └── monitoring/
└── frontend/                 # delivered in later chunks
    ├── Dockerfile
    ├── package.json
    ├── tsconfig.json
    ├── next.config.ts
    ├── postcss.config.js
    ├── tailwind.config.ts
    ├── components.json
    ├── .eslintrc.js
    └── src/
        ├── app/
        ├── components/
        ├── lib/
        ├── hooks/
        └── types/
```

## What this chunk includes

- workspace root package configuration
- shared TypeScript base config
- shared linting and formatting config
- local Docker Compose stack definition
- environment template aligned to backend and frontend env names

## Environment

Copy `.env.example` to `.env` and adjust values before running the full stack:

```bash
cp .env.example .env
```

Required environment variables are standardized across the repository:
- `NODE_ENV`
- `PORT`
- `PG_HOST`
- `PG_PORT`
- `PG_DBNAME`
- `PG_USER`
- `PG_PASSWORD`
- `DATABASE_URL`
- `REDIS_HOST`
- `REDIS_PORT`
- `REDIS_PASSWORD`
- `JWT_SECRET`
- `JWT_REFRESH_SECRET`
- `MINIO_ENDPOINT`
- `MINIO_PORT`
- `MINIO_USE_SSL`
- `MINIO_ROOT_USER`
- `MINIO_ROOT_PASSWORD`
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `S3_BUCKET`
- `BV_CLIENT_ID`
- `BV_CLIENT_SECRET`
- `API_BASE_URL`
- `NEXT_PUBLIC_API_BASE_URL`

## Local infrastructure

The root `docker-compose.yml` defines these services:
- `postgres`
- `redis`
- `minio`
- `backend`
- `frontend`

The backend and frontend services are defined now so the root orchestration remains stable, but those service images become runnable only after the later backend and frontend chunks are added.

## Intended local URLs after all chunks are present

- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:4000/api/v1`
- MinIO API: `http://localhost:9000`
- MinIO Console: `http://localhost:9001`

## Expected next steps after all chunks are assembled

1. Copy `.env.example` to `.env`
2. Fill secrets and credentials
3. Start infrastructure with Docker Compose
4. Install backend and frontend dependencies
5. Run database migration
6. Seed demo data
7. Start backend and frontend

## Notes

This README is intentionally limited to the files already included in this chunk plus the known repository structure that later chunks are expected to populate. Startup commands that depend on backend and frontend package files are intentionally not claimed as runnable until those chunks exist.

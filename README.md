# VerifyIQ

VerifyIQ is a Swedish B2B KYC / AML / company verification platform starter monorepo.

The monorepo includes:
- a NestJS backend for KYC, AML, company verification, monitoring, documents, reports, and webhooks
- a Next.js frontend dashboard for compliance operations
- PostgreSQL for persistence
- Redis for queues and background processing
- MinIO for local S3-compatible file storage
- Docker Compose for local development

## Quick start (step by step)

> **Windows users:** run the commands below in PowerShell or Git Bash from the root of the repository.

### Option A – Docker Compose (recommended, runs everything automatically)

```bash
# 1. Copy the environment template
cp .env.example .env        # PowerShell: Copy-Item .env.example .env

# 2. Edit .env – fill in real secrets (JWT_SECRET, JWT_REFRESH_SECRET, BV_CLIENT_ID, BV_CLIENT_SECRET)
#    The rest of the defaults work for a local Docker stack.

# 3. Build and start all services (postgres, redis, minio, backend, frontend)
docker compose up --build

# 4. Run the database migration (once, in a separate terminal)
docker compose exec backend node -e "const {AppDataSource} = require('./dist/data-source'); AppDataSource.initialize().then(() => AppDataSource.runMigrations()).then(() => process.exit(0));"
```

Services will be available at:
- Frontend: <http://localhost:3000>
- Backend API: <http://localhost:4000/api/v1>
- MinIO console: <http://localhost:9001> (user: `minioadmin`, password: `minioadmin`)

---

### Option B – Local development (backend + frontend without Docker)

Prerequisites: Node.js ≥ 20, a running PostgreSQL 16 instance, and a running Redis 7 instance.

```bash
# 1. Copy and edit the environment file
cp .env.example .env        # PowerShell: Copy-Item .env.example .env
# Edit .env: set PG_HOST, PG_USER, PG_PASSWORD, PG_DBNAME, REDIS_HOST,
#            JWT_SECRET, JWT_REFRESH_SECRET, and other required values.

# 2. Install backend dependencies
cd backend
npm install

# 3. Build the backend (compiles TypeScript to dist/)
npm run build

# 4. Start the backend in watch mode
npm run start:dev

# 5. In a second terminal – install and start the frontend
cd ../frontend
npm install
npm run dev
```

The backend reads environment variables from the `.env` file you created in the repository root (or from the current shell environment). Make sure the file is present before running `npm run start:dev`.

---

## Repository Structure

```text
verifyiq-app/
├── .env.example
├── .gitignore
├── README.md
├── docker-compose.yml
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── eslint.config.js
├── prettier.config.js
├── backend/
│   ├── Dockerfile
│   ├── .dockerignore
│   ├── package.json
│   ├── package-lock.json
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
└── frontend/
    ├── Dockerfile
    ├── .dockerignore
    ├── package.json
    ├── package-lock.json
    ├── tsconfig.json
    ├── next.config.js
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

## Environment variables

Copy `.env.example` to `.env` and fill in the values before starting anything:

```bash
cp .env.example .env        # PowerShell: Copy-Item .env.example .env
```

| Variable | Required | Notes |
|---|---|---|
| `PORT` | yes | Backend HTTP port (default `4000`) |
| `PG_HOST` / `PG_PORT` / `PG_DBNAME` / `PG_USER` / `PG_PASSWORD` | yes | PostgreSQL connection |
| `REDIS_HOST` / `REDIS_PORT` | yes | Redis connection |
| `JWT_SECRET` | yes | Min 16 chars – change from the default! |
| `JWT_REFRESH_SECRET` | yes | Min 16 chars – change from the default! |
| `MINIO_ENDPOINT` / `MINIO_PORT` / `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD` | yes | MinIO / S3 storage |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | yes | Same as MinIO credentials for local dev |
| `BV_CLIENT_ID` / `BV_CLIENT_SECRET` | yes | Bolagsverket API credentials |
| `NEXT_PUBLIC_API_BASE_URL` | yes | Frontend → backend URL |

## Local URLs

| Service | URL |
|---|---|
| Frontend | <http://localhost:3000> |
| Backend API | <http://localhost:4000/api/v1> |
| MinIO API | <http://localhost:9000> |
| MinIO Console | <http://localhost:9001> |

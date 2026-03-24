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

# 2. Edit .env if needed (optional for local dev – all defaults are pre-filled)
#    For production: replace JWT_SECRET, JWT_REFRESH_SECRET, and BV_CLIENT_ID/BV_CLIENT_SECRET
#    with real values. The rest of the defaults work fine for a local Docker stack.

# 3. Build and start all services (postgres, redis, minio, backend, frontend)
docker compose up --build
```

> **Migrations run automatically.** The backend container runs all pending database migrations
> before starting the NestJS app, so no manual migration step is needed.

Services will be available at:
- Frontend: <http://localhost:3000>
- Backend API: <http://localhost:4000/api/v1>
- MinIO console: <http://localhost:9001> (user: `minioadmin`, password: `minioadmin`)

#### Verify the API is up

```bash
curl http://localhost:4000/api/v1
# Expected response: {"status":"ok","service":"VerifyIQ API","timestamp":"..."}
```

#### (Optional) Seed demo data

```bash
docker compose exec backend node -e "
const { AppDataSource } = require('./dist/data-source');
AppDataSource.initialize().then(() => {
  const { execSync } = require('child_process');
  execSync('node dist/seed.js', { stdio: 'inherit' });
});"
```

Or with `ts-node` from the `backend/` directory:

```bash
cd backend
npm run seed
```

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

# 3. Build the backend (compiles TypeScript → dist/)
npm run build

# 4. Run database migrations
npx typeorm migration:run -d dist/data-source.js

# 5. Start the backend in watch mode (auto-rebuilds on file changes)
npm run start:dev

# 6. In a second terminal – install and start the frontend
cd ../frontend
npm install
npm run dev
```

The backend reads environment variables from the `.env` file you created in the repository root (or from the current shell environment). Make sure the file is present before running `npm run start:dev`.

---

## Available API endpoints

All routes are under the `/api/v1` prefix.

| Method | Path | Auth required | Description |
|--------|------|--------------|-------------|
| `GET` | `/api/v1` | no | Health check – returns `{"status":"ok"}` |
| `POST` | `/api/v1/auth/login` | no | Obtain access + refresh tokens |
| `POST` | `/api/v1/auth/refresh` | no | Exchange a refresh token for a new access token |
| `POST` | `/api/v1/auth/logout` | no | Invalidate a refresh token |
| `GET` | `/api/v1/tenants` | admin | List tenants |
| `POST` | `/api/v1/tenants` | admin | Create tenant |
| `GET` | `/api/v1/users` | yes | List users |
| `GET` | `/api/v1/parties` | yes | List parties |
| `POST` | `/api/v1/parties` | yes | Create party |
| `GET` | `/api/v1/companies` | yes | List companies |
| `POST` | `/api/v1/onboarding/cases` | yes | Create onboarding case |
| `GET` | `/api/v1/screening` | yes | Screening results |
| `GET` | `/api/v1/risk` | yes | Risk assessments |
| `GET` | `/api/v1/monitoring` | yes | Monitoring alerts |
| `GET` | `/api/v1/documents` | yes | List documents |
| `GET` | `/api/v1/reports` | yes | List reports |
| `GET` | `/api/v1/audit` | yes | Audit log |
| `GET` | `/api/v1/webhooks/endpoints` | yes | List webhook endpoints |
| `POST` | `/api/v1/bolagsverket/company` | yes | Swedish company lookup |

> **Note:** `GET /api/v1` is the health check route. Previously, visiting this URL returned a
> `404 Not Found` error because there was no root handler. This is now fixed — you should
> see `{"status":"ok","service":"VerifyIQ API","timestamp":"..."}` instead.

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
│   ├── docker-entrypoint.sh       ← runs migrations then starts the app
│   ├── .dockerignore
│   ├── package.json
│   ├── package-lock.json
│   ├── tsconfig.json
│   ├── tsconfig.build.json
│   ├── nest-cli.json
│   ├── .eslintrc.js
│   ├── migrations/                ← TypeORM migration source files
│   └── src/
│       ├── main.ts
│       ├── app.module.ts
│       ├── app.controller.ts      ← GET /api/v1 health check
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
| `JWT_SECRET` | yes | Min 16 chars – **change the default in production!** |
| `JWT_REFRESH_SECRET` | yes | Min 16 chars – **change the default in production!** |
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


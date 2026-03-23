# Startup Checklist

1. Extract chunk 1 into the repository root.
2. Extract chunk 2 into verifyiq-app/backend/.
3. Extract chunks 3–6 into verifyiq-app/backend/src/.
4. Extract chunks 7–8 into verifyiq-app/frontend/.
5. Copy .env.example to .env and fill real values.
6. Start infrastructure:
   docker compose up -d postgres redis minio
7. Run migration:
   psql -h localhost -U $PG_USER -d $PG_DBNAME -f backend/migrations/001_initial_schema.sql
8. Install dependencies:
   pnpm install
9. Seed:
   pnpm --filter @verifyiq/backend seed
10. Start services:
   pnpm --filter @verifyiq/backend start:dev
   pnpm --filter @verifyiq/frontend dev
11. Create MinIO bucket:
   verifyiq-documents
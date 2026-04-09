# System Architecture

## Core Components

- Frontend (Next.js)
- Backend API (Node.js)
- Authentication service
- Billing integration
- Data ingestion layer
- Normalization layer
- Storage layer (PostgreSQL)
- Search layer
- Queue system (async processing)

---

## Request Flow

1. User/API request
2. Authentication + authorization
3. Input validation
4. Cache check
5. Source retrieval (if needed)
6. Data normalization
7. Data enrichment
8. Store result
9. Return response
10. Log usage

---

## Async vs Real-Time

### Real-Time
- Search
- API requests

### Async
- Bulk processing
- Monitoring updates
- Data refresh jobs

---

## Data Pipeline

Source → Ingestion → Normalization → Enrichment → Storage → Output

---

## Caching Strategy

- Use stored data when available
- Refresh if outdated
- Always include timestamp

---
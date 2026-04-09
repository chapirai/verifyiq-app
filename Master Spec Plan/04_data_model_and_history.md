# Data Model and History

## Core Entities

- Tenant
- User
- Company
- Financials
- Filings
- Person
- API Key
- Subscription
- Usage Log
- Bulk Job
- Monitoring Event
- Audit Log

---

## Company Model

Company is central:
- identity
- status
- relationships
- filings
- financials

---

## History Model

- Store full snapshots per request
- Track timestamp
- Compare changes between snapshots
- Maintain timeline

---

## Data Strategy

- Demand-driven ingestion
- Persistent storage
- Incremental enrichment
- Historical tracking

---

## Data Quality

- Structured
- Consistent schema
- Timestamped
- Source-aware
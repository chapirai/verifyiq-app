# VerifyIQ Master Specification

## Overview

VerifyIQ is a B2B data infrastructure platform that retrieves, normalizes, enriches, stores, and delivers company data through a dashboard, API, bulk processing workflows, and developer integrations.

The system operates on a demand-driven model where each request both serves the user and builds a proprietary dataset with historical tracking.

---

## Core Value Proposition

- Replace manual and fragmented data sourcing
- Provide structured, API-ready company data
- Automate KYC, credit, and operational workflows
- Enable bulk portfolio processing
- Build a continuously improving internal dataset

---

## Primary Use Cases

### KYC & Compliance
- Company onboarding
- Periodic review (monthly, quarterly, yearly)
- Portfolio refresh via bulk upload

### Credit & Underwriting
- Financial data retrieval
- Annual report access
- Decision support for committees

### API Integration
- Replace third-party data providers
- Embed data directly into customer systems

### Sales & Lead Generation
- Search and filter companies
- Export structured leads

---

## Entry Points

### Landing Page
- Explains product and services
- Shows use cases (KYC, credit, API, leads)
- CTAs:
  - Get Started
  - Get API Access
  - Login

### Authentication
- Signup (self-service)
- Login
- Redirect to dashboard

### Dashboard
- Search companies
- View company profiles
- Upload bulk files
- Monitor entities
- Manage API keys
- View usage and billing

---

## Product Surfaces

- Dashboard (manual workflows)
- API (programmatic access)
- SDK (developer abstraction)
- Bulk processing (file-based workflows)

---

## Demand-Driven Data Model

- Data is retrieved when requested
- Normalized into a canonical schema
- Stored internally
- Reused for future queries
- Historical snapshots are created
- Change tracking is enabled over time

---

## V1 Scope

1. Landing page + authentication
2. Dashboard shell
3. Company search
4. Company profile
5. Data retrieval + storage
6. Bulk upload (CSV/XLSX)
7. API access (basic)
8. Usage tracking

---
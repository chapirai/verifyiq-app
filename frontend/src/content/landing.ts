/**
 * Public marketing copy for VerifyIQ / Nordic Data Company.
 * Grounded in the product as implemented: Swedish registry + Bolagsverket, persisted payloads, serving read models, iXBRL, multi-tenant APIs.
 */
export const siteSeo = {
  title: 'VerifyIQ | Nordic Data Company',
  description:
    'Swedish company registry and financial intelligence: Bolagsverket-integrated data, traceable lineage, annual reports, and governed APIs for compliance, credit, and M&A teams.',
} as const;

export const company = {
  legalName: 'Nordic Data Company',
  product: 'VerifyIQ',
} as const;

export const hero = {
  kicker: 'Nordic Data Company',
  line1: 'VerifyIQ',
  line2: 'Swedish company intelligence',
  sub: 'Registry, ownership, and financials — with traceable lineage and governed access.',
  lead: `A multi-tenant platform for Swedish company registry and financial data. It connects to Bolagsverket (HVD, Företagsinformation, FI-related organisation data, documents, officers, cases, and more), persists raw API payloads, materializes normalized serving read models, and supports annual report and iXBRL ingestion — with tenant security, billing and audit hooks, and APIs for your workflows.`,
  ctaPrimary: 'Get access',
  ctaSecondary: 'Sign in',
  /** Hero column — not duplicated in the inverted “at a glance” band */
  asidePoints: [
    'Multi-tenant platform: dashboard users and API clients (OAuth, API keys, sandbox).',
    'Source-integrated: Bolagsverket routes, annual reports, object storage, and parse jobs as deployed.',
    'Operated as a product: entitlements, audit, usage, and billing hooks — not a one-off extract.',
  ],
} as const;

export const atAGlance = [
  {
    k: 'Source',
    v: 'Bolagsverket-integrated',
    s: 'High-value datasets, Finansinspektionen-related records, documents, and enrichment pipelines — not a static export.',
  },
  {
    k: 'Lineage',
    v: 'Payloads & snapshots',
    s: 'Raw API payloads, snapshot chains, and serving layers you can reason about when evidence matters.',
  },
  {
    k: 'Access',
    v: 'Tenant-governed APIs',
    s: 'OAuth client credentials, API keys (live and sandbox), quotas, and per-tenant entitlements for machine and human users.',
  },
] as const;

export const productStory = {
  kicker: 'What VerifyIQ is',
  title: 'From registry data to a decision you can stand behind',
  /** Body after the boxed drop cap (first character `dropCap` is rendered in a bordered square). */
  dropCap: 'V',
  body:
    'VerifyIQ is built for operational teams in compliance, credit, M&A, and data engineering who need more than a spreadsheet. The product integrates with the Swedish business registry ecosystem: structured discovery, ownership clarity, verklig huvudman and control context, and — when a target justifies it — deeper retrieval of stored payloads and financial artefacts. Breadth stays affordable; depth stays on demand so cost and latency follow business priority.',
  followUp:
    'Under the surface, the same architecture supports BullMQ-backed jobs, object storage for reports and files, and observable change and monitoring — so the visible product sits on a stack built for production, not a thin demo layer.',
} as const;

export const controlQuote = {
  kicker: 'Why control matters',
  text: 'As transparency and UBO expectations rise, a company is not a row in a list — it is a structure of control and obligation. The same data must be legible in discovery and defensible in review.',
} as const;

export const visualBlock = {
  kicker: 'Lineage',
  title: 'Raw payload to read model',
  caption:
    'Holds for illustration: a monochrome surface, sharp borders, and a hover that thickens the frame. No stock photography — the product is the evidence chain.',
} as const;

export const capabilities = [
  'Company discovery & index',
  'Ownership & control signals',
  'Risk, screening, and cases',
  'On-demand Bolagsverket enrichment',
  'Monitoring & change alerts',
  'APIs, webhooks, bulk jobs, documents',
] as const;

export const audiences = [
  'Private equity & corporate development',
  'Banks, credit, and risk',
  'Compliance, KYC, and second line',
  'Data, integration, and platform teams',
] as const;

export const principle = {
  /** Editorial testimonial: principle, not a fictional persona. */
  quote:
    'We did not set out to ship another “black box” data feed. VerifyIQ is for teams that need the fetch, the store, and the line of sight to both.',
  label: 'Product principle',
} as const;

export const accessTiers = [
  {
    name: 'Sourcing',
    blurb: 'Discovery, search, and triage across the tenant index — ideal for origination and short lists.',
    elevated: false,
  },
  {
    name: 'Platform',
    blurb: 'Full workspace: enrichment, financial and annual-report workflows, monitoring, and integrations under your entitlements. The default “serious” tier.',
    elevated: true,
  },
  {
    name: 'Programme',
    blurb: 'Enterprise-scale usage, co-managed onboarding, and operational support — aligned to your governance and rollout.',
    elevated: false,
  },
] as const;

export const workflow = {
  kicker: 'Workflow',
  line: 'Request → store → serve → act',
  sub: 'End-to-end flow from a question about a company to a recorded decision, with the payloads to back it.',
} as const;

const workflowSteps = [
  { n: '01', label: 'Discover' },
  { n: '02', label: 'Triage' },
  { n: '03', label: 'Enrich' },
  { n: '04', label: 'Document' },
  { n: '05', label: 'Decide' },
] as const;
export { workflowSteps };

export const faq = [
  {
    q: 'What data does VerifyIQ actually use?',
    a: 'The platform is oriented around Swedish company registry and related sources, primarily through Bolagsverket APIs, with FI-related organisation data, documents, officers, cases, and more as configured. Raw responses are persisted so you can re-run parsing and keep history.',
  },
  {
    q: 'How does “deep” enrichment differ from browsing?',
    a: 'You can work from broad discovery first. When a target is worth the cost, on-demand jobs pull richer payloads and documents into storage, without paying full depth for the entire universe up front.',
  },
  {
    q: 'How are APIs and access controlled?',
    a: 'Tenants use JWT sessions for the dashboard. Machine access uses OAuth2 client credentials and API keys with environment (live or sandbox) and Redis-backed quotas. Sensitive routes are scope- and role-gated with audit and usage events.',
  },
  {
    q: 'What about financial statements and annual reports?',
    a: 'The stack includes annual report ZIP and iXBRL ingestion, object storage for files, and API-facing financial tables derived from normalized paths. Arelle-based steps run where the pipeline is deployed. Capabilities follow your entitlements.',
  },
  {
    q: 'Who operates the system?',
    a: 'Nordic Data Company is the product brand behind VerifyIQ. Onboarding is by work email, verification, and tenant assignment. Billing can integrate with Stripe for subscriptions where applicable.',
  },
] as const;

export const finalCta = {
  kicker: 'Start',
  title: 'Request access to VerifyIQ',
  lead: 'We will follow up in line with your organisation and the plan that fits. No color accents, no empty promises — the same product you have read about above.',
} as const;

export const footer = {
  blurb: 'Nordic Data Company · VerifyIQ — Swedish company registry and financial intelligence for teams that need traceability, not just tables.',
} as const;

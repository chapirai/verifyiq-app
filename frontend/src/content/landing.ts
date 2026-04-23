/**
 * Public marketing copy for VerifyIQ / Nordic Data Company.
 * Focused on decision support outcomes for customer-facing messaging.
 */
export const siteSeo = {
  title: 'VerifyIQ | Nordic Data Company',
  description:
    'Make defensible company decisions with ownership, financials, and control structures in one clear view.',
} as const;

export const company = {
  legalName: 'Nordic Data Company',
  product: 'VerifyIQ',
} as const;

export const hero = {
  kicker: 'Nordic Data Company',
  line1: 'VerifyIQ',
  line2: 'Make decisions on companies you can defend',
  sub: 'Ownership, financials, and control structures — resolved into one clear view, so you can assess risk, validate counterparties, and move faster.',
  lead: 'Stop piecing together registry data, ownership structures, and filings manually. VerifyIQ gives you a complete, structured view of a company — ready for analysis, onboarding, or decisioning.',
  support: 'Built for credit, compliance, and deal teams working with Swedish entities.',
  ctaPrimary: 'Start a company lookup',
  ctaSecondary: 'See how it works',
  /** Hero column — not duplicated in the inverted “at a glance” band */
  asidePoints: [
    'Built for teams making decisions, not just collecting data.',
    'Covers ownership, financials, filings, and control context in one workflow.',
    'Designed for reviewability, speed, and confidence under scrutiny.',
  ],
} as const;

export const atAGlance = [
  {
    k: 'What you get',
    v: 'Complete company profiles',
    s: 'Ownership, financials, filings, and structure — in one place.',
  },
  {
    k: 'Why it matters',
    v: 'Data you can rely on',
    s: 'Traceable to source, structured for analysis, and consistent across cases.',
  },
  {
    k: 'How you use it',
    v: 'Built into your workflow',
    s: 'Search, enrich, monitor, and document decisions — without switching tools.',
  },
] as const;

export const productStory = {
  kicker: 'What VerifyIQ is',
  title: 'From registry data to a decision you can stand behind',
  /** Body after the boxed drop cap (first character `dropCap` is rendered in a bordered square). */
  dropCap: 'V',
  body:
    'VerifyIQ is built for teams that need to understand companies beyond surface-level data. It brings together registry data, ownership structures, and financials into a single, structured view — so you can assess control, risk, and legitimacy with confidence.',
  followUp:
    "Whether you're onboarding a customer, evaluating credit risk, or reviewing an acquisition target, you get the full context — not fragmented data.",
} as const;

export const controlQuote = {
  kicker: 'Why control matters',
  text: 'As transparency and UBO expectations rise, a company is not a row in a list — it is a structure of control and obligation. The same data must be legible in discovery and defensible in review.',
} as const;

export const visualBlock = {
  kicker: 'How it works',
  title: 'From registry data to decision',
  steps: [
    'Company lookup',
    'Ownership resolution (UBO)',
    'Financial + filing enrichment',
    'Risk signals and flags',
    'Decision snapshot (exportable)',
  ],
  caption:
    'Every step is traceable to source data — so your decisions hold up in review.',
} as const;

export const capabilities = [
  {
    title: 'Company search & discovery',
    detail: 'Find entities and understand structure instantly.',
  },
  {
    title: 'Ownership & UBO mapping',
    detail: 'See who actually controls the company.',
  },
  {
    title: 'Financials & filings',
    detail: 'Access structured reports and historical data.',
  },
  {
    title: 'Risk & compliance workflows',
    detail: 'Run checks, document reviews, and track decisions.',
  },
  {
    title: 'Monitoring & alerts',
    detail: 'Get notified when something changes.',
  },
  {
    title: 'API & bulk access',
    detail: 'Integrate directly into your internal systems.',
  },
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
    'A company is not a row in a dataset — it is a structure of ownership, control, and obligation. Your data should reflect that.',
  label: 'Product principle',
} as const;

export const accessTiers = [
  {
    name: 'Self-serve',
    blurb: 'Start exploring companies directly in the platform.',
    elevated: false,
  },
  {
    name: 'API access',
    blurb: 'Integrate company data into your own workflows.',
    elevated: true,
  },
  {
    name: 'Enterprise',
    blurb: 'Custom setup, bulk data, and operational support.',
    elevated: false,
  },
] as const;

export const workflow = {
  kicker: 'Workflow',
  line: 'Source → Resolve → Analyze → Validate → Decide',
  sub: 'From first lookup to final decision — with full traceability.',
} as const;

const workflowSteps = [
  { n: '01', label: 'Source' },
  { n: '02', label: 'Resolve' },
  { n: '03', label: 'Analyze' },
  { n: '04', label: 'Validate' },
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
  title: 'Get access to VerifyIQ',
  lead: 'Start with a company lookup, then scale to API and enterprise workflows as your team grows.',
} as const;

export const footer = {
  blurb: 'Nordic Data Company · VerifyIQ — Swedish company registry and financial intelligence for teams that need traceability, not just tables.',
} as const;

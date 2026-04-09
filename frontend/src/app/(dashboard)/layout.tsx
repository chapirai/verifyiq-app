import Link from 'next/link';
import type { Route } from 'next';

const nav: { href: Route; label: string }[] = [
  { href: '/dashboard', label: 'Overview' },
  { href: '/search', label: 'Company Search' },
  { href: '/companies', label: 'Companies' },
  { href: '/bulk', label: 'Bulk Processing' },
  { href: '/api', label: 'API Access' },
  { href: '/billing', label: 'Billing' },
  { href: '/settings', label: 'Settings' },
  { href: '/companies/bolagsverket', label: 'Bolagsverket' },
  { href: '/onboarding', label: 'Onboarding' },
  { href: '/screening', label: 'Screening' },
  { href: '/monitoring', label: 'Monitoring' },
  { href: '/integration-status', label: 'Integration Status' },
  { href: '/ownership', label: 'Ownership' },
  { href: '/financial', label: 'Financial & Ratings' },
  { href: '/risk-indicators', label: 'Risk Indicators' },
  { href: '/credit-decisioning', label: 'Credit Decisions' },
  { href: '/property', label: 'Property' },
  { href: '/person-enrichment', label: 'Person Enrichment' },
  { href: '/company-cases', label: 'Company Cases' },
  { href: '/entitlements', label: 'Dataset Entitlements' },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen grid-cols-[280px_1fr] bg-background text-foreground">
      <aside className="border-r border-border bg-card p-6">
        <div className="mb-8">
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Nordic Company Data</p>
          <h2 className="mt-2 text-2xl" style={{ fontFamily: 'var(--font-calistoga), Georgia, serif' }}>
            VerifyIQ
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">Data Operations Console</p>
        </div>
        <nav className="space-y-2">
          {nav.map((item) => (
            <Link key={item.href} href={item.href} className="block rounded-xl px-4 py-2.5 text-sm text-foreground transition hover:bg-muted">
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="p-8">{children}</main>
    </div>
  );
}

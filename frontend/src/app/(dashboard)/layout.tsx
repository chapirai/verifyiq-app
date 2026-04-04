import Link from 'next/link';
import type { Route } from 'next';

const nav: { href: Route; label: string }[] = [
  { href: '/dashboard', label: 'Overview' },
  { href: '/search', label: 'Company Search' },
  { href: '/companies', label: 'Companies' },
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
    <div className="grid min-h-screen grid-cols-[260px_1fr] bg-background text-white">
      <aside className="border-r border-border p-6">
        <div className="mb-8">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">VerifyIQ</p>
          <h2 className="mt-2 text-xl font-semibold">Compliance Console</h2>
        </div>
        <nav className="space-y-2">
          {nav.map((item) => (
            <Link key={item.href} href={item.href} className="block rounded-xl px-4 py-3 text-slate-200 transition hover:bg-card">
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="p-8">{children}</main>
    </div>
  );
}

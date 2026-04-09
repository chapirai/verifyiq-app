import Link from 'next/link';
import { ReactNode } from 'react';

const nav = [
  ['Dashboard', '/dashboard'],
  ['Search', '/search'],
  ['Companies', '/companies'],
  ['Bulk', '/bulk'],
  ['API Access', '/api'],
  ['Billing', '/billing'],
  ['Onboarding', '/onboarding'],
  ['Screening', '/screening'],
  ['Monitoring', '/monitoring'],
  ['Settings', '/settings'],
  ['Ownership', '/ownership'],
  ['Financial', '/financial'],
  ['Risk indicators', '/risk-indicators'],
  ['Company cases', '/company-cases'],
  ['Credit decisioning', '/credit-decisioning'],
  ['Property', '/property'],
  ['Person enrichment', '/person-enrichment'],
  ['Integration status', '/integration-status'],
  ['Entitlements', '/entitlements'],
] as const;

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto grid max-w-[1400px] gap-6 p-6 lg:grid-cols-[260px_1fr]">
        <aside className="panel h-fit p-4">
          <div className="mb-4 border-b border-border pb-4">
            <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground">VerifyIQ</p>
            <h2 className="mt-1 text-xl font-semibold">Control Center</h2>
          </div>
          <nav className="grid gap-1">
            {nav.map(([label, href]) => (
              <Link
                key={href}
                href={href}
                className="rounded-lg px-3 py-2 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground"
              >
                {label}
              </Link>
            ))}
          </nav>
        </aside>
        <main>{children}</main>
      </div>
    </div>
  );
}
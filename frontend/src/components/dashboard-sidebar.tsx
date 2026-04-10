'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

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
  ['Bolagsverket', '/companies/bolagsverket'],
] as const;

function isActive(pathname: string, href: string): boolean {
  if (href === '/dashboard') return pathname === '/dashboard';
  if (href === '/companies') {
    if (pathname === '/companies') return true;
    if (pathname.startsWith('/companies/') && !pathname.startsWith('/companies/bolagsverket')) return true;
    return false;
  }
  if (href === '/companies/bolagsverket') {
    return pathname === '/companies/bolagsverket' || pathname.startsWith('/companies/bolagsverket/');
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function DashboardSidebar() {
  const pathname = usePathname();

  return (
    <aside className="panel sticky top-6 h-fit p-4">
      <div className="mb-5 border-b border-border pb-4">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-foreground text-xs font-bold text-white">
            N
          </span>
          <div>
            <p className="text-sm font-semibold text-foreground">VerifyIQ</p>
            <p className="text-[10px] text-muted-foreground">Nordic Company Data</p>
          </div>
        </Link>
        <p className="mt-3 text-xs font-medium text-muted-foreground">Workspace</p>
      </div>
      <nav className="grid max-h-[calc(100vh-8rem)] gap-0.5 overflow-y-auto pr-1" aria-label="Main">
        {nav.map(([label, href]) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              className={`rounded-xl px-3 py-2 text-sm transition-colors ${
                active
                  ? 'bg-primary/10 font-semibold text-primary'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

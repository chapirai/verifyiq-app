'use client';

import { ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { clearSession, getCurrentUser } from '@/lib/auth';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

const navItems = [
  { href: '/dashboard', label: 'Overview' },
  { href: '/search', label: 'Lookup' },
  { href: '/companies', label: 'Companies' },
  { href: '/lists', label: 'Lists' },
  { href: '/compare', label: 'Compare' },
  { href: '/alerts', label: 'Alerts' },
  { href: '/bulk', label: 'Bulk' },
  { href: '/billing', label: 'Billing' },
  { href: '/api-keys', label: 'API' },
  { href: '/api-oauth-clients', label: 'OAuth' },
  { href: '/api-sandbox', label: 'Sandbox' },
  { href: '/settings', label: 'Settings' },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const user = getCurrentUser<{ fullName?: string; role?: string }>();
  const [planCode, setPlanCode] = useState<string>('starter');

  useEffect(() => {
    api.getSubscription()
      .then((res) => {
        const code = (res as { data?: { planCode?: string } | null }).data?.planCode;
        setPlanCode(code ?? 'starter');
      })
      .catch(() => setPlanCode('starter'));
  }, []);

  const restrictedByPlan: Record<string, string[]> = {
    starter: ['/bulk'],
    growth: [],
    enterprise: [],
  };

  return (
    <div className="min-h-screen">
      <div className="site-divider grid min-h-screen grid-cols-1 lg:grid-cols-[240px_1fr]">
        <aside className="border-r-2 border-foreground bg-background p-6">
          <p className="font-display text-3xl">VerifyIQ</p>
          <p className="mono-label mt-2 text-[10px]">Nordic Company Data</p>
          <nav className="mt-10 space-y-2">
            {navItems.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              const blocked = (restrictedByPlan[planCode] ?? []).includes(item.href);
              return (
                blocked ? (
                  <div key={item.href} className="block border border-dashed border-foreground/40 px-3 py-2 text-sm text-muted-foreground">
                    {item.label} (upgrade)
                  </div>
                ) : (
                  <a
                    key={item.href}
                    href={item.href}
                    className={`block border px-3 py-2 text-sm ${active ? 'border-foreground bg-foreground text-background' : 'border-transparent hover:border-foreground'}`}
                  >
                    {item.label}
                  </a>
                )
              );
            })}
          </nav>
        </aside>
        <div className="flex min-h-screen flex-col">
          <header className="border-b-2 border-foreground px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="mono-label text-[10px]">Workspace</p>
                <p className="text-sm">{user?.fullName ?? 'Analyst'}</p>
              </div>
              <Button
                variant="secondary"
                className="min-h-10 px-4 py-2 text-xs"
                onClick={() => {
                  clearSession();
                  router.push('/login');
                }}
              >
                Logout
              </Button>
            </div>
          </header>
          <main id="main-content" className="flex-1 p-6 md:p-8">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}

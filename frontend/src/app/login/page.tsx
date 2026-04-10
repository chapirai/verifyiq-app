'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { FormEvent, useMemo, useState } from 'react';
import { MarketingNav } from '@/components/marketing-nav';
import { api } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const nextUrl = useMemo(() => {
    if (typeof window === 'undefined') return '/dashboard';
    const value = new URLSearchParams(window.location.search).get('next');
    return value || '/dashboard';
  }, []);
  const [tenantSlug, setTenantSlug] = useState('demo-bank');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.login(email, password, tenantSlug.trim());
      const safeNext = (nextUrl.startsWith('/') ? nextUrl : '/dashboard') as Route;
      router.push(safeNext);
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen">
      <MarketingNav />
      <main className="px-6 pb-20 pt-4">
        <div className="mx-auto max-w-md space-y-6">
          <div className="space-y-3">
            <div className="section-badge">
              <span className="section-badge-dot" />
              <span className="section-badge-text">Authentication</span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">Sign in</h1>
            <p className="text-sm text-muted-foreground">Access your VerifyIQ workspace.</p>
          </div>
          <form className="panel space-y-4 p-6" onSubmit={handleSubmit}>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground" htmlFor="tenant">
                Tenant slug
              </label>
              <input
                id="tenant"
                className="input-ui"
                value={tenantSlug}
                onChange={(e) => setTenantSlug(e.target.value)}
                autoComplete="organization"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                className="input-ui"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                className="input-ui"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>
            {error ? <div className="alert-error">{error}</div> : null}
            <button className="primary-btn w-full" disabled={busy} type="submit">
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
          <p className="text-center text-sm text-muted-foreground">
            No account yet?{' '}
            <Link className="font-medium text-primary hover:underline" href="/signup">
              Create your workspace
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}

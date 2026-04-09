'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { FormEvent, useMemo, useState } from 'react';
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
    <main className="min-h-screen px-6 py-16">
      <div className="mx-auto max-w-md space-y-6">
        <div className="space-y-3">
          <div className="section-badge">
            <span className="section-badge-dot" />
            <span className="section-badge-text">Authentication</span>
          </div>
          <h1 className="text-4xl" style={{ fontFamily: 'var(--font-calistoga), Georgia, serif' }}>
            Sign in
          </h1>
        </div>
        <form className="panel space-y-4 p-6" onSubmit={handleSubmit}>
          <div className="space-y-1">
            <label className="text-sm text-muted-foreground">Tenant slug</label>
            <input className="input-ui" value={tenantSlug} onChange={(e) => setTenantSlug(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-sm text-muted-foreground">Email</label>
            <input className="input-ui" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-sm text-muted-foreground">Password</label>
            <input
              className="input-ui"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <button className="primary-btn w-full" disabled={busy} type="submit">
            {busy ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
        <p className="text-sm text-muted-foreground">
          No account yet?{' '}
          <Link className="text-accent hover:underline" href="/signup">
            Create your workspace
          </Link>
        </p>
      </div>
    </main>
  );
}

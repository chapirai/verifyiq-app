'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { MarketingNav } from '@/components/marketing-nav';
import { api } from '@/lib/api';

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    tenantName: '',
    tenantSlug: '',
    fullName: '',
    email: '',
    password: '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.signup(form);
      router.push('/dashboard');
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Signup failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen">
      <MarketingNav />
      <main className="px-6 pb-20 pt-4">
        <div className="mx-auto max-w-xl space-y-6">
          <div className="space-y-3">
            <div className="section-badge">
              <span className="section-badge-dot" />
              <span className="section-badge-text">Workspace setup</span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">Create your account</h1>
            <p className="text-sm text-muted-foreground">Start with VerifyIQ and Nordic Company Data.</p>
          </div>
          <form className="panel grid gap-4 p-6 md:grid-cols-2" onSubmit={handleSubmit}>
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-sm font-medium text-foreground">Organization name</label>
              <input
                className="input-ui"
                value={form.tenantName}
                onChange={(e) => setForm((prev) => ({ ...prev, tenantName: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Tenant slug</label>
              <input
                className="input-ui"
                value={form.tenantSlug}
                onChange={(e) => setForm((prev) => ({ ...prev, tenantSlug: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Full name</label>
              <input
                className="input-ui"
                value={form.fullName}
                onChange={(e) => setForm((prev) => ({ ...prev, fullName: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Email</label>
              <input
                className="input-ui"
                type="email"
                value={form.email}
                onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Password</label>
              <input
                className="input-ui"
                type="password"
                value={form.password}
                onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
              />
            </div>
            {error ? <div className="alert-error md:col-span-2">{error}</div> : null}
            <button className="primary-btn md:col-span-2" disabled={busy} type="submit">
              {busy ? 'Creating account…' : 'Create account'}
            </button>
          </form>
          <p className="text-center text-sm text-muted-foreground">
            Already registered?{' '}
            <Link className="font-medium text-primary hover:underline" href="/login">
              Sign in
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}

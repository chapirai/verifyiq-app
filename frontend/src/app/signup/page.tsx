'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
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
    <main className="min-h-screen px-6 py-16">
      <div className="mx-auto max-w-xl space-y-6">
        <div className="space-y-3">
          <div className="section-badge">
            <span className="section-badge-dot" />
            <span className="section-badge-text">Workspace setup</span>
          </div>
          <h1 className="text-4xl" style={{ fontFamily: 'var(--font-calistoga), Georgia, serif' }}>
            Create your account
          </h1>
        </div>
        <form className="panel grid gap-4 p-6 md:grid-cols-2" onSubmit={handleSubmit}>
          <div className="space-y-1 md:col-span-2">
            <label className="text-sm text-muted-foreground">Organization name</label>
            <input
              className="input-ui"
              value={form.tenantName}
              onChange={(e) => setForm((prev) => ({ ...prev, tenantName: e.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm text-muted-foreground">Tenant slug</label>
            <input
              className="input-ui"
              value={form.tenantSlug}
              onChange={(e) => setForm((prev) => ({ ...prev, tenantSlug: e.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm text-muted-foreground">Full name</label>
            <input
              className="input-ui"
              value={form.fullName}
              onChange={(e) => setForm((prev) => ({ ...prev, fullName: e.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm text-muted-foreground">Email</label>
            <input
              className="input-ui"
              type="email"
              value={form.email}
              onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm text-muted-foreground">Password</label>
            <input
              className="input-ui"
              type="password"
              value={form.password}
              onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
            />
          </div>
          {error ? <p className="text-sm text-red-600 md:col-span-2">{error}</p> : null}
          <button className="primary-btn md:col-span-2" disabled={busy} type="submit">
            {busy ? 'Creating account...' : 'Create account'}
          </button>
        </form>
        <p className="text-sm text-muted-foreground">
          Already registered?{' '}
          <Link className="text-accent hover:underline" href="/login">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}

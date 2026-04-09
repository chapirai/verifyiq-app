'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

export default function SignupPage() {
  const router = useRouter();
  const [tenantName, setTenantName] = useState('');
  const [tenantSlug, setTenantSlug] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await api.signup({ tenantName, tenantSlug, fullName, email, password });
      router.push('/dashboard');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not create account';
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="panel w-full max-w-xl p-8">
        <p className="mb-2 text-sm uppercase tracking-[0.2em] text-muted-foreground">Nordic Company Data</p>
        <h1 className="mb-2 text-4xl" style={{ fontFamily: 'var(--font-calistoga), Georgia, serif' }}>Create VerifyIQ workspace</h1>
        <p className="mb-6 text-sm text-muted-foreground">Set up your company tenant and admin account.</p>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <input className="input-ui" placeholder="Company name" value={tenantName} onChange={(e) => setTenantName(e.target.value)} required />
          <input className="input-ui" placeholder="Company slug (e.g. northbank)" value={tenantSlug} onChange={(e) => setTenantSlug(e.target.value.toLowerCase())} required />
          <input className="input-ui" placeholder="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
          <input type="email" className="input-ui" placeholder="Work email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <input type="password" className="input-ui" placeholder="Password (min 8 chars)" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
          {error ? <p className="text-sm text-red-400">{error}</p> : null}
          <button disabled={loading} className="primary-btn w-full disabled:opacity-60">
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>
      </div>
    </main>
  );
}

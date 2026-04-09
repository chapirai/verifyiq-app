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
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="panel w-full max-w-xl p-8">
        <p className="mb-2 text-sm uppercase tracking-[0.2em] text-slate-400">VerifyIQ</p>
        <h1 className="mb-6 text-3xl font-semibold">Create your workspace</h1>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <input className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" placeholder="Company name" value={tenantName} onChange={(e) => setTenantName(e.target.value)} required />
          <input className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" placeholder="Company slug (e.g. northbank)" value={tenantSlug} onChange={(e) => setTenantSlug(e.target.value.toLowerCase())} required />
          <input className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" placeholder="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
          <input type="email" className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" placeholder="Work email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <input type="password" className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" placeholder="Password (min 8 chars)" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
          {error ? <p className="text-sm text-red-400">{error}</p> : null}
          <button disabled={loading} className="w-full rounded-xl bg-indigo-600 px-4 py-3 font-medium text-white disabled:opacity-60">
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>
      </div>
    </main>
  );
}

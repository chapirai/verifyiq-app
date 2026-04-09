'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await api.login(email, password);
      router.push('/dashboard');
    } catch (err) {
      setError('Login failed. Check backend and credentials.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="panel w-full max-w-md p-8">
        <p className="mb-2 text-sm uppercase tracking-[0.2em] text-muted-foreground">Nordic Company Data</p>
        <h1 className="mb-2 text-4xl" style={{ fontFamily: 'var(--font-calistoga), Georgia, serif' }}>VerifyIQ</h1>
        <p className="mb-6 text-sm text-muted-foreground">Sign in to your data workspace</p>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="mb-2 block text-sm text-muted-foreground">Email</label>
            <input className="input-ui" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="mb-2 block text-sm text-muted-foreground">Password</label>
            <input type="password" className="input-ui" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          {error ? <p className="text-sm text-red-400">{error}</p> : null}
          <button disabled={loading} className="primary-btn w-full disabled:opacity-60">
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </main>
  );
}

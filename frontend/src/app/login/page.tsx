'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { api, ApiError } from '@/lib/api';

export default function LoginPage() {
  const [tenantId, setTenantId] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await api.login({ tenantId, email, password });
      const params = new URLSearchParams(window.location.search);
      const requestedNext = params.get('next') ?? '/dashboard';
      const nextPath =
        requestedNext.startsWith('/') && !requestedNext.startsWith('//')
          ? requestedNext
          : '/dashboard';
      window.location.href = nextPath;
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError('Could not sign in. Please retry.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="site-divider min-h-screen py-20">
      <div className="editorial-container max-w-2xl">
        <div className="border-2 border-foreground p-8 md:p-10">
          <p className="mono-label text-[10px]">Account Access</p>
          <h1 className="font-display mt-4 text-5xl">Login</h1>
          <form className="mt-10 space-y-5" onSubmit={onSubmit}>
            <Input value={tenantId} onChange={(e) => setTenantId(e.target.value)} placeholder="Tenant ID" required />
            <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Work email" type="email" required />
            <Input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" type="password" required />
            {error ? <p className="text-sm text-muted-foreground">{error}</p> : null}
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? 'Signing in...' : 'Sign in'}
            </Button>
          </form>
          <div className="mt-6 flex justify-between text-sm">
            <Link href="/forgot-password" className="underline underline-offset-4">Forgot password</Link>
            <Link href="/signup" className="underline underline-offset-4">Create account</Link>
          </div>
        </div>
      </div>
    </main>
  );
}

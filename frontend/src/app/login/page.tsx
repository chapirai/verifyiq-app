'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { AuthShell } from '@/components/auth/AuthShell';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { api, ApiError } from '@/lib/api';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await api.login({ email, password });
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
    <AuthShell
      kicker="Account access"
      title="Login"
      footer={
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <Link href="/forgot-password" className="link-auth w-fit">
            Forgot password
          </Link>
          <Link href="/signup" className="link-auth w-fit sm:text-right">
            Create account
          </Link>
        </div>
      }
    >
      <form className="mt-10 space-y-5" onSubmit={onSubmit}>
        <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Work email" type="email" required />
        <Input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" type="password" required />
        {error ? (
          <p className="border-l-4 border-foreground pl-3 text-sm text-muted-foreground" role="alert">
            {error}
          </p>
        ) : null}
        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? 'Signing in...' : 'Sign in'}
        </Button>
      </form>
    </AuthShell>
  );
}

'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { AuthShell } from '@/components/auth/AuthShell';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { api } from '@/lib/api';

export default function SetPasswordPage() {
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setToken(params.get('token') ?? '');
  }, []);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    if (!token) {
      setError('Invalid setup token.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setSubmitting(true);
    try {
      await api.setPassword(token, password);
      setMessage('Password set. Redirecting to the app...');
      window.location.href = '/dashboard';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not set password.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell
      kicker="Account setup"
      title="Create your password"
      lead="This completes your email verification. Use a strong password you have not used elsewhere."
      footer={
        <p className="text-sm text-muted-foreground">
          <Link href="/login" className="link-auth">
            Back to sign in
          </Link>
        </p>
      }
    >
      <form className="mt-10 space-y-5" onSubmit={onSubmit}>
        <Input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <Input
          type="password"
          placeholder="Confirm password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
        />
        {error ? (
          <p className="border-l-4 border-foreground pl-3 text-sm text-muted-foreground" role="alert">
            {error}
          </p>
        ) : null}
        {message ? (
          <p className="border-l-4 border-foreground pl-3 text-sm text-foreground" role="status">
            {message}
          </p>
        ) : null}
        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? 'Saving...' : 'Set password'}
        </Button>
      </form>
    </AuthShell>
  );
}

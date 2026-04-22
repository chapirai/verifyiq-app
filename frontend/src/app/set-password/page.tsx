'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { api } from '@/lib/api';
import { useEffect } from 'react';

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
      setMessage('Password set. Redirecting to app...');
      window.location.href = '/dashboard';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not set password.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="site-divider min-h-screen py-20">
      <div className="editorial-container max-w-2xl">
        <div className="border-2 border-foreground p-8 md:p-10">
          <p className="mono-label text-[10px]">Set password</p>
          <h1 className="font-display mt-4 text-5xl">Create your password</h1>
          <form className="mt-10 space-y-5" onSubmit={onSubmit}>
            <Input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            <Input type="password" placeholder="Confirm password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
            {error ? <p className="text-sm text-muted-foreground">{error}</p> : null}
            {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? 'Saving...' : 'Set password'}
            </Button>
          </form>
          <p className="mt-6 text-sm">
            <Link href="/login" className="underline underline-offset-4">Back to login</Link>
          </p>
        </div>
      </div>
    </main>
  );
}


'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { AuthShell } from '@/components/auth/AuthShell';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { api } from '@/lib/api';

export default function ResetPasswordPage() {
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
      setError('Invalid reset token.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setSubmitting(true);
    try {
      await api.resetPassword(token, password);
      setMessage('Password reset successful. You can now sign in.');
    } catch (err) {
      const text = err instanceof Error ? err.message : 'Reset failed.';
      setError(text);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell
      kicker="Password reset"
      title="Set a new password"
      lead="Choose a new password for your account."
      footer={
        <p className="text-sm text-muted-foreground">
          Return to{' '}
          <Link href="/login" className="link-auth">
            sign in
          </Link>
        </p>
      }
    >
      <form className="mt-10 space-y-5" onSubmit={onSubmit}>
        <Input
          type="password"
          placeholder="New password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <Input
          type="password"
          placeholder="Confirm new password"
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
        <Button className="w-full" type="submit" disabled={submitting}>
          {submitting ? 'Saving...' : 'Update password'}
        </Button>
      </form>
    </AuthShell>
  );
}

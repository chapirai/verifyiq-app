'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { AuthShell } from '@/components/auth/AuthShell';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { api } from '@/lib/api';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setMessage('');
    setSubmitting(true);
    try {
      await api.forgotPassword(email);
      setMessage('If the account exists, a reset link has been sent.');
    } catch (err) {
      const text = err instanceof Error ? err.message.toLowerCase() : '';
      setMessage(
        text.includes('too many') ? 'Please wait before requesting again.' : 'If the account exists, a reset link has been sent.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell
      kicker="Credential recovery"
      title="Forgot password"
      lead="Enter your work email. If an account exists, we will send a reset link."
      footer={
        <p className="text-sm text-muted-foreground">
          Back to{' '}
          <Link href="/login" className="link-auth">
            sign in
          </Link>
        </p>
      }
    >
      <form className="mt-10 space-y-5" onSubmit={onSubmit}>
        <Input
          placeholder="Work email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        {message ? (
          <p className="border-l-4 border-foreground pl-3 text-sm text-muted-foreground" role="status">
            {message}
          </p>
        ) : null}
        <Button className="w-full" type="submit" disabled={submitting}>
          {submitting ? 'Sending...' : 'Request reset link'}
        </Button>
      </form>
    </AuthShell>
  );
}

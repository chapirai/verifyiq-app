'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AuthShell } from '@/components/auth/AuthShell';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { api } from '@/lib/api';

export default function VerifyEmailPendingPage() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setEmail(params.get('email') ?? '');
  }, []);

  return (
    <AuthShell
      kicker="Inbox"
      title="Check your email"
      lead="We sent a verification link. Open it from the same device you used to sign up, then return here if needed."
      footer={
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <Link href="/signup" className="link-auth w-fit">
            Use a different email
          </Link>
          <Link href="/login" className="link-auth w-fit sm:text-right">
            Back to sign in
          </Link>
        </div>
      }
    >
      <div className="mt-10 space-y-5">
        <Input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Work email"
          type="email"
        />
        <Button
          type="button"
          className="w-full"
          disabled={submitting}
          onClick={() => {
            setSubmitting(true);
            setMessage('');
            void api
              .resendSignupVerification(email)
              .then(() => setMessage('Verification email sent again.'))
              .catch(() => setMessage('Could not resend right now. Please try again.'))
              .finally(() => setSubmitting(false));
          }}
        >
          {submitting ? 'Sending...' : 'Resend verification →'}
        </Button>
        {message ? (
          <p className="border-l-4 border-foreground pl-3 text-sm text-muted-foreground" role="status">
            {message}
          </p>
        ) : null}
      </div>
    </AuthShell>
  );
}

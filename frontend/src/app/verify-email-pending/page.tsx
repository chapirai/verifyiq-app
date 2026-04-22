'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
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
    <main className="site-divider min-h-screen py-20">
      <div className="editorial-container max-w-2xl">
        <div className="border-2 border-foreground p-8 md:p-10">
          <p className="mono-label text-[10px]">Email verification</p>
          <h1 className="font-display mt-4 text-5xl">Check your inbox</h1>
          <p className="mt-4 text-muted-foreground">
            We sent a verification link to your email. Open the link to continue password setup.
          </p>
          <div className="mt-8 space-y-4">
            <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Work email" type="email" />
            <Button
              className="w-full"
              disabled={submitting}
              onClick={() => {
                setSubmitting(true);
                setMessage('');
                void api
                  .resendSignupVerification(email)
                  .then(() => setMessage('Verification email resent.'))
                  .catch(() => setMessage('Could not resend right now. Please try again.'))
                  .finally(() => setSubmitting(false));
              }}
            >
              {submitting ? 'Sending...' : 'Resend verification'}
            </Button>
            {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
          </div>
          <div className="mt-6 flex justify-between text-sm">
            <Link href="/signup" className="underline underline-offset-4">Change email</Link>
            <Link href="/login" className="underline underline-offset-4">Back to login</Link>
          </div>
        </div>
      </div>
    </main>
  );
}


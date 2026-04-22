'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

type VerifyState = 'loading' | 'success' | 'invalid' | 'expired' | 'error';

export default function VerifyEmailPage() {
  const [token, setToken] = useState('');
  const [state, setState] = useState<VerifyState>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setToken(params.get('token') ?? '');
  }, []);

  useEffect(() => {
    if (!token) {
      setState('invalid');
      return;
    }
    void api
      .verifyEmail(token)
      .then((res) => {
        setState('success');
        window.location.href = `/set-password?token=${encodeURIComponent(res.passwordSetupToken)}`;
      })
      .catch((e) => {
        const msg = e instanceof Error ? e.message.toLowerCase() : '';
        if (msg.includes('expired')) setState('expired');
        else if (msg.includes('invalid')) setState('invalid');
        else setState('error');
        setMessage(e instanceof Error ? e.message : 'Verification failed.');
      });
  }, [token]);

  return (
    <main className="site-divider min-h-screen py-20">
      <div className="editorial-container max-w-2xl">
        <div className="border-2 border-foreground p-8 md:p-10">
          <p className="mono-label text-[10px]">Verify email</p>
          <h1 className="font-display mt-4 text-5xl">
            {state === 'loading' ? 'Verifying...' : state === 'success' ? 'Verified' : 'Verification issue'}
          </h1>
          <p className="mt-4 text-muted-foreground">
            {state === 'loading' && 'Checking your verification link.'}
            {state === 'success' && 'Email verified. Redirecting to password setup.'}
            {state === 'invalid' && 'This verification link is invalid.'}
            {state === 'expired' && 'This verification link has expired.'}
            {state === 'error' && (message || 'We could not verify your email.')}
          </p>
          <p className="mt-6 text-sm">
            <Link href="/verify-email-pending" className="underline underline-offset-4">Request a new verification link</Link>
          </p>
        </div>
      </div>
    </main>
  );
}


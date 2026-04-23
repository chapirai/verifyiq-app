'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AuthShell } from '@/components/auth/AuthShell';
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

  const title =
    state === 'loading'
      ? 'Verifying'
      : state === 'success'
        ? 'Verified'
        : state === 'expired'
          ? 'Link expired'
          : 'Verification issue';

  return (
    <AuthShell
      kicker="Email"
      title={title}
      lead={
        <>
          {state === 'loading' && 'Checking your verification link.'}
          {state === 'success' && 'Email verified. Taking you to password setup.'}
          {state === 'invalid' && 'This verification link is not valid.'}
          {state === 'expired' && 'This verification link has expired.'}
          {state === 'error' && (message || 'We could not verify your email.')}
        </>
      }
      footer={
        <p className="text-sm text-muted-foreground">
          <Link href="/verify-email-pending" className="link-auth">
            Request a new verification link
          </Link>
        </p>
      }
    />
  );
}

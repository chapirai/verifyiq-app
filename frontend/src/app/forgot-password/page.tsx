'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
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
      setMessage(text.includes('too many') ? 'Please wait before requesting again.' : 'If the account exists, a reset link has been sent.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="site-divider min-h-screen py-20">
      <div className="editorial-container max-w-2xl">
        <div className="border-2 border-foreground p-8 md:p-10">
          <p className="mono-label text-[10px]">Credential Recovery</p>
          <h1 className="font-display mt-4 text-5xl">Forgot password</h1>
          <p className="mt-4 text-muted-foreground">Enter your email and we will send a reset link if an account exists.</p>
          <form className="mt-8 space-y-4" onSubmit={onSubmit}>
            <Input placeholder="Work email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
            <Button className="w-full" disabled={submitting}>{submitting ? 'Sending...' : 'Request reset link'}</Button>
          </form>
          <p className="mt-6 text-sm">
            Back to <Link href="/login" className="underline underline-offset-4">login</Link>
          </p>
        </div>
      </div>
    </main>
  );
}

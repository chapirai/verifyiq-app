'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { api, ApiError } from '@/lib/api';

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    companyName: '',
    termsAccepted: false,
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setSuccess('');
    setSubmitting(true);
    try {
      await api.signup({
        fullName: form.fullName,
        email: form.email,
        companyName: form.companyName || undefined,
        termsAccepted: form.termsAccepted,
      });
      setSuccess('Verification email sent. Continue to verify your email.');
      router.push(`/verify-email-pending?email=${encodeURIComponent(form.email.trim().toLowerCase())}`);
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError('Could not create account.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="site-divider min-h-screen py-20">
      <div className="editorial-container max-w-2xl">
        <div className="border-2 border-foreground p-8 md:p-10">
          <p className="mono-label text-[10px]">Workspace Creation</p>
          <h1 className="font-display mt-4 text-5xl">Create your VerifyIQ access</h1>
          <form className="mt-10 grid gap-5" onSubmit={onSubmit}>
            <Input
              placeholder="Full name"
              value={form.fullName}
              onChange={(e) => setForm((v) => ({ ...v, fullName: e.target.value }))}
              required
            />
            <Input placeholder="Work email" type="email" value={form.email} onChange={(e) => setForm((v) => ({ ...v, email: e.target.value }))} required />
            <Input
              placeholder="Company name (optional)"
              value={form.companyName}
              onChange={(e) => setForm((v) => ({ ...v, companyName: e.target.value }))}
            />
            <label className="flex items-start gap-3 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={form.termsAccepted}
                onChange={(e) => setForm((v) => ({ ...v, termsAccepted: e.target.checked }))}
                required
              />
              <span>
                I agree to the terms and privacy policy.
              </span>
            </label>
            {error ? <p className="text-sm text-muted-foreground">{error}</p> : null}
            {success ? <p className="text-sm text-emerald-700">{success}</p> : null}
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? 'Submitting...' : 'Request access'}
            </Button>
          </form>
          <p className="mt-6 text-sm">
            Already registered? <Link href="/login" className="underline underline-offset-4">Login</Link>
          </p>
        </div>
      </div>
    </main>
  );
}

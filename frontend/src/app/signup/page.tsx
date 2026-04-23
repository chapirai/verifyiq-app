'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AuthShell } from '@/components/auth/AuthShell';
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
    <AuthShell
      kicker="Workspace creation"
      title="Request access"
      lead="Create your VerifyIQ workspace with a work email. We will send a link to verify your inbox."
      footer={
        <p className="text-sm text-muted-foreground">
          Already registered?{' '}
          <Link href="/login" className="link-auth">
            Sign in
          </Link>
        </p>
      }
    >
      <form className="mt-10 grid gap-5" onSubmit={onSubmit}>
        <Input
          placeholder="Full name"
          value={form.fullName}
          onChange={(e) => setForm((v) => ({ ...v, fullName: e.target.value }))}
          required
        />
        <Input
          placeholder="Work email"
          type="email"
          value={form.email}
          onChange={(e) => setForm((v) => ({ ...v, email: e.target.value }))}
          required
        />
        <Input
          placeholder="Company name (optional)"
          value={form.companyName}
          onChange={(e) => setForm((v) => ({ ...v, companyName: e.target.value }))}
        />
        <label className="flex items-start gap-3 text-sm leading-relaxed text-muted-foreground">
          <input
            type="checkbox"
            checked={form.termsAccepted}
            onChange={(e) => setForm((v) => ({ ...v, termsAccepted: e.target.checked }))}
            required
          />
          <span>I agree to the terms and privacy policy.</span>
        </label>
        {error ? (
          <p className="border-l-4 border-foreground pl-3 text-sm text-muted-foreground" role="alert">
            {error}
          </p>
        ) : null}
        {success ? (
          <p className="border-l-4 border-foreground pl-3 text-sm text-foreground" role="status">
            {success}
          </p>
        ) : null}
        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? 'Submitting...' : 'Request access →'}
        </Button>
      </form>
    </AuthShell>
  );
}

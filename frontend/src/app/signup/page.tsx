'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { api, ApiError } from '@/lib/api';

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function deriveWorkspaceFromEmail(email: string) {
  const [localPartRaw, domainRaw] = email.split('@');
  const localPart = localPartRaw?.trim() || 'user';
  const domain = domainRaw?.trim() || 'workspace';
  const domainName = domain.split('.')[0] || 'workspace';
  const base = slugify(domainName) || 'workspace';
  const suffix = Math.random().toString(36).slice(2, 8);
  return {
    tenantName: `${domainName.charAt(0).toUpperCase()}${domainName.slice(1)} Workspace`,
    tenantSlug: `${base}-${suffix}`,
    fullName: localPart.replace(/[._-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
  };
}

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    email: '',
    password: '',
    planCode: 'free',
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const derived = deriveWorkspaceFromEmail(form.email);
      await api.signup({
        tenantSlug: derived.tenantSlug,
        tenantName: derived.tenantName,
        fullName: derived.fullName,
        email: form.email,
        password: form.password,
      });

      if (form.planCode === 'free') {
        router.push('/dashboard');
        return;
      }

      const checkout = await api.createCheckoutSession(form.planCode);
      const checkoutUrl = (checkout as { data?: { checkoutUrl?: string } }).data?.checkoutUrl;
      if (checkoutUrl) {
        window.location.href = checkoutUrl;
        return;
      }
      router.push('/billing');
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
          <h1 className="font-display mt-4 text-5xl">Sign up</h1>
          <form className="mt-10 grid gap-5" onSubmit={onSubmit}>
            <Input placeholder="Work email" type="email" value={form.email} onChange={(e) => setForm((v) => ({ ...v, email: e.target.value }))} required />
            <Input placeholder="Password" type="password" value={form.password} onChange={(e) => setForm((v) => ({ ...v, password: e.target.value }))} required />
            <select
              className="border border-border-light bg-background px-3 py-2 text-sm"
              value={form.planCode}
              onChange={(e) => setForm((v) => ({ ...v, planCode: e.target.value }))}
            >
              <option value="free">Free - 0 SEK/month</option>
              <option value="basic">Basic - 49 SEK/month</option>
              <option value="pro">Pro - 999 SEK/month</option>
            </select>
            {error ? <p className="text-sm text-muted-foreground">{error}</p> : null}
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? 'Creating...' : 'Create account'}
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

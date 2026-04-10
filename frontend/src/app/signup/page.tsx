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
    tenantSlug: '',
    tenantName: '',
    fullName: '',
    email: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await api.signup(form);
      router.push('/dashboard');
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
            <Input placeholder="Organization name" value={form.tenantName} onChange={(e) => setForm((v) => ({ ...v, tenantName: e.target.value }))} required />
            <Input placeholder="Organization slug" value={form.tenantSlug} onChange={(e) => setForm((v) => ({ ...v, tenantSlug: e.target.value }))} required />
            <Input placeholder="Full name" value={form.fullName} onChange={(e) => setForm((v) => ({ ...v, fullName: e.target.value }))} required />
            <Input placeholder="Work email" type="email" value={form.email} onChange={(e) => setForm((v) => ({ ...v, email: e.target.value }))} required />
            <Input placeholder="Password" type="password" value={form.password} onChange={(e) => setForm((v) => ({ ...v, password: e.target.value }))} required />
            {error ? <p className="text-sm text-muted-foreground">{error}</p> : null}
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? 'Creating...' : 'Create workspace'}
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

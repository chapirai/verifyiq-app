'use client';

import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Button } from '@/components/ui/Button';
import { api } from '@/lib/api';
import { getCurrentUser } from '@/lib/auth';
import { ErrorState, LoadingSkeleton } from '@/components/ui/StateBlocks';

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [userId, setUserId] = useState('');
  const [tenantId, setTenantId] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [tenantName, setTenantName] = useState('');
  const [tenantSlug, setTenantSlug] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    const localUser = getCurrentUser<{ tenantId?: string }>();
    Promise.all([api.getMe(), localUser?.tenantId ? api.getTenantById(localUser.tenantId) : Promise.resolve(null)])
      .then(([me, tenant]) => {
        const user = (me as { data?: { id?: string; fullName?: string; email?: string; tenantId?: string } }).data;
        setUserId(user?.id ?? '');
        setTenantId(user?.tenantId ?? localUser?.tenantId ?? '');
        setFullName(user?.fullName ?? '');
        setEmail(user?.email ?? '');
        const t = (tenant as { data?: { name?: string; slug?: string } } | null)?.data;
        setTenantName(t?.name ?? '');
        setTenantSlug(t?.slug ?? '');
      })
      .catch((err: { message?: string }) => setError(err.message ?? 'Could not load settings'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSkeleton lines={8} />;
  if (error) return <ErrorState title="Settings unavailable" message={error} />;

  return (
    <section className="space-y-6">
      <h1 className="font-display text-5xl">Settings</h1>
      {message ? <p className="border-2 border-foreground p-3 text-sm">{message}</p> : null}
      <div className="grid gap-6 lg:grid-cols-2">
        <form
          className="space-y-4 border-2 border-foreground p-6"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await api.updateUser(userId, { fullName, email });
              setMessage('Profile updated.');
            } catch (err) {
              setMessage(err instanceof Error ? err.message : 'Profile update failed.');
            }
          }}
        >
          <p className="mono-label text-[10px]">Profile</p>
          <Input placeholder="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          <Input placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Input placeholder="Tenant ID" value={tenantId} disabled />
          <Button type="submit">Save profile</Button>
        </form>
        <form className="space-y-4 border-2 border-foreground p-6">
          <p className="mono-label text-[10px]">Organization</p>
          <Input placeholder="Organization name" value={tenantName} onChange={(e) => setTenantName(e.target.value)} disabled />
          <Input placeholder="Organization slug" value={tenantSlug} onChange={(e) => setTenantSlug(e.target.value)} disabled />
          <Textarea placeholder="Compliance notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          <Button type="button" disabled>Save organization (endpoint not exposed)</Button>
        </form>
      </div>
    </section>
  );
}

'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { normalizeIdentitetsbeteckning } from '@/lib/org-number';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { ErrorState, LoadingSkeleton } from '@/components/ui/StateBlocks';

export default function SearchPage() {
  const router = useRouter();
  const [orgNumber, setOrgNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [forceRefresh, setForceRefresh] = useState('false');

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const normalized = normalizeIdentitetsbeteckning(orgNumber);
      if (normalized.length !== 10 && normalized.length !== 12) {
        setError('Enter a 10- or 12-digit identitetsbeteckning (dashes optional).');
        setLoading(false);
        return;
      }
      await api.lookupCompany(normalized, forceRefresh === 'true');
      router.push(`/companies/workspace/${normalized}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Lookup failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="space-y-6">
      <h1 className="font-display text-5xl">Company lookup</h1>
      <p className="max-w-2xl text-muted-foreground">
        After a successful lookup you are taken to the <strong>company workspace</strong>: separate panels for HVD and FI v4 endpoint contracts, HVD annual report downloads (dokumentlista → dokumentId), and orchestrated summary.
      </p>
      <form className="grid gap-3 md:grid-cols-[1fr_200px_auto]" onSubmit={onSubmit}>
        <Input value={orgNumber} onChange={(e) => setOrgNumber(e.target.value)} placeholder="Organisation number (e.g. 5565683058)" required />
        <Select value={forceRefresh} onChange={(e) => setForceRefresh(e.target.value)}>
          <option value="false">Prefer cache</option>
          <option value="true">Force provider refresh</option>
        </Select>
        <Button type="submit">Lookup</Button>
      </form>
      {loading ? <LoadingSkeleton lines={6} /> : null}
      {!loading && error ? <ErrorState title="Lookup failed" message={error} /> : null}
    </section>
  );
}

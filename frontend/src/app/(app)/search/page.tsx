'use client';

import { FormEvent, useState } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { ErrorState, LoadingSkeleton } from '@/components/ui/StateBlocks';

export default function SearchPage() {
  const [orgNumber, setOrgNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [forceRefresh, setForceRefresh] = useState('false');

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const data = await api.lookupCompany(orgNumber, forceRefresh === 'true');
      setResult(data as Record<string, unknown>);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Lookup failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="space-y-6">
      <h1 className="font-display text-5xl">Company lookup</h1>
      <form className="grid gap-3 md:grid-cols-[1fr_200px_auto]" onSubmit={onSubmit}>
        <Input value={orgNumber} onChange={(e) => setOrgNumber(e.target.value)} placeholder="Organization number" required />
        <Select value={forceRefresh} onChange={(e) => setForceRefresh(e.target.value)}>
          <option value="false">Prefer cache</option>
          <option value="true">Force provider refresh</option>
        </Select>
        <Button type="submit">Lookup</Button>
      </form>
      {loading ? <LoadingSkeleton lines={6} /> : null}
      {!loading && error ? <ErrorState title="Lookup failed" message={error} /> : null}
      {!loading && result ? (
        <div className="border-2 border-foreground p-6">
          <pre className="overflow-x-auto text-xs">{JSON.stringify(result, null, 2)}</pre>
        </div>
      ) : null}
    </section>
  );
}

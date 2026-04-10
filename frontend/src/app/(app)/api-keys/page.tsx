'use client';

import { FormEvent, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { ApiKey } from '@/types/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ErrorState, LoadingSkeleton } from '@/components/ui/StateBlocks';
import { Table } from '@/components/ui/Table';

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    api.listApiKeys()
      .then((res) => setKeys(res.data))
      .catch((err: { message?: string }) => setError(err.message ?? 'Failed to load keys'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const onCreate = async (event: FormEvent) => {
    event.preventDefault();
    await api.createApiKey(name);
    setName('');
    load();
  };

  if (loading) return <LoadingSkeleton lines={6} />;
  if (error) return <ErrorState title="API keys unavailable" message={error} />;

  return (
    <section className="space-y-6">
      <h1 className="font-display text-5xl">API keys</h1>
      <form className="flex gap-3" onSubmit={onCreate}>
        <Input placeholder="Key name" value={name} onChange={(e) => setName(e.target.value)} required />
        <Button type="submit">Generate</Button>
      </form>
      <Table>
        <thead><tr><th>Name</th><th>Created</th><th>Status</th><th /></tr></thead>
        <tbody>
          {keys.map((key) => (
            <tr key={key.id}>
              <td>{key.name}</td>
              <td>{new Date(key.createdAt).toLocaleDateString()}</td>
              <td>{key.revokedAt ? 'Revoked' : 'Active'}</td>
              <td>
                {!key.revokedAt ? (
                  <button
                    className="underline underline-offset-4"
                    onClick={async () => {
                      await api.revokeApiKey(key.id);
                      load();
                    }}
                  >
                    Revoke
                  </button>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </section>
  );
}

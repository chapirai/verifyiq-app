'use client';

import { FormEvent, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { OauthClient } from '@/types/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ErrorState, LoadingSkeleton } from '@/components/ui/StateBlocks';
import { Table } from '@/components/ui/Table';

export default function ApiOauthClientsPage() {
  const [clients, setClients] = useState<OauthClient[]>([]);
  const [name, setName] = useState('');
  const [environment, setEnvironment] = useState<'live' | 'sandbox'>('live');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [secret, setSecret] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    api.listOauthClients()
      .then((res) => setClients(res.data))
      .catch((err: { message?: string }) => setError(err.message ?? 'Failed to load OAuth clients'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const onCreate = async (event: FormEvent) => {
    event.preventDefault();
    const created = await api.createOauthClient({ name, environment, scopes: ['companies:read'] });
    setSecret(created.data.clientSecret ?? null);
    setName('');
    load();
  };

  if (loading) return <LoadingSkeleton lines={6} />;
  if (error) return <ErrorState title="OAuth clients unavailable" message={error} />;

  return (
    <section className="space-y-6">
      <h1 className="font-display text-5xl">OAuth clients</h1>
      <form className="flex gap-3" onSubmit={onCreate}>
        <Input placeholder="Client name" value={name} onChange={(e) => setName(e.target.value)} required />
        <select
          className="border border-border-light bg-background px-3 py-2 text-sm"
          value={environment}
          onChange={(e) => setEnvironment(e.target.value as 'live' | 'sandbox')}
        >
          <option value="live">Live</option>
          <option value="sandbox">Sandbox</option>
        </select>
        <Button type="submit">Create client</Button>
      </form>
      {secret ? (
        <p className="text-sm text-muted-foreground">
          Client secret (shown once): <code className="font-mono">{secret}</code>
        </p>
      ) : null}
      <Table>
        <thead><tr><th>Name</th><th>Client ID</th><th>Environment</th><th>Status</th><th /></tr></thead>
        <tbody>
          {clients.map((client) => (
            <tr key={client.id}>
              <td>{client.name}</td>
              <td><code className="font-mono text-xs">{client.clientId}</code></td>
              <td>{client.environment}</td>
              <td>{client.revokedAt ? 'Revoked' : 'Active'}</td>
              <td>
                {!client.revokedAt ? (
                  <button
                    className="underline underline-offset-4"
                    onClick={async () => {
                      await api.revokeOauthClient(client.id);
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

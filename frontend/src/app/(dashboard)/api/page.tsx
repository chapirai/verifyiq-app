'use client';

import { useEffect, useState } from 'react';
import { api, type ApiKeyRecord } from '@/lib/api';
import { SectionHeader } from '@/components/section-header';

export default function ApiAccessPage() {
  const [apiKeys, setApiKeys] = useState<ApiKeyRecord[]>([]);
  const [name, setName] = useState('Primary key');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [lastCreated, setLastCreated] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    setError('');
    try {
      setApiKeys(await api.listApiKeys());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load API keys');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function handleCreate() {
    setCreating(true);
    setError('');
    try {
      const created = await api.createApiKey(name);
      setLastCreated(created.key ?? null);
      setName('Primary key');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create API key');
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke(id: string) {
    setError('');
    try {
      await api.revokeApiKey(id);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revoke API key');
    }
  }

  return (
    <section className="space-y-6">
      <SectionHeader
        eyebrow="Developer Platform"
        title="API Access"
        description="Manage key lifecycle, secure integrations, and monitor usage access."
      />

      <div className="panel p-6 space-y-4">
        <h2 className="text-lg font-semibold">Create API key</h2>
        <div className="flex gap-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input-ui flex-1"
            placeholder="Key name"
          />
          <button onClick={handleCreate} disabled={creating || !name.trim()} className="primary-btn disabled:opacity-60">
            {creating ? 'Creating…' : 'Create'}
          </button>
        </div>
        {lastCreated ? (
          <p className="rounded-lg bg-emerald-100 p-3 text-sm text-emerald-800">
            New key (copy now): <span className="font-mono">{lastCreated}</span>
          </p>
        ) : null}
      </div>

      <div className="panel p-6">
        <h2 className="text-lg font-semibold">Active API keys</h2>
        {loading ? <p className="mt-3 text-muted-foreground">Loading keys…</p> : null}
        {!loading && apiKeys.length === 0 ? (
          <p className="mt-3 text-muted-foreground">No API keys created yet.</p>
        ) : null}
        {!loading && apiKeys.length > 0 ? (
          <div className="mt-3 space-y-2">
            {apiKeys.map((key) => (
              <div key={key.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                <div>
                  <p className="font-medium">{key.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Prefix: <span className="font-mono">{key.keyPrefix}</span>
                  </p>
                </div>
                <button onClick={() => handleRevoke(key.id)} className="rounded-lg bg-red-100 px-3 py-1.5 text-sm text-red-700">
                  Revoke
                </button>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      {error ? <p className="text-sm text-red-400">{error}</p> : null}
    </section>
  );
}

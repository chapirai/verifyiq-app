'use client';

import { useEffect, useState } from 'react';
import { api, type ApiKeyRecord } from '@/lib/api';

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
      <div>
        <p className="text-sm text-slate-400">Developer Platform</p>
        <h1 className="text-3xl font-semibold">API Access</h1>
      </div>

      <div className="panel p-6 space-y-4">
        <h2 className="text-lg font-semibold">Create API key</h2>
        <div className="flex gap-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="flex-1 rounded-xl border border-slate-700 bg-slate-950 px-4 py-2"
            placeholder="Key name"
          />
          <button onClick={handleCreate} disabled={creating || !name.trim()} className="rounded-xl bg-indigo-600 px-4 py-2 font-medium disabled:opacity-60">
            {creating ? 'Creating…' : 'Create'}
          </button>
        </div>
        {lastCreated ? (
          <p className="rounded-lg bg-emerald-900/40 p-3 text-sm text-emerald-200">
            New key (copy now): <span className="font-mono">{lastCreated}</span>
          </p>
        ) : null}
      </div>

      <div className="panel p-6">
        <h2 className="text-lg font-semibold">Active API keys</h2>
        {loading ? <p className="mt-3 text-slate-400">Loading keys…</p> : null}
        {!loading && apiKeys.length === 0 ? (
          <p className="mt-3 text-slate-400">No API keys created yet.</p>
        ) : null}
        {!loading && apiKeys.length > 0 ? (
          <div className="mt-3 space-y-2">
            {apiKeys.map((key) => (
              <div key={key.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                <div>
                  <p className="font-medium">{key.name}</p>
                  <p className="text-xs text-slate-400">
                    Prefix: <span className="font-mono">{key.keyPrefix}</span>
                  </p>
                </div>
                <button onClick={() => handleRevoke(key.id)} className="rounded-lg bg-red-700/50 px-3 py-1.5 text-sm">
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

'use client';

import { useEffect, useState } from 'react';
import { SectionHeader } from '@/components/section-header';
import { api, type ApiKeyRecord } from '@/lib/api';

export default function ApiAccessPage() {
  const [name, setName] = useState('');
  const [keys, setKeys] = useState<ApiKeyRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function loadKeys() {
    try {
      setKeys(await api.listApiKeys());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load keys.');
    }
  }

  useEffect(() => {
    void loadKeys();
  }, []);

  async function handleCreate() {
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await api.createApiKey(name.trim());
      setName('');
      await loadKeys();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create key.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="API Access"
        title="Manage API keys"
        description="Create and revoke tenant API keys used by external integrations."
      />
      {error ? <div className="alert-error">{error}</div> : null}
      <section className="panel space-y-4 p-6">
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            className="input-ui flex-1"
            placeholder="Key name (e.g. Production backend)"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button className="primary-btn" disabled={busy} onClick={() => void handleCreate()} type="button">
            {busy ? 'Creating...' : 'Create key'}
          </button>
        </div>
        <div className="space-y-2">
          {keys.map((key) => (
            <div key={key.id} className="rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm">
              <p className="font-medium">{key.name}</p>
              <p className="font-mono text-xs text-muted-foreground">{key.keyPrefix}********</p>
            </div>
          ))}
          {!keys.length ? <p className="text-sm text-muted-foreground">No API keys yet.</p> : null}
        </div>
      </section>
    </div>
  );
}

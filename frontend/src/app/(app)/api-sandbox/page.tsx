'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { ApiKey } from '@/types/api';
import { Button } from '@/components/ui/Button';
import { ErrorState, LoadingSkeleton } from '@/components/ui/StateBlocks';

export default function ApiSandboxPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [baseUrl, setBaseUrl] = useState('/sandbox/api/v1');
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [createdSecret, setCreatedSecret] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getSandboxConnection();
      setBaseUrl(res.data.baseUrl);
      setKeys(res.data.keys);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load sandbox setup');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  if (loading) return <LoadingSkeleton lines={6} />;
  if (error) return <ErrorState title="Sandbox unavailable" message={error} />;

  return (
    <section className="space-y-6">
      <h1 className="font-display text-5xl">API sandbox</h1>
      <p className="text-sm text-muted-foreground">
        Use the sandbox to test integration safely before live traffic. Base URL:
        <code className="ml-2 font-mono">{baseUrl}</code>
      </p>
      <div className="flex items-center gap-3">
        <Button
          type="button"
          onClick={async () => {
            const created = await api.provisionSandboxKey();
            setCreatedSecret(created.data.key ?? null);
            await load();
          }}
        >
          Provision sandbox key
        </Button>
      </div>
      {createdSecret ? (
        <p className="text-sm text-muted-foreground">
          Sandbox key (shown once): <code className="font-mono">{createdSecret}</code>
        </p>
      ) : null}
      <div className="border border-border-light p-4">
        <p className="mono-label text-[10px]">Connection example</p>
        <pre className="mt-2 overflow-x-auto text-xs">
{`curl -H "x-api-key: <your_sandbox_key>" \\
  ${baseUrl}/companies/556677-8899/financials`}
        </pre>
      </div>
      <div className="border border-border-light p-4">
        <p className="mono-label text-[10px]">Active sandbox keys</p>
        {keys.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No sandbox key yet.</p>
        ) : (
          <ul className="mt-2 space-y-2 text-sm">
            {keys.map((k) => (
              <li key={k.id} className="flex justify-between border-b border-border-light pb-2">
                <span>{k.name}</span>
                <span className="text-muted-foreground">{new Date(k.createdAt).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

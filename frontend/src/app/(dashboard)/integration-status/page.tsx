'use client';

import { useState, useCallback } from 'react';
import { api } from '@/lib/api';

interface TokenEntry {
  cacheKey: string;
  expiresAt: number;
  expiresInMs: number;
  scope?: string;
  tokenType?: string;
}

interface TokenCacheStatus {
  entries: TokenEntry[];
  metrics: {
    cacheHits: number;
    cacheMisses: number;
    refreshes: number;
    requestFailures: number;
  };
}

interface HealthStatus {
  status: string;
  latencyMs?: number;
}

function serviceLabel(cacheKey: string): string {
  if (cacheKey.startsWith('hvd:')) return 'HVD (Värdefulla Datamängder)';
  if (cacheKey.startsWith('org:')) return 'Företagsinformation (v4)';
  return cacheKey;
}

function expiryBadge(expiresInMs: number): JSX.Element {
  const minutes = Math.floor(expiresInMs / 60_000);
  const isExpired = expiresInMs <= 0;
  const isCritical = !isExpired && minutes < 5;
  const isWarning = !isExpired && minutes < 30;

  let cls = 'bg-emerald-900/50 text-emerald-300';
  let label = `${minutes}m remaining`;
  if (isExpired) {
    cls = 'bg-red-900/50 text-red-300';
    label = 'Expired';
  } else if (isCritical) {
    cls = 'bg-red-900/50 text-red-300';
  } else if (isWarning) {
    cls = 'bg-yellow-900/50 text-yellow-300';
  }

  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      {label}
    </span>
  );
}

export default function IntegrationStatusPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tokenCache, setTokenCache] = useState<TokenCacheStatus | null>(null);
  const [health, setHealth] = useState<HealthStatus | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [cacheData, healthData] = await Promise.all([
        api.bolagsverket.tokenCacheStatus(),
        api.bolagsverket.healthCheck(),
      ]);
      setTokenCache(cacheData);
      setHealth(healthData);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Integration Status</h1>
          <p className="mt-1 text-sm text-slate-400">
            OAuth token health and API availability for connected data services.
          </p>
        </div>
        <button
          onClick={refresh}
          disabled={loading}
          className="rounded-xl bg-indigo-600 px-5 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-700 bg-red-900/30 p-4 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* API Health */}
      <div className="rounded-2xl border border-border bg-card p-6">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-slate-400">
          API Health
        </h2>
        {health ? (
          <div className="flex items-center gap-3">
            <span
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                health.status === 'ok'
                  ? 'bg-emerald-900/50 text-emerald-300'
                  : 'bg-red-900/50 text-red-300'
              }`}
            >
              {health.status === 'ok' ? '✓ Online' : `✗ ${health.status}`}
            </span>
            {health.latencyMs !== undefined && (
              <span className="text-xs text-slate-500">{health.latencyMs} ms latency</span>
            )}
          </div>
        ) : (
          <p className="text-sm text-slate-500">Click Refresh to check API availability.</p>
        )}
      </div>

      {/* Token Cache */}
      <div className="rounded-2xl border border-border bg-card p-6">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-slate-400">
          OAuth Token Cache
        </h2>
        {tokenCache ? (
          <div className="space-y-6">
            {/* Per-service entries */}
            {tokenCache.entries.length === 0 ? (
              <p className="text-sm text-slate-500">
                No tokens cached yet — they are fetched on first API use.
              </p>
            ) : (
              <div className="space-y-3">
                {tokenCache.entries.map((entry) => (
                  <div
                    key={entry.cacheKey}
                    className="rounded-xl border border-border bg-slate-800/30 px-4 py-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-white">
                          {serviceLabel(entry.cacheKey)}
                        </p>
                        {entry.scope && (
                          <p className="mt-0.5 text-xs text-slate-500">
                            Scope: {entry.scope}
                          </p>
                        )}
                        <p className="mt-0.5 text-xs text-slate-500">
                          Expires: {new Date(entry.expiresAt).toLocaleString()}
                        </p>
                      </div>
                      {expiryBadge(entry.expiresInMs)}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Metrics */}
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-500">
                Cache Metrics (since last restart)
              </h3>
              <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { label: 'Cache Hits', value: tokenCache.metrics.cacheHits },
                  { label: 'Cache Misses', value: tokenCache.metrics.cacheMisses },
                  { label: 'Refreshes', value: tokenCache.metrics.refreshes },
                  { label: 'Request Failures', value: tokenCache.metrics.requestFailures },
                ].map(({ label, value }) => (
                  <div
                    key={label}
                    className="rounded-xl border border-border bg-slate-800/40 px-4 py-3"
                  >
                    <dt className="text-xs uppercase tracking-widest text-slate-500">{label}</dt>
                    <dd
                      className={`mt-0.5 text-2xl font-semibold ${
                        label === 'Request Failures' && value > 0
                          ? 'text-red-400'
                          : 'text-white'
                      }`}
                    >
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-500">
            Click Refresh to load current token cache status for both services (HVD and
            Företagsinformation).
          </p>
        )}
      </div>
    </div>
  );
}

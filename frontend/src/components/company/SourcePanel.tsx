import type { CompanyFreshnessMetadata, CompanyCacheDecision } from '@/lib/api';

interface SourcePanelProps {
  data: CompanyFreshnessMetadata | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}

function CacheDecisionBadge({ decision }: { decision: CompanyCacheDecision }) {
  const style =
    decision === 'fetched_from_provider'
      ? 'bg-blue-900/50 text-blue-300'
      : decision === 'served_stale'
        ? 'bg-amber-900/50 text-amber-300'
        : decision === 'served_from_cache'
          ? 'bg-emerald-900/50 text-emerald-300'
          : 'bg-slate-800 text-slate-300';

  const label =
    decision === 'fetched_from_provider'
      ? 'Fetched from provider'
      : decision === 'served_stale'
        ? 'Served stale'
        : decision === 'served_from_cache'
          ? 'Served from cache'
          : 'Unknown';

  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${style}`}>{label}</span>;
}

export function SourcePanel({ data, loading, error, onRetry }: SourcePanelProps) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-slate-400">Source</h2>
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-4 w-3/4 animate-pulse rounded bg-slate-800" />
          ))}
        </div>
      ) : error ? (
        <div className="space-y-3 text-sm text-red-300">
          <p>{error}</p>
          <button
            onClick={onRetry}
            className="rounded-lg bg-red-700/40 px-3 py-1.5 text-xs text-red-100 transition hover:bg-red-700/60"
          >
            Retry
          </button>
        </div>
      ) : !data || !data.has_data ? (
        <p className="text-sm text-slate-400">Source data is not available yet.</p>
      ) : (
        <dl className="space-y-3 text-sm text-slate-300">
          <div className="flex items-center justify-between gap-4">
            <dt className="text-slate-500">Provider</dt>
            <dd className="text-right text-white capitalize">{data.provider_name ?? '—'}</dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-slate-500">Endpoint used</dt>
            <dd className="text-right font-mono text-xs text-slate-200">{data.endpoint_used ?? '—'}</dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-slate-500">Cache decision</dt>
            <dd className="text-right">
              <CacheDecisionBadge decision={data.cache_decision} />
            </dd>
          </div>
        </dl>
      )}
    </div>
  );
}

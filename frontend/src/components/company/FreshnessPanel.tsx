import type { CompanyFreshnessMetadata, CompanyFreshnessStatus } from '@/lib/api';

interface FreshnessPanelProps {
  data: CompanyFreshnessMetadata | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}

function formatTimestamp(value?: string | null): string {
  if (!value) return '—';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
}

function FreshnessStatusBadge({ status }: { status: CompanyFreshnessStatus }) {
  const style =
    status === 'fresh'
      ? 'bg-emerald-900/50 text-emerald-300'
      : status === 'degraded'
        ? 'bg-amber-900/50 text-amber-300'
        : 'bg-yellow-900/50 text-yellow-300';

  const label = status === 'fresh' ? 'Fresh' : status === 'degraded' ? 'Degraded' : 'Stale';

  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${style}`}>{label}</span>;
}

export function FreshnessPanel({ data, loading, error, onRetry }: FreshnessPanelProps) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-slate-400">Freshness</h2>
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
        <p className="text-sm text-slate-400">Freshness data is not available yet.</p>
      ) : (
        <dl className="space-y-3 text-sm text-slate-300">
          <div className="flex items-center justify-between gap-4">
            <dt className="text-slate-500">Last fetched</dt>
            <dd className="text-right text-white">{formatTimestamp(data.last_fetched_timestamp)}</dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-slate-500">Freshness status</dt>
            <dd className="text-right">
              <FreshnessStatusBadge status={data.freshness_status} />
            </dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-slate-500">Next refresh</dt>
            <dd className="text-right text-white">{formatTimestamp(data.next_refresh_time)}</dd>
          </div>
          {(data.freshness_status === 'stale' || data.freshness_status === 'degraded') && (
            <p className="rounded-lg bg-slate-900/60 px-3 py-2 text-xs text-slate-400">
              {data.freshness_status === 'degraded'
                ? 'Provider was unavailable; serving the latest cached snapshot.'
                : 'Data is older than the freshness window. Refresh recommended.'}
            </p>
          )}
        </dl>
      )}
    </div>
  );
}

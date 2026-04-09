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
        ? 'bg-amber-100 text-amber-700'
        : 'bg-yellow-100 text-yellow-700';

  const label = status === 'fresh' ? 'Fresh' : status === 'degraded' ? 'Degraded' : 'Stale';

  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${style}`}>{label}</span>;
}

export function FreshnessPanel({ data, loading, error, onRetry }: FreshnessPanelProps) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-muted-foreground">Freshness</h2>
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-4 w-3/4 animate-pulse rounded bg-muted" />
          ))}
        </div>
      ) : error ? (
        <div className="space-y-3 text-sm text-red-700">
          <p>{error}</p>
          <button
            onClick={onRetry}
            className="rounded-lg bg-red-100 px-3 py-1.5 text-xs text-red-700 transition hover:bg-red-200"
          >
            Retry
          </button>
        </div>
      ) : !data || !data.has_data ? (
        <p className="text-sm text-muted-foreground">Freshness data is not available yet.</p>
      ) : (
        <dl className="space-y-3 text-sm text-muted-foreground">
          <div className="flex items-center justify-between gap-4">
            <dt>Last fetched</dt>
            <dd className="text-right text-foreground">{formatTimestamp(data.last_fetched_timestamp)}</dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-slate-500">Freshness status</dt>
            <dd className="text-right">
              <FreshnessStatusBadge status={data.freshness_status} />
            </dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt>Next refresh</dt>
            <dd className="text-right text-foreground">{formatTimestamp(data.next_refresh_time)}</dd>
          </div>
          {(data.freshness_status === 'stale' || data.freshness_status === 'degraded') && (
            <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
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

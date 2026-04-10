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
      ? 'bg-emerald-50 text-emerald-800 ring-1 ring-inset ring-emerald-100'
      : status === 'degraded'
        ? 'bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-100'
        : 'bg-yellow-50 text-yellow-800 ring-1 ring-inset ring-yellow-100';

  const label = status === 'fresh' ? 'Fresh' : status === 'degraded' ? 'Degraded' : 'Stale';

  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${style}`}>{label}</span>;
}

export function FreshnessPanel({ data, loading, error, onRetry }: FreshnessPanelProps) {
  return (
    <div className="panel p-6 md:p-8">
      <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Freshness</h3>
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-4 w-3/4 animate-pulse rounded-md bg-muted" />
          ))}
        </div>
      ) : error ? (
        <div className="space-y-3">
          <div className="alert-error">{error}</div>
          <button
            onClick={onRetry}
            className="secondary-btn !min-h-9 px-4 text-xs"
            type="button"
          >
            Retry
          </button>
        </div>
      ) : !data || !data.has_data ? (
        <p className="text-sm text-muted-foreground">Freshness data is not available yet.</p>
      ) : (
        <dl className="space-y-3 text-sm">
          <div className="flex items-center justify-between gap-4">
            <dt className="text-muted-foreground">Last fetched</dt>
            <dd className="text-right font-medium text-foreground">{formatTimestamp(data.last_fetched_timestamp)}</dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-muted-foreground">Freshness status</dt>
            <dd className="text-right">
              <FreshnessStatusBadge status={data.freshness_status} />
            </dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-muted-foreground">Next refresh</dt>
            <dd className="text-right font-medium text-foreground">{formatTimestamp(data.next_refresh_time)}</dd>
          </div>
          {(data.freshness_status === 'stale' || data.freshness_status === 'degraded') && (
            <p className="rounded-xl border border-border bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
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

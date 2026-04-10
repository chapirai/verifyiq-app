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
      ? 'bg-blue-50 text-blue-900 ring-blue-100'
      : decision === 'served_stale'
        ? 'bg-amber-50 text-amber-900 ring-amber-100'
        : decision === 'served_from_cache'
          ? 'bg-emerald-50 text-emerald-900 ring-emerald-100'
          : 'bg-muted text-foreground ring-border';

  const label =
    decision === 'fetched_from_provider'
      ? 'Fetched from provider'
      : decision === 'served_stale'
        ? 'Served stale'
        : decision === 'served_from_cache'
          ? 'Served from cache'
          : 'Unknown';

  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${style}`}>
      {label}
    </span>
  );
}

export function SourcePanel({ data, loading, error, onRetry }: SourcePanelProps) {
  return (
    <div className="panel p-6 md:p-8">
      <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Source</h3>
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-4 w-3/4 animate-pulse rounded-md bg-muted" />
          ))}
        </div>
      ) : error ? (
        <div className="space-y-3">
          <div className="alert-error">{error}</div>
          <button className="secondary-btn !min-h-9 px-4 text-xs" onClick={onRetry} type="button">
            Retry
          </button>
        </div>
      ) : !data || !data.has_data ? (
        <p className="text-sm text-muted-foreground">Source data is not available yet.</p>
      ) : (
        <dl className="space-y-3 text-sm">
          <div className="flex items-center justify-between gap-4">
            <dt className="text-muted-foreground">Provider</dt>
            <dd className="text-right font-medium text-foreground">{data.provider_name ?? '—'}</dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-muted-foreground">Endpoint used</dt>
            <dd className="text-right font-mono text-xs text-foreground">{data.endpoint_used ?? '—'}</dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-muted-foreground">Cache decision</dt>
            <dd className="text-right">
              <CacheDecisionBadge decision={data.cache_decision} />
            </dd>
          </div>
        </dl>
      )}
    </div>
  );
}

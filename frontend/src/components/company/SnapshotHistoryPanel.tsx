import { Fragment, useState } from 'react';
import type { CompanySnapshotHistoryItem } from '@/lib/api';

interface SnapshotHistoryPanelProps {
  snapshots: CompanySnapshotHistoryItem[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  pageSize: number;
  onPageSizeChange: (next: number) => void;
  canViewSensitive: boolean;
}

function StatusBadge({ status }: { status: string }) {
  const style =
    status === 'success'
      ? 'bg-emerald-50 text-emerald-800 ring-emerald-100'
      : status === 'error'
        ? 'bg-red-50 text-red-800 ring-red-100'
        : 'bg-yellow-50 text-yellow-800 ring-yellow-100';
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${style}`}>{status}</span>
  );
}

function TriggerBadge({ trigger }: { trigger: string }) {
  const style =
    trigger === 'FORCE_REFRESH'
      ? 'bg-violet-50 text-violet-800 ring-violet-100'
      : trigger === 'STALE_FALLBACK'
        ? 'bg-amber-50 text-amber-800 ring-amber-100'
        : trigger === 'CACHE_HIT'
          ? 'bg-emerald-50 text-emerald-800 ring-emerald-100'
          : 'bg-blue-50 text-blue-800 ring-blue-100';
  const label = trigger.replace(/_/g, ' ').toLowerCase();
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${style}`}>{label}</span>
  );
}

export function SnapshotHistoryPanel({
  snapshots,
  loading,
  error,
  onRetry,
  pageSize,
  onPageSizeChange,
  canViewSensitive,
}: SnapshotHistoryPanelProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="panel p-6 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Snapshot history</h3>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Show</span>
          {[10, 20].map((size) => (
            <button
              key={size}
              type="button"
              onClick={() => onPageSizeChange(size)}
              className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                pageSize === size
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'
              }`}
            >
              {size}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="mt-4 space-y-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-4 w-full animate-pulse rounded-md bg-muted" />
          ))}
        </div>
      ) : error ? (
        <div className="mt-4 space-y-3">
          <div className="alert-error">{error}</div>
          <button className="secondary-btn !min-h-9 px-4 text-xs" onClick={onRetry} type="button">
            Retry
          </button>
        </div>
      ) : snapshots.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">No snapshots recorded yet.</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <th className="pb-3 pr-4">Timestamp</th>
                <th className="pb-3 pr-4">Status</th>
                <th className="pb-3 pr-4">Trigger</th>
                <th className="pb-3 pr-4">Source</th>
                <th className="pb-3 pr-4">API calls</th>
                <th className="pb-3">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {snapshots.map((snapshot) => {
                const expanded = expandedId === snapshot.id;
                return (
                  <Fragment key={snapshot.id}>
                    <tr className="hover:bg-muted/30">
                      <td className="py-3 pr-4 text-foreground">
                        {new Date(snapshot.fetched_at).toLocaleString()}
                      </td>
                      <td className="py-3 pr-4">
                        <StatusBadge status={snapshot.fetch_status} />
                      </td>
                      <td className="py-3 pr-4">
                        <TriggerBadge trigger={snapshot.trigger_type} />
                      </td>
                      <td className="py-3 pr-4 text-muted-foreground">
                        {snapshot.is_from_cache ? 'cache' : 'provider'}
                      </td>
                      <td className="py-3 pr-4 text-muted-foreground">{snapshot.api_call_count}</td>
                      <td className="py-3">
                        <button
                          type="button"
                          onClick={() => setExpandedId(expanded ? null : snapshot.id)}
                          className="text-xs font-semibold text-primary hover:underline"
                        >
                          {expanded ? 'Hide' : 'View'}
                        </button>
                      </td>
                    </tr>
                    {expanded && (
                      <tr className="bg-muted/40">
                        <td colSpan={6} className="px-4 py-4 text-xs">
                          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            <div>
                              <span className="font-semibold uppercase tracking-wide text-muted-foreground">Policy</span>
                              <div className="mt-1 text-foreground">{snapshot.policy_decision}</div>
                            </div>
                            <div>
                              <span className="font-semibold uppercase tracking-wide text-muted-foreground">Version</span>
                              <div className="mt-1 text-foreground">v{snapshot.version_number}</div>
                            </div>
                            <div>
                              <span className="font-semibold uppercase tracking-wide text-muted-foreground">Source</span>
                              <div className="mt-1 text-foreground">{snapshot.source_name}</div>
                            </div>
                            {canViewSensitive && (
                              <>
                                <div>
                                  <span className="font-semibold uppercase tracking-wide text-muted-foreground">
                                    Snapshot ID
                                  </span>
                                  <div className="mt-1 font-mono text-foreground">{snapshot.id}</div>
                                </div>
                                <div>
                                  <span className="font-semibold uppercase tracking-wide text-muted-foreground">
                                    Correlation ID
                                  </span>
                                  <div className="mt-1 font-mono text-foreground">
                                    {snapshot.correlation_id ?? '—'}
                                  </div>
                                </div>
                                <div>
                                  <span className="font-semibold uppercase tracking-wide text-muted-foreground">
                                    Stale fallback
                                  </span>
                                  <div className="mt-1 text-foreground">
                                    {snapshot.is_stale_fallback ? 'Yes' : 'No'}
                                  </div>
                                </div>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

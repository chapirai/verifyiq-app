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
      ? 'bg-emerald-900/50 text-emerald-300'
      : status === 'error'
        ? 'bg-red-900/50 text-red-300'
        : 'bg-yellow-900/50 text-yellow-300';
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${style}`}>{status}</span>;
}

function TriggerBadge({ trigger }: { trigger: string }) {
  const style =
    trigger === 'FORCE_REFRESH'
      ? 'bg-purple-900/50 text-purple-300'
      : trigger === 'STALE_FALLBACK'
        ? 'bg-amber-900/50 text-amber-300'
        : trigger === 'CACHE_HIT'
          ? 'bg-emerald-900/50 text-emerald-300'
          : 'bg-blue-900/50 text-blue-300';
  const label = trigger.replace(/_/g, ' ').toLowerCase();
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${style}`}>{label}</span>;
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
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-400">
          Snapshot History
        </h2>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span>Show</span>
          {[10, 20].map((size) => (
            <button
              key={size}
              onClick={() => onPageSizeChange(size)}
              className={`rounded-full px-2 py-1 text-xs ${
                pageSize === size ? 'bg-slate-700 text-white' : 'bg-slate-900/60 text-slate-400'
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
            <div key={index} className="h-4 w-full animate-pulse rounded bg-slate-800" />
          ))}
        </div>
      ) : error ? (
        <div className="mt-4 space-y-3 text-sm text-red-300">
          <p>{error}</p>
          <button
            onClick={onRetry}
            className="rounded-lg bg-red-700/40 px-3 py-1.5 text-xs text-red-100 transition hover:bg-red-700/60"
          >
            Retry
          </button>
        </div>
      ) : snapshots.length === 0 ? (
        <p className="mt-4 text-sm text-slate-400">No snapshots recorded yet.</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-widest text-slate-500">
                <th className="pb-2 pr-4">Timestamp</th>
                <th className="pb-2 pr-4">Status</th>
                <th className="pb-2 pr-4">Trigger</th>
                <th className="pb-2 pr-4">Source</th>
                <th className="pb-2 pr-4">API Calls</th>
                <th className="pb-2">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {snapshots.map((snapshot) => {
                const expanded = expandedId === snapshot.id;
                return (
                  <Fragment key={snapshot.id}>
                    <tr>
                      <td className="py-2 pr-4 text-slate-300">
                        {new Date(snapshot.fetched_at).toLocaleString()}
                      </td>
                      <td className="py-2 pr-4">
                        <StatusBadge status={snapshot.fetch_status} />
                      </td>
                      <td className="py-2 pr-4">
                        <TriggerBadge trigger={snapshot.trigger_type} />
                      </td>
                      <td className="py-2 pr-4 text-slate-400">
                        {snapshot.is_from_cache ? 'cache' : 'provider'}
                      </td>
                      <td className="py-2 pr-4 text-slate-400">{snapshot.api_call_count}</td>
                      <td className="py-2">
                        <button
                          onClick={() => setExpandedId(expanded ? null : snapshot.id)}
                          className="text-xs text-slate-300 transition hover:text-white"
                        >
                          {expanded ? 'Hide' : 'View'}
                        </button>
                      </td>
                    </tr>
                    {expanded && (
                      <tr className="bg-slate-900/40">
                        <td colSpan={6} className="px-4 py-3 text-xs text-slate-400">
                          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            <div>
                              <span className="uppercase tracking-wide text-slate-500">Policy</span>
                              <div className="text-slate-200">{snapshot.policy_decision}</div>
                            </div>
                            <div>
                              <span className="uppercase tracking-wide text-slate-500">Version</span>
                              <div className="text-slate-200">v{snapshot.version_number}</div>
                            </div>
                            <div>
                              <span className="uppercase tracking-wide text-slate-500">Source</span>
                              <div className="text-slate-200">{snapshot.source_name}</div>
                            </div>
                            {canViewSensitive && (
                              <>
                                <div>
                                  <span className="uppercase tracking-wide text-slate-500">Snapshot ID</span>
                                  <div className="text-slate-200">{snapshot.id}</div>
                                </div>
                                <div>
                                  <span className="uppercase tracking-wide text-slate-500">Correlation ID</span>
                                  <div className="text-slate-200">
                                    {snapshot.correlation_id ?? '—'}
                                  </div>
                                </div>
                                <div>
                                  <span className="uppercase tracking-wide text-slate-500">Stale fallback</span>
                                  <div className="text-slate-200">
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

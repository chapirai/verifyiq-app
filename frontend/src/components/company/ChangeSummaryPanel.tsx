import type { CompanyChangeEvent } from '@/lib/api';

interface ChangeSummaryPanelProps {
  events: CompanyChangeEvent[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  canViewSensitive: boolean;
}

function formatChangeValue(value: string | null, allowDetails: boolean): string {
  if (!value) return '—';
  if (!allowDetails) return 'Hidden';
  try {
    const parsed = JSON.parse(value);
    if (parsed === null || parsed === undefined) return '—';
    if (typeof parsed === 'string') return truncate(parsed);
    if (typeof parsed === 'number' || typeof parsed === 'boolean') return String(parsed);
    return 'Complex value';
  } catch {
    return truncate(value);
  }
}

function truncate(value: string, limit = 48): string {
  if (value.length <= limit) return value;
  return `${value.slice(0, limit)}…`;
}

export function ChangeSummaryPanel({
  events,
  loading,
  error,
  onRetry,
  canViewSensitive,
}: ChangeSummaryPanelProps) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-slate-400">
        Latest Changes
      </h2>

      {!canViewSensitive ? (
        <p className="text-sm text-slate-400">
          Change details are restricted to admin and audit roles.
        </p>
      ) : loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-4 w-full animate-pulse rounded bg-slate-800" />
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
      ) : events.length === 0 ? (
        <p className="text-sm text-slate-400">No recent changes recorded.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-widest text-slate-500">
                <th className="pb-2 pr-4">Attribute</th>
                <th className="pb-2 pr-4">Previous</th>
                <th className="pb-2 pr-4">Current</th>
                <th className="pb-2">Changed At</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {events.map((event) => (
                <tr key={event.id}>
                  <td className="py-2 pr-4 text-slate-200">{event.attributeName}</td>
                  <td className="py-2 pr-4 text-slate-400">
                    {formatChangeValue(event.oldValue ?? null, canViewSensitive)}
                  </td>
                  <td className="py-2 pr-4 text-slate-400">
                    {formatChangeValue(event.newValue ?? null, canViewSensitive)}
                  </td>
                  <td className="py-2 text-slate-400">
                    {new Date(event.createdAt).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

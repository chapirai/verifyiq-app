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
    <div className="panel p-6 md:p-8">
      <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Latest changes
      </h3>

      {!canViewSensitive ? (
        <p className="text-sm text-muted-foreground">
          Change details are restricted to admin and audit roles.
        </p>
      ) : loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-4 w-full animate-pulse rounded-md bg-muted" />
          ))}
        </div>
      ) : error ? (
        <div className="space-y-3">
          <div className="alert-error">{error}</div>
          <button className="secondary-btn !min-h-9 px-4 text-xs" onClick={onRetry} type="button">
            Retry
          </button>
        </div>
      ) : events.length === 0 ? (
        <p className="text-sm text-muted-foreground">No recent changes recorded.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <th className="pb-3 pr-4">Attribute</th>
                <th className="pb-3 pr-4">Previous</th>
                <th className="pb-3 pr-4">Current</th>
                <th className="pb-3">Changed at</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {events.map((event) => (
                <tr key={event.id} className="hover:bg-muted/30">
                  <td className="py-3 pr-4 font-medium text-foreground">{event.attributeName}</td>
                  <td className="py-3 pr-4 text-muted-foreground">
                    {formatChangeValue(event.oldValue ?? null, canViewSensitive)}
                  </td>
                  <td className="py-3 pr-4 text-muted-foreground">
                    {formatChangeValue(event.newValue ?? null, canViewSensitive)}
                  </td>
                  <td className="py-3 text-muted-foreground">{new Date(event.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

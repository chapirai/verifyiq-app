import type { LookupSource } from '@/lib/api';

interface DataSourceBadgeProps {
  source: LookupSource;
  degraded?: boolean;
  failureState?: string | null;
}

export function DataSourceBadge({ source, degraded = false, failureState }: DataSourceBadgeProps) {
  const isDB = source === 'DB';
  const isDegraded = degraded;
  const title = isDegraded
    ? `Stale data served due to provider outage${failureState ? ` (${failureState})` : ''}`
    : isDB
      ? 'Data served from database cache'
      : 'Data fetched live from external API';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
        isDegraded
          ? 'bg-amber-900/50 text-amber-300'
          : isDB
            ? 'bg-emerald-900/50 text-emerald-300'
            : 'bg-blue-900/50 text-blue-300'
      }`}
      title={title}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          isDegraded ? 'bg-amber-400' : isDB ? 'bg-emerald-400' : 'bg-blue-400'
        }`}
      />
      {isDegraded ? 'Stale Cache' : isDB ? 'DB Cache' : 'Live API'}
    </span>
  );
}

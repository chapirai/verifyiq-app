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
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset ${
        isDegraded
          ? 'bg-amber-50 text-amber-900 ring-amber-100'
          : isDB
            ? 'bg-emerald-50 text-emerald-900 ring-emerald-100'
            : 'bg-blue-50 text-blue-900 ring-blue-100'
      }`}
      title={title}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          isDegraded ? 'bg-amber-500' : isDB ? 'bg-emerald-500' : 'bg-primary'
        }`}
      />
      {isDegraded ? 'Stale cache' : isDB ? 'DB cache' : 'Live API'}
    </span>
  );
}

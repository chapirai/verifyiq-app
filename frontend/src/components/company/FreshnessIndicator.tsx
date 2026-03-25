function formatRelativeTime(isoTimestamp: string): string {
  const fetched = new Date(isoTimestamp);
  const now = new Date();
  const diffMs = now.getTime() - fetched.getTime();

  const seconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return 'just now';
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;

  return fetched.toLocaleDateString();
}

interface FreshnessIndicatorProps {
  fetchedAt: string;
  ageDays: number;
  freshness: 'fresh' | 'stale' | 'expired';
}

export function FreshnessIndicator({ fetchedAt, ageDays, freshness }: FreshnessIndicatorProps) {
  const relativeTime = formatRelativeTime(fetchedAt);
  const absoluteTime = new Date(fetchedAt).toLocaleString();

  const freshnessClasses =
    freshness === 'fresh'
      ? 'text-emerald-400'
      : freshness === 'stale'
        ? 'text-yellow-400'
        : 'text-red-400';

  const freshnessLabel =
    freshness === 'fresh' ? 'Fresh' : freshness === 'stale' ? 'Stale' : 'Expired';

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
      <span>
        Last fetched:{' '}
        <span className="text-slate-300" title={absoluteTime}>
          {relativeTime}
        </span>
      </span>
      <span className="text-slate-600">·</span>
      <span>
        Age:{' '}
        <span className="text-slate-300">
          {ageDays} day{ageDays === 1 ? '' : 's'}
        </span>
      </span>
      <span className="text-slate-600">·</span>
      <span>
        Cache status:{' '}
        <span className={freshnessClasses}>{freshnessLabel}</span>
      </span>
    </div>
  );
}

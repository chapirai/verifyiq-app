import type { LookupSource } from '@/lib/api';

interface DataSourceBadgeProps {
  source: LookupSource;
}

export function DataSourceBadge({ source }: DataSourceBadgeProps) {
  const isDB = source === 'DB';
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
        isDB
          ? 'bg-emerald-900/50 text-emerald-300'
          : 'bg-blue-900/50 text-blue-300'
      }`}
      title={isDB ? 'Data served from database cache' : 'Data fetched live from external API'}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${isDB ? 'bg-emerald-400' : 'bg-blue-400'}`}
      />
      {isDB ? 'DB Cache' : 'Live API'}
    </span>
  );
}

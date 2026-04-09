interface StatusBadgeProps {
  status?: string | null;
}

function StatusBadge({ status }: StatusBadgeProps) {
  if (!status) return <span className="text-muted-foreground">—</span>;

  const lower = status.toLowerCase();
  const classes =
    lower === 'active'
      ? 'bg-emerald-900/50 text-emerald-300'
      : lower === 'inactive' || lower === 'liquidation' || lower === 'dissolved'
        ? 'bg-red-100 text-red-700'
        : 'bg-amber-100 text-amber-700';

  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${classes}`}>
      {status}
    </span>
  );
}

interface CompanyHeaderProps {
  legalName?: string | null;
  orgNumber?: string | null;
  status?: string | null;
  countryCode?: string | null;
}

export function CompanyHeader({ legalName, orgNumber, status, countryCode }: CompanyHeaderProps) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="flex items-start gap-4">
        {/* Logo placeholder */}
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-border bg-muted text-2xl font-bold text-muted-foreground">
          {legalName ? legalName.charAt(0).toUpperCase() : '?'}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-semibold text-foreground">
            {legalName ?? 'Unknown Company'}
          </h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            {orgNumber && <span>{orgNumber}</span>}
            {countryCode && (
              <>
                <span>·</span>
                <span>{countryCode}</span>
              </>
            )}
            {status && (
              <>
                <span>·</span>
                <StatusBadge status={status} />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

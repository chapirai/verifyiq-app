interface StatusBadgeProps {
  status?: string | null;
}

function StatusBadge({ status }: StatusBadgeProps) {
  if (!status) return <span className="text-muted-foreground">—</span>;

  const lower = status.toLowerCase();
  const classes =
    lower === 'active'
      ? 'bg-emerald-50 text-emerald-800 ring-1 ring-inset ring-emerald-100'
      : lower === 'inactive' || lower === 'liquidation' || lower === 'dissolved'
        ? 'bg-red-50 text-red-800 ring-1 ring-inset ring-red-100'
        : 'bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-100';

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
    <div className="panel p-6 md:p-8">
      <div className="flex items-start gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-border bg-muted/80 text-2xl font-bold text-muted-foreground shadow-sm">
          {legalName ? legalName.charAt(0).toUpperCase() : '?'}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-2xl font-bold tracking-tight text-foreground">
            {legalName ?? 'Unknown Company'}
          </h2>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            {orgNumber && <span className="font-mono text-foreground/90">{orgNumber}</span>}
            {countryCode && (
              <>
                <span className="text-border">·</span>
                <span>{countryCode}</span>
              </>
            )}
            {status && (
              <>
                <span className="text-border">·</span>
                <StatusBadge status={status} />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

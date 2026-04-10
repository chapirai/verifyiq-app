import { ReactNode } from 'react';

interface StatCardProps {
  label: string;
  value: string | number;
  meta?: ReactNode;
}

export function StatCard({ label, value, meta }: StatCardProps) {
  return (
    <div className="panel p-6 transition-shadow duration-200 hover:shadow-soft">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-2 text-3xl font-bold tracking-tight text-foreground">{value}</p>
      {meta ? <div className="mt-2 text-sm text-muted-foreground">{meta}</div> : null}
    </div>
  );
}

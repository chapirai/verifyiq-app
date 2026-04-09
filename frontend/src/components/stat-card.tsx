import { ReactNode } from 'react';

interface StatCardProps {
  label: string;
  value: string | number;
  meta?: ReactNode;
}

export function StatCard({ label, value, meta }: StatCardProps) {
  return (
    <div className="panel p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-3 text-3xl font-semibold text-foreground">{value}</p>
      {meta ? <div className="mt-2 text-sm text-muted-foreground">{meta}</div> : null}
    </div>
  );
}

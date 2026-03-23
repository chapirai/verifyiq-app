import { ReactNode } from 'react';

interface StatCardProps {
  label: string;
  value: string | number;
  meta?: ReactNode;
}

export function StatCard({ label, value, meta }: StatCardProps) {
  return (
    <div className="panel p-5">
      <p className="text-sm text-slate-400">{label}</p>
      <p className="mt-3 text-3xl font-semibold">{value}</p>
      {meta ? <div className="mt-2 text-sm text-slate-300">{meta}</div> : null}
    </div>
  );
}

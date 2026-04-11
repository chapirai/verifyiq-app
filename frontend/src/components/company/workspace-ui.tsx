'use client';

import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/Badge';

export function SectionCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-sm border border-border-light bg-muted/30 p-4">
      <h3 className="mono-label mb-3 text-[10px] text-muted-foreground">{title}</h3>
      {children}
    </section>
  );
}

export function FieldGridPro({ rows }: { rows: { label: string; value: string }[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">Not available</p>;
  }
  return (
    <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {rows.map(({ label, value }) => (
        <div key={label} className="min-w-0 border-b border-border-light pb-2">
          <dt className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
          <dd className="mt-1 text-sm leading-snug text-foreground">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function EmptyStatePro({ title, message }: { title: string; message: string }) {
  return (
    <div className="rounded-sm border border-dashed border-border-light bg-background px-6 py-10 text-center">
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="mt-2 text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

export function StatusChip({ children }: { children: ReactNode }) {
  return <Badge>{children}</Badge>;
}

export function StatGrid({ stats }: { stats: { label: string; value: string }[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {stats.map((s) => (
        <div key={s.label} className="border-2 border-foreground bg-background p-4">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{s.label}</p>
          <p className="mt-2 font-display text-xl tabular-nums">{s.value}</p>
        </div>
      ))}
    </div>
  );
}

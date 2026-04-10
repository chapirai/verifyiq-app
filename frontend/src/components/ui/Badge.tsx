import { ReactNode } from 'react';

export function Badge({ children }: { children: ReactNode }) {
  return <span className="mono-label inline-flex border border-foreground px-2 py-1 text-[10px]">{children}</span>;
}

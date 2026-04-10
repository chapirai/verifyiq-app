import { ReactNode } from 'react';

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`border-2 border-foreground bg-background p-8 ${className}`}>{children}</div>;
}

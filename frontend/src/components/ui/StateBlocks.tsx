import { ReactNode } from 'react';

export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <div className="border-2 border-foreground bg-background p-8 text-center">
      <p className="font-display text-3xl">{title}</p>
      <p className="mt-3 text-muted-foreground">{description}</p>
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}

export function ErrorState({ title, message }: { title: string; message: string }) {
  return (
    <div className="border-2 border-foreground bg-background p-6">
      <p className="mono-label text-[10px]">Error</p>
      <p className="mt-2 font-display text-3xl">{title}</p>
      <p className="mt-3 text-muted-foreground">{message}</p>
    </div>
  );
}

export function LoadingSkeleton({ lines = 4 }: { lines?: number }) {
  return (
    <div className="space-y-3 border-2 border-foreground p-6">
      {Array.from({ length: lines }).map((_, idx) => (
        <div key={idx} className="skeleton h-4 w-full" />
      ))}
    </div>
  );
}

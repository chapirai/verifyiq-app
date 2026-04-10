import { ReactNode } from 'react';

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-2xl border border-[#E2E8F0] bg-white shadow-[0_25px_50px_-12px_rgba(15,23,42,0.08),0_12px_24px_-10px_rgba(15,23,42,0.05)] ${className}`}
    >
      {children}
    </div>
  );
}

import { ReactNode } from 'react';
import { DashboardSidebar } from '@/components/dashboard-sidebar';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen">
      <div className="mx-auto grid max-w-[1400px] gap-6 p-6 lg:grid-cols-[268px_1fr]">
        <DashboardSidebar />
        <main className="min-w-0 pb-10">{children}</main>
      </div>
    </div>
  );
}

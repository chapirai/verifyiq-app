import Link from 'next/link';
import { SectionHeader } from '@/components/section-header';
import { StatCard } from '@/components/stat-card';

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow="Overview"
        title="Operational dashboard"
        description="Track onboarding, screening, monitoring, and billing activity from one place."
      />
      <section className="grid gap-4 md:grid-cols-3">
        <StatCard label="Open cases" value="14" />
        <StatCard label="Active monitoring alerts" value="5" />
        <StatCard
          label="Current plan"
          value="Growth"
          meta={
            <Link className="font-medium text-primary hover:underline" href="/billing">
              Manage in Billing
            </Link>
          }
        />
      </section>
    </div>
  );
}

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
      <section className="panel p-6 md:p-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold tracking-tight text-foreground">Recent activity</h2>
          <Link className="secondary-btn !min-h-9 px-3 text-xs" href="/company-cases">
            View all
          </Link>
        </div>
        <div className="space-y-2">
          {[
            'Case CAS-9001 moved to in review',
            'New API key created for Production backend',
            'Bulk job JOB-104 completed with 96% success',
          ].map((item) => (
            <div key={item} className="interactive-row px-4 py-3 text-sm text-foreground">
              {item}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

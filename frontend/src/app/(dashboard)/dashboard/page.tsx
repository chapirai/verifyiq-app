import { SectionHeader } from '@/components/section-header';

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Overview"
        title="Operational dashboard"
        description="Track onboarding, screening, monitoring, and billing activity from one place."
      />
      <section className="grid gap-4 md:grid-cols-3">
        {[
          ['Open cases', '14'],
          ['Active monitoring alerts', '5'],
          ['Current plan', 'Growth'],
        ].map(([label, value]) => (
          <article key={label} className="panel p-6">
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="mt-2 text-3xl font-semibold">{value}</p>
          </article>
        ))}
      </section>
    </div>
  );
}

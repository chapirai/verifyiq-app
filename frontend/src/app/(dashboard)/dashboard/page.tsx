import { SectionHeader } from '@/components/section-header';
import { StatCard } from '@/components/stat-card';

const datasetCards = [
  ['Ownership pulls', '0'],
  ['Sanctions/PEP checks', '0'],
  ['Company documents', '0'],
  ['Credit decisions', '0'],
];

const cards = [
  ['Active onboarding cases', '12'],
  ['Unreviewed screening matches', '4'],
  ['Monitoring alerts', '9'],
  ['Webhook deliveries today', '128'],
];

export default function DashboardPage() {
  return (
    <section className="space-y-8">
      <SectionHeader
        eyebrow="Operations"
        title="Compliance dashboard"
        description="Structured monitoring and operational metrics for KYC, screening, and integration workflows."
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map(([label, value]) => (
          <StatCard key={label} label={label} value={value} />
        ))}
      </div>
      <div className="panel p-6">
        <h2 className="text-xl font-semibold">Today&apos;s focus</h2>
        <p className="mt-3 max-w-3xl text-muted-foreground">Review onboarding exceptions, clear screening queue, and inspect webhook failures before end of day.</p>
      </div>
      <div>
        <h2 className="text-xl font-semibold mb-4">Dataset Usage (This Month)</h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {datasetCards.map(([label, value]) => (
            <StatCard key={label} label={label} value={value} />
          ))}
        </div>
      </div>
    </section>
  );
}

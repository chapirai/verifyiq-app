import Link from 'next/link';

const tiers = [
  { code: 'starter', name: 'Starter', price: '€99/mo', desc: 'Core search and onboarding workflows.' },
  { code: 'growth', name: 'Growth', price: '€299/mo', desc: 'Adds monitoring, bulk jobs, and API access.' },
  { code: 'enterprise', name: 'Enterprise', price: 'Custom', desc: 'Advanced controls and enterprise support.' },
];

export default function PricingPage() {
  return (
    <main className="min-h-screen px-6 py-16">
      <section className="mx-auto max-w-6xl space-y-12">
        <div className="space-y-4 text-center">
          <div className="section-badge">
            <span className="section-badge-dot" />
            <span className="section-badge-text">Pricing</span>
          </div>
          <h1 className="text-5xl" style={{ fontFamily: 'var(--font-calistoga), Georgia, serif' }}>
            Plans that scale with <span className="gradient-text">trust</span>
          </h1>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {tiers.map((tier, index) => (
            <article key={tier.code} className={`panel p-6 ${index === 1 ? 'border-accent shadow-accent' : ''}`}>
              <h2 className="text-xl font-semibold">{tier.name}</h2>
              <p className="mt-2 text-3xl font-semibold">{tier.price}</p>
              <p className="mt-3 text-sm text-muted-foreground">{tier.desc}</p>
              <Link className="primary-btn mt-6 inline-flex w-full items-center justify-center" href="/signup">
                Get started
              </Link>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

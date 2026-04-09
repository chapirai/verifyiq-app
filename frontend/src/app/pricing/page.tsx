import Link from 'next/link';

const tiers = [
  { name: 'Starter', price: '€199/mo', description: 'Small teams and initial API usage.' },
  { name: 'Growth', price: '€699/mo', description: 'Scaling teams with higher usage limits.' },
  { name: 'Enterprise', price: 'Custom', description: 'Advanced controls, SSO, and contract billing.' },
];

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="section-badge">
          <span className="section-badge-dot" />
          <span className="section-badge-text">Pricing</span>
        </div>
        <h1 className="mt-4 text-5xl" style={{ fontFamily: 'var(--font-calistoga), Georgia, serif' }}>
          Plans for <span className="gradient-text">compliance and platform teams</span>
        </h1>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {tiers.map((tier) => (
            <article key={tier.name} className="panel p-6">
              <h2 className="text-xl font-semibold">{tier.name}</h2>
              <p className="mt-2 text-3xl">{tier.price}</p>
              <p className="mt-3 text-sm text-muted-foreground">{tier.description}</p>
            </article>
          ))}
        </div>
        <div className="mt-8">
          <Link href="/signup" className="primary-btn">
            Start free onboarding
          </Link>
        </div>
      </section>
    </main>
  );
}

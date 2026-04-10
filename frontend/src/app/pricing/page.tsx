import Link from 'next/link';
import { MarketingNav } from '@/components/marketing-nav';

const tiers = [
  { code: 'starter', name: 'Starter', price: '€99/mo', desc: 'Core search and onboarding workflows.' },
  { code: 'growth', name: 'Growth', price: '€299/mo', desc: 'Adds monitoring, bulk jobs, and API access.', featured: true },
  { code: 'enterprise', name: 'Enterprise', price: 'Custom', desc: 'Advanced controls and enterprise support.' },
];

export default function PricingPage() {
  return (
    <div className="min-h-screen">
      <MarketingNav />
      <main className="px-6 pb-24 pt-6 md:px-10">
        <section className="mx-auto max-w-6xl space-y-14">
          <div className="space-y-4 text-center">
            <div className="section-badge mx-auto w-fit">
              <span className="section-badge-dot" />
              <span className="section-badge-text">Pricing</span>
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-foreground md:text-5xl">
              Simple, transparent <span className="gradient-text">pricing</span>
            </h1>
            <p className="mx-auto max-w-2xl text-muted-foreground">
              Choose the plan that fits your team. All plans include a path to scale with Nordic Company Data.
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {tiers.map((tier) => (
              <article
                key={tier.code}
                className={`panel flex flex-col p-8 ${
                  tier.featured
                    ? 'ring-2 ring-primary/25 shadow-primary md:-translate-y-1'
                    : ''
                }`}
              >
                {tier.featured ? (
                  <span className="mb-3 w-fit rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                    Most popular
                  </span>
                ) : null}
                <h2 className="text-xl font-semibold text-foreground">{tier.name}</h2>
                <p className="mt-3 text-3xl font-bold text-foreground">{tier.price}</p>
                <p className="mt-3 flex-1 text-sm leading-relaxed text-muted-foreground">{tier.desc}</p>
                <Link className="primary-btn mt-8 w-full" href="/signup">
                  Start free trial
                </Link>
              </article>
            ))}
          </div>
          <p className="text-center text-sm text-muted-foreground">
            14-day trial on paid tiers where applicable. Enterprise pricing on request.
          </p>
        </section>
      </main>
    </div>
  );
}

import { Button } from '@/components/ui/Button';
import { Container } from '@/components/ui/Container';

const plans = [
  {
    name: 'Starter',
    price: 'SEK 990',
    period: '/month',
    intent: 'self-serve',
    bullets: [
      'For analysts and small teams',
      'Company lookup, ownership, and financial context',
      'Decision notes and export-ready snapshots',
    ],
    cta: 'Start self-serve',
  },
  {
    name: 'Growth',
    price: 'SEK 4 900',
    period: '/month',
    intent: 'api',
    bullets: [
      'For risk and compliance operations',
      'Monitoring, alerts, and team workflows',
      'API access for internal systems',
    ],
    cta: 'Choose Growth',
    featured: true,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    intent: 'enterprise',
    bullets: [
      'For regulated and large-scale environments',
      'Bulk access, custom onboarding, and controls',
      'Commercial and security alignment',
    ],
    cta: 'Talk to sales',
  },
];

export function Pricing() {
  return (
    <section id="pricing" className="site-divider py-24 md:py-32 lg:py-40">
      <Container>
        <p className="mono-label text-xs text-muted-foreground">Pricing</p>
        <h2 className="display-heading mt-6 text-5xl md:text-7xl">Choose the path that fits your team</h2>
        <p className="mt-4 max-w-3xl text-base leading-relaxed text-muted-foreground md:text-lg">
          Start with self-serve, scale into API workflows, or run enterprise-wide with tailored onboarding.
          Stripe checkout supports card-based subscriptions for eligible plans.
        </p>

        <div className="mt-16 grid gap-6 lg:grid-cols-3">
          {plans.map((plan) => (
            <article
              key={plan.name}
              className={`border-2 border-foreground p-8 ${plan.featured ? 'lg:-mt-8 lg:mb-[-2rem] bg-foreground text-background' : 'bg-background text-foreground'}`}
            >
              <h3 className="font-display text-4xl">{plan.name}</h3>
              <div className="mt-6 flex items-end gap-2">
                <p className="display-heading text-6xl">{plan.price}</p>
                {plan.period ? <p className="text-lg">{plan.period}</p> : null}
              </div>

              <ul className="mt-8 space-y-3">
                {plan.bullets.map((bullet) => (
                  <li key={bullet} className="border-t border-current pt-3 text-base">
                    {bullet}
                  </li>
                ))}
              </ul>

              <Button
                href={`/signup?intent=${encodeURIComponent(plan.intent)}`}
                variant={plan.featured ? 'secondary' : 'primary'}
                className={`mt-10 w-full ${plan.featured ? 'border-background text-background hover:bg-background hover:text-foreground' : ''}`}
              >
                {plan.cta}
              </Button>
            </article>
          ))}
        </div>
      </Container>
    </section>
  );
}

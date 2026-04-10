import { Button } from '@/components/ui/Button';
import { Container } from '@/components/ui/Container';

const plans = [
  {
    name: 'Starter',
    price: '$29',
    period: '/month',
    bullets: ['Up to 10 users', 'Basic verification workflow', 'Email support'],
  },
  {
    name: 'Professional',
    price: '$79',
    period: '/month',
    bullets: ['Up to 50 users', 'Monitoring + bulk operations', 'Priority support'],
    featured: true,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    bullets: ['Unlimited users', 'Custom controls', 'Dedicated support'],
  },
];

export function Pricing() {
  return (
    <section id="pricing" className="site-divider py-24 md:py-32 lg:py-40">
      <Container>
        <p className="mono-label text-xs">Pricing</p>
        <h2 className="display-heading mt-6 text-5xl md:text-7xl">Simple, transparent pricing</h2>

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
                href="#"
                variant={plan.featured ? 'secondary' : 'primary'}
                className={`mt-10 w-full ${plan.featured ? 'border-background text-background hover:bg-background hover:text-foreground' : ''}`}
              >
                Start free trial
              </Button>
            </article>
          ))}
        </div>
      </Container>
    </section>
  );
}

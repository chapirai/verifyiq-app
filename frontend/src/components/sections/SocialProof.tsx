import { Container } from '@/components/ui/Container';

const stats = [
  { label: 'Growth rate', value: '+127%' },
  { label: 'Active Users', value: '500k+' },
  { label: 'Uptime SLA', value: '99.99%' },
  { label: 'Support Access', value: '24/7' },
];

export function SocialProof() {
  return (
    <section className="site-divider section-invert py-24 md:py-32">
      <Container className="grid gap-8 md:grid-cols-4">
        {stats.map((stat) => (
          <article key={stat.label} className="border-2 border-background bg-foreground p-6">
            <p className="display-heading text-4xl md:text-5xl">{stat.value}</p>
            <p className="mono-label mt-4 text-xs text-background/80">{stat.label}</p>
          </article>
        ))}
      </Container>
    </section>
  );
}

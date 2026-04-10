import { Container } from '@/components/ui/Container';

const features = [
  {
    title: 'Data Verification',
    description: 'Validate legal entities with structured, source-aware company intelligence.',
  },
  {
    title: 'Risk Screening',
    description: 'Run repeatable checks and route outcomes to the right review workflows.',
  },
  {
    title: 'Monitoring',
    description: 'Track status and ownership changes continuously with strict audit traceability.',
  },
  {
    title: 'Bulk Operations',
    description: 'Process large batches at speed with reliable queueing and progress visibility.',
  },
  {
    title: 'API Access',
    description: 'Integrate VerifyIQ into your systems using controlled and revocable key access.',
  },
  {
    title: 'Decision Support',
    description: 'Combine normalized signals into clear, explainable operational decisions.',
  },
];

export function Features() {
  return (
    <section id="features" className="site-divider py-24 md:py-32 lg:py-40">
      <Container>
        <p className="mono-label text-xs">Features</p>
        <h2 className="display-heading mt-6 max-w-4xl text-5xl md:text-7xl">Everything in one system</h2>

        <div className="mt-16 grid gap-0 border-2 border-foreground md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <article key={feature.title} className="feature-card border-x-0 border-y-0 border-r-2 border-b-2 last:border-r-0 md:[&:nth-child(2n)]:border-r-0 lg:[&:nth-child(2n)]:border-r-2 lg:[&:nth-child(3n)]:border-r-0">
              <h3 className="font-display text-3xl">{feature.title}</h3>
              <p className="mt-4 text-base leading-relaxed text-muted-foreground">{feature.description}</p>
            </article>
          ))}
        </div>
      </Container>
    </section>
  );
}

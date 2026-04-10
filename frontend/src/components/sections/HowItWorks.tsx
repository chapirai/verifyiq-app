import { Container } from '@/components/ui/Container';

const steps = [
  {
    number: '01',
    title: 'Connect Data Sources',
    description: 'Attach your existing systems and bring company records into one canonical flow.',
  },
  {
    number: '02',
    title: 'Configure Workflow Rules',
    description: 'Define decision paths, checks, and review criteria aligned to your operating model.',
  },
  {
    number: '03',
    title: 'Operate With Confidence',
    description: 'Run verification and monitoring at scale with consistent structure and auditability.',
  },
];

export function HowItWorks() {
  return (
    <section className="site-divider section-texture-diagonal py-24 md:py-32 lg:py-40">
      <Container>
        <p className="mono-label text-xs">How It Works</p>
        <h2 className="display-heading mt-6 text-5xl md:text-7xl">Three deliberate steps</h2>

        <div className="mt-16 grid gap-6 md:grid-cols-3">
          {steps.map((step) => (
            <article key={step.number} className="border-2 border-foreground bg-background p-8">
              <p className="font-mono text-sm tracking-widest">{step.number}</p>
              <h3 className="font-display mt-6 text-4xl">{step.title}</h3>
              <p className="mt-5 text-lg leading-relaxed text-muted-foreground">{step.description}</p>
            </article>
          ))}
        </div>
      </Container>
    </section>
  );
}

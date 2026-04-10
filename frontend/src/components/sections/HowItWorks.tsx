import { Card } from '@/components/ui/Card';
import { Container } from '@/components/ui/Container';

const steps = [
  ['1', 'Connect your data', 'Integrate with existing tools in one click.'],
  ['2', 'Configure workflows', 'Use visual workflow setup for your team process.'],
  ['3', 'Start collaborating', 'Invite your team and operate in real-time.'],
];

export function HowItWorks() {
  return (
    <section className="py-20 md:py-28">
      <Container>
        <div className="mb-10">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#0052FF]/20 bg-[#0052FF]/5 px-4 py-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-[#0052FF]" />
            <span className="text-[11px] uppercase tracking-[0.15em] text-[#0052FF]">Process</span>
          </div>
          <h2 className="text-3xl leading-[1.15] text-[#0F172A] md:text-4xl lg:text-[3.25rem]">
            How VerifyIQ works
          </h2>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          {steps.map(([n, t, d]) => (
            <Card key={n} className="p-6">
              <p className="text-4xl text-[#0052FF]">{n}</p>
              <h3 className="mt-4 text-xl font-semibold text-[#0F172A]">{t}</h3>
              <p className="mt-3 text-sm leading-relaxed text-[#64748B]">{d}</p>
            </Card>
          ))}
        </div>
      </Container>
    </section>
  );
}

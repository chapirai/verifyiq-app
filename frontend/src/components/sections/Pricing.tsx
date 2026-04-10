import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Container } from '@/components/ui/Container';

const tiers = [
  ['Starter', '$29/month', 'Perfect for small teams just getting started'],
  ['Professional', '$79/month', 'For growing teams that need more power'],
  ['Enterprise', 'Custom', 'For organizations that need advanced controls'],
];

export function Pricing() {
  return (
    <section id="pricing" className="py-20 md:py-28">
      <Container>
        <div className="mb-10">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#0052FF]/20 bg-[#0052FF]/5 px-4 py-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-[#0052FF]" />
            <span className="text-[11px] uppercase tracking-[0.15em] text-[#0052FF]">Pricing</span>
          </div>
          <h2 className="text-3xl leading-[1.15] text-[#0F172A] md:text-4xl lg:text-[3.25rem]">
            Simple, transparent pricing
          </h2>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {tiers.map(([name, price, desc], i) => (
            <Card key={name} className={`p-8 ${i === 1 ? 'ring-2 ring-[#0052FF]/25' : ''}`}>
              <h3 className="text-xl font-semibold text-[#0F172A]">{name}</h3>
              <p className="mt-3 text-3xl font-semibold text-[#0F172A]">{price}</p>
              <p className="mt-3 text-sm text-[#64748B]">{desc}</p>
              <Button href="#pricing" className="mt-8 w-full">
                Start free trial
              </Button>
            </Card>
          ))}
        </div>
      </Container>
    </section>
  );
}

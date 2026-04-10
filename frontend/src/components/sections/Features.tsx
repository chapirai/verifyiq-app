import { Card } from '@/components/ui/Card';
import { Container } from '@/components/ui/Container';

const features = [
  'Real-time Collaboration',
  'Smart Automation',
  'Advanced Analytics',
  'Seamless Integrations',
  'Enterprise Security',
  '24/7 Support',
];

export function Features() {
  return (
    <section id="features" className="py-20 md:py-28">
      <Container>
        <div className="mb-10">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#0052FF]/20 bg-[#0052FF]/5 px-4 py-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-[#0052FF]" />
            <span className="text-[11px] uppercase tracking-[0.15em] text-[#0052FF]">Features</span>
          </div>
          <h2 className="max-w-xl text-3xl leading-[1.15] text-[#0F172A] md:text-4xl lg:text-[3.25rem]">
            Everything you need to succeed
          </h2>
        </div>
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {features.map((item) => (
            <Card key={item} className="p-6">
              <h3 className="text-xl font-semibold tracking-tight text-[#0F172A]">{item}</h3>
              <p className="mt-3 text-sm leading-relaxed text-[#64748B]">
                Powerful tools designed to help you work smarter while keeping workflows clear and aligned.
              </p>
            </Card>
          ))}
        </div>
      </Container>
    </section>
  );
}

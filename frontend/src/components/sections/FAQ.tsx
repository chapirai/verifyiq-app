import { Card } from '@/components/ui/Card';
import { Container } from '@/components/ui/Container';

const faqs = [
  ['How does the free trial work?', 'Start your 14-day free trial with full feature access and no credit card required.'],
  ['Can I change plans later?', 'Yes, you can upgrade or downgrade your plan at any time.'],
  ['Is my data secure?', 'Yes. We use encrypted transport and production-grade access controls.'],
];

export function FAQ() {
  return (
    <section id="faq" className="py-20 md:py-28">
      <Container>
        <div className="mb-10">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#0052FF]/20 bg-[#0052FF]/5 px-4 py-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-[#0052FF]" />
            <span className="text-[11px] uppercase tracking-[0.15em] text-[#0052FF]">FAQ</span>
          </div>
          <h2 className="text-3xl leading-[1.15] text-[#0F172A] md:text-4xl">Frequently asked questions</h2>
        </div>
        <div className="space-y-4">
          {faqs.map(([q, a]) => (
            <Card key={q} className="p-0">
              <details className="group rounded-2xl p-6">
                <summary className="cursor-pointer list-none text-lg font-semibold text-[#0F172A]">
                  {q}
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-[#64748B]">{a}</p>
              </details>
            </Card>
          ))}
        </div>
      </Container>
    </section>
  );
}

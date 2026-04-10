import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Container } from '@/components/ui/Container';

export function Hero() {
  return (
    <section className="relative overflow-hidden py-32 md:py-48 lg:py-56">
      <Container className="grid gap-14 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <div className="space-y-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#0052FF]/20 bg-[#0052FF]/5 px-4 py-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-[#0052FF]" />
            <span className="text-[11px] uppercase tracking-[0.15em] text-[#0052FF]">Now Available</span>
          </div>
          <h1 className="max-w-4xl text-[2.75rem] leading-[1.05] tracking-[-0.02em] text-[#0F172A] sm:text-6xl md:text-7xl lg:text-[5.25rem]">
            Transform the way your team{' '}
            <span className="relative text-[#0052FF]">
              works
              <span className="absolute bottom-[0.08em] left-0 right-0 -z-10 h-[0.42em] rounded bg-gradient-to-r from-[#0052FF]/20 to-[#4D7CFF]/12" />
            </span>
          </h1>
          <p className="max-w-xl text-lg leading-relaxed text-[#64748B]">
            VerifyIQ brings your team together with powerful tools designed to streamline workflows,
            boost productivity, and drive results.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button href="#pricing">Start free trial</Button>
            <Button href="#features" variant="secondary">
              Watch demo
            </Button>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex -space-x-2">
              {['A', 'B', 'C', 'D', 'E', 'F'].map((v) => (
                <span
                  key={v}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-[#F1F5F9] text-[11px] text-[#64748B]"
                >
                  {v}
                </span>
              ))}
            </div>
            <p className="text-sm text-[#64748B]">
              <span className="font-semibold text-[#0F172A]">2,000+ teams</span> Join 50,000+ teams already
              using VerifyIQ
            </p>
          </div>
        </div>

        <div className="relative hidden lg:block">
          <Card className="relative h-[500px] overflow-hidden p-8">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_15%,rgba(0,82,255,0.1),transparent_45%)]" />
            <div className="absolute right-8 top-8 h-36 w-36 rounded-full border border-dashed border-[#E2E8F0]" />
            <div className="absolute left-10 top-10 h-12 w-12 rounded-2xl border border-[#E2E8F0] bg-[#F1F5F9]" />
            <Card className="absolute left-16 top-40 w-[260px] p-5">
              <div className="mb-3 h-2 w-28 rounded-full bg-[#F1F5F9]" />
              <div className="h-2 w-36 rounded-full bg-[#F1F5F9]" />
            </Card>
            <Card className="absolute right-14 top-56 w-[180px] p-5">
              <p className="text-2xl font-semibold text-[#0F172A]">+127%</p>
              <p className="text-xs text-[#64748B]">Growth rate</p>
            </Card>
            <div className="absolute bottom-10 right-10 h-14 w-14 rounded-2xl bg-[#0052FF] shadow-[0_8px_24px_rgba(0,82,255,0.28)]" />
          </Card>
        </div>
      </Container>
    </section>
  );
}

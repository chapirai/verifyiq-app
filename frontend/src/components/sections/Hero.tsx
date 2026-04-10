import { Button } from '@/components/ui/Button';
import { Container } from '@/components/ui/Container';

export function Hero() {
  return (
    <section className="site-divider py-20 md:py-28 lg:py-36">
      <Container className="grid gap-12 lg:grid-cols-[1.08fr_0.92fr] lg:items-start">
        <div>
          <div className="mb-10 inline-flex items-center gap-3 border-2 border-foreground px-4 py-2">
            <span className="h-2 w-2 bg-foreground" />
            <span className="mono-label text-xs">Now Available</span>
          </div>

          <h1 className="display-heading max-w-[10ch] text-[4.4rem] leading-[0.92] md:text-[7.4rem] lg:text-[9.2rem]">
            Verify
            <br />
            intelligence
          </h1>
          <p className="mt-8 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            VerifyIQ by Nordic Company Data transforms onboarding, screening, monitoring, and company
            data workflows into one editorially clean operating surface.
          </p>

          <div className="mt-11 flex flex-col gap-4 sm:flex-row">
            <Button href="#pricing" variant="primary">Start Free Trial →</Button>
            <Button href="#features" variant="secondary">Watch Demo</Button>
          </div>

          <div className="mt-12 flex items-center gap-6">
            <div className="h-px flex-1 bg-foreground" />
            <div className="h-3 w-3 border-2 border-foreground" />
            <div className="h-px w-24 bg-foreground" />
          </div>
        </div>

        <div className="relative min-h-[520px] border-4 border-foreground bg-background p-8">
          <div className="absolute -right-4 -top-4 h-12 w-12 border-2 border-foreground bg-background" />
          <div className="absolute inset-0 section-texture-grid opacity-30" />
          <div className="relative mt-12 border-2 border-foreground bg-background p-6">
            <p className="mono-label text-xs">Company Intelligence</p>
            <p className="mt-5 font-display text-5xl">+127%</p>
            <p className="mt-2 text-sm text-muted-foreground">Growth rate in verification throughput</p>
          </div>
          <div className="relative mt-6 border-2 border-foreground bg-foreground p-6 text-background">
            <p className="mono-label text-xs">Live Workflow</p>
            <p className="mt-5 font-display text-4xl">500k+ Records</p>
          </div>
        </div>
      </Container>
    </section>
  );
}

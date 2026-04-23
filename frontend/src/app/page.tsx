import { Footer } from '@/components/sections/Footer';
import { Navbar } from '@/components/sections/Navbar';
import { Pricing } from '@/components/sections/Pricing';
import { Button } from '@/components/ui/Button';
import { Container } from '@/components/ui/Container';
import {
  accessTiers,
  atAGlance,
  audiences,
  capabilities,
  company,
  controlQuote,
  faq,
  finalCta,
  footer as footerCopy,
  hero,
  principle,
  productStory,
  visualBlock,
  workflow,
  workflowSteps,
} from '@/content/landing';

export default function HomePage() {
  return (
    <>
      <Navbar />
      <main id="main-content">
        {/* Hero — oversized display (non-negotiable) */}
        <section className="site-divider py-24 md:py-32 lg:py-40">
          <Container className="grid gap-16 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
            <div>
              <p className="mono-label text-xs text-muted-foreground">
                {company.legalName} · {company.product}
              </p>
              <h1 className="mt-6">
                <span className="block font-display text-display-hero text-foreground">{hero.line1}</span>
                <span className="mt-2 block max-w-3xl font-display text-3xl leading-tight tracking-tight text-foreground sm:text-4xl md:mt-3 md:text-5xl lg:text-6xl">
                  {hero.line2}
                </span>
              </h1>
              <p className="mt-4 max-w-2xl text-lg text-muted-foreground md:text-xl">{hero.sub}</p>
              <p className="mt-3 max-w-2xl text-sm text-muted-foreground md:text-base">{hero.support}</p>
              <div className="mt-8 flex items-center gap-4" aria-hidden>
                <div className="h-1.5 w-32 bg-foreground md:w-48" />
                <div className="h-5 w-5 border-2 border-foreground bg-background" />
              </div>
              <p className="mt-10 max-w-2xl text-base leading-relaxed text-muted-foreground md:text-lg">{hero.lead}</p>
              <div className="mt-12 flex min-h-[44px] flex-col gap-4 sm:flex-row sm:items-center">
                <Button href="/signup" variant="primary">
                  {hero.ctaPrimary} →
                </Button>
                <Button href="#workflow" variant="secondary">
                  {hero.ctaSecondary}
                </Button>
              </div>
            </div>
            <aside className="border-2 border-foreground bg-muted/50 p-8 md:p-10">
              <p className="mono-label text-xs text-muted-foreground">In one column</p>
              <ul className="mt-6 space-y-4 border-t-2 border-foreground pt-6 text-sm leading-relaxed text-muted-foreground md:text-base">
                {hero.asidePoints.map((line) => (
                  <li key={line} className="text-foreground/90">
                    {line}
                  </li>
                ))}
              </ul>
            </aside>
          </Container>
        </section>

        {/* Inverted band — company metrics (vertical line texture) */}
        <section className="site-divider section-invert py-20 md:py-28" aria-label="Proposition in brief">
          <Container className="grid gap-8 lg:grid-cols-3 lg:gap-0">
            {atAGlance.map((row, i) => (
              <article
                key={row.k}
                className={
                  i > 0
                    ? 'flex min-h-[190px] flex-col justify-start border-t-2 border-background/20 pt-8 lg:min-h-[220px] lg:border-t-0 lg:border-l-2 lg:pl-10'
                    : 'flex min-h-[190px] flex-col justify-start pt-1 lg:min-h-[220px]'
                }
              >
                <p className="mono-label text-[11px] text-background/50">{row.k}</p>
                <p className="font-display mt-4 text-[clamp(1.7rem,2.2vw,2.55rem)] leading-[1.05] tracking-tight text-background">
                  {row.v}
                </p>
                <p className="mt-3 max-w-[34ch] text-sm leading-relaxed text-background/75 md:text-base">{row.s}</p>
              </article>
            ))}
          </Container>
        </section>

        {/* Product: drop cap + “editorial” visual frame */}
        <section id="product" className="site-divider section-texture-grid py-24 md:py-32">
          <Container>
            <p className="mono-label text-xs text-muted-foreground">{productStory.kicker}</p>
            <h2 className="font-display mt-4 max-w-3xl text-3xl leading-[1.05] tracking-tight text-foreground md:text-4xl lg:text-5xl">
              {productStory.title}
            </h2>
            <div className="mt-12 grid gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
              <div>
                <p className="text-base leading-relaxed text-muted-foreground after:clear-both after:table md:text-lg">
                  <span
                    className="float-left mb-2 mr-4 flex h-16 w-16 items-center justify-center border-2 border-foreground font-display text-3xl text-foreground md:mb-3 md:h-[4.5rem] md:w-[4.5rem] md:text-4xl"
                    aria-hidden
                  >
                    {productStory.dropCap}
                  </span>
                  {productStory.body}
                </p>
                <p className="mt-6 border-l-2 border-foreground pl-4 text-sm leading-relaxed text-muted-foreground md:text-base">
                  {productStory.followUp}
                </p>
              </div>
              <div>
                <p className="mono-label text-xs text-muted-foreground">{visualBlock.kicker}</p>
                <p className="font-display mt-2 text-2xl text-foreground">{visualBlock.title}</p>
                <ol className="mt-4 space-y-2 text-sm md:text-base">
                  {visualBlock.steps.map((step, i) => (
                    <li key={step} className="flex items-start gap-2 border-b border-border-light pb-1">
                      <span className="mono-label text-[11px] text-muted-foreground">{String(i + 1).padStart(2, '0')}</span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
                <p className="mt-4 text-xs text-muted-foreground leading-relaxed">{visualBlock.caption}</p>
              </div>
            </div>
          </Container>
        </section>

        {/* Pull quote — UBO / control (editorial italic) */}
        <section id="why" className="site-divider section-texture-diagonal py-24 md:py-32">
          <Container>
            <p className="mono-label text-xs text-muted-foreground">{controlQuote.kicker}</p>
            <blockquote className="relative mt-8 max-w-4xl pl-0 md:pl-4">
              <span
                className="quote-mark font-display text-[3.5rem] leading-none text-foreground/15 select-none md:text-6xl"
                aria-hidden
              >
                &ldquo;
              </span>
              <p className="-mt-4 font-display text-2xl italic leading-snug tracking-tight text-foreground md:-mt-8 md:text-3xl lg:text-4xl">
                {controlQuote.text}
              </p>
            </blockquote>
          </Container>
        </section>

        {/* Capabilities — invert on hover (spec) */}
        <section id="capabilities" className="site-divider py-24 md:py-32">
          <Container>
            <p className="mono-label text-xs text-muted-foreground">Capabilities</p>
            <h2 className="font-display mt-4 text-3xl leading-none tracking-tight text-foreground md:text-5xl">What the platform does</h2>
            <div className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {capabilities.map((c) => (
                <article key={c.title} className="feature-card min-h-[120px] p-6 md:min-h-[140px] md:p-7">
                  <h3 className="font-display text-xl tracking-tight transition-colors duration-100 md:text-2xl">{c.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{c.detail}</p>
                </article>
              ))}
            </div>
          </Container>
        </section>

        <section id="audiences" className="site-divider section-texture-grid py-24 md:py-32">
          <Container>
            <p className="mono-label text-xs text-muted-foreground">Intended use</p>
            <h2 className="font-display mt-4 text-2xl leading-none tracking-tight text-foreground md:text-3xl">Who it is for</h2>
            <div className="mt-10 flex flex-wrap gap-3">
              {audiences.map((a) => (
                <span
                  key={a}
                  className="min-h-11 border-2 border-foreground bg-background px-4 py-2.5 text-sm text-foreground transition-colors duration-100 hover:bg-foreground hover:text-background"
                >
                  {a}
                </span>
              ))}
            </div>
          </Container>
        </section>

        {/* Testimonial (principle — not a fake persona) */}
        <section id="principle" className="site-divider py-16 md:py-20">
          <Container>
            <blockquote className="testimonial-cite text-center">
              <span className="quote-mark block" aria-hidden>
                &ldquo;
              </span>
              <p className="mx-auto mt-4 max-w-3xl font-display text-2xl italic leading-snug text-foreground md:text-3xl lg:text-4xl">
                {principle.quote}
              </p>
              <p className="mono-label mt-6 text-xs text-muted-foreground">{principle.label}</p>
            </blockquote>
          </Container>
        </section>

        {/* Tiers — elevated center (spec) */}
        <section id="access" className="site-divider py-24 md:py-32">
          <Container>
            <p className="mono-label text-xs text-muted-foreground">Ways in</p>
            <h2 className="font-display mt-4 text-3xl leading-none tracking-tight text-foreground md:text-4xl">Ways in</h2>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              Tiers are indicative — exact entitlements, quotas, and contracts are set with Nordic Data Company.
            </p>
            <div className="mt-12 grid items-end gap-3 md:grid-cols-3">
              {accessTiers.map((t) => (
                <div
                  key={t.name}
                  className={`border-2 border-foreground bg-background p-6 transition-none md:p-8 ${
                    t.elevated ? 'md:-translate-y-3 md:border-4 md:py-10' : ''
                  } ${t.elevated ? 'z-[1] bg-background' : 'border-foreground'}`}
                >
                  <p className="mono-label text-[11px] text-muted-foreground">Option</p>
                  <h3 className="font-display mt-3 text-2xl text-foreground md:text-3xl">{t.name}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground md:text-base">{t.blurb}</p>
                </div>
              ))}
            </div>
            <div className="mt-10 text-center">
              <Button href="/signup" variant="primary">
                Get access →
              </Button>
            </div>
          </Container>
        </section>

        {/* Workflow */}
        <section id="workflow" className="site-divider py-24 md:py-32">
          <Container>
            <p className="mono-label text-xs text-muted-foreground">{workflow.kicker}</p>
            <p className="mt-4 max-w-2xl text-base text-muted-foreground md:text-lg">{workflow.sub}</p>
            <div className="mt-10 border-t-4 border-foreground pt-8">
              <ol className="grid gap-10 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
                {workflowSteps.map((s) => (
                  <li key={s.n} className="list-none">
                    <p className="mono-label text-[11px] text-muted-foreground">{s.n}</p>
                    <p className="font-display mt-2 text-xl text-foreground md:text-2xl">{s.label}</p>
                  </li>
                ))}
              </ol>
            </div>
          </Container>
        </section>

        {/* FAQ */}
        <section id="faq" className="site-divider py-24 md:py-32">
          <Container>
            <p className="mono-label text-xs text-muted-foreground">Questions</p>
            <h2 className="font-display mt-4 text-2xl text-foreground md:text-3xl">FAQ</h2>
            <div className="mt-8 space-y-3">
              {faq.map((item) => (
                <article
                  key={item.q}
                  className="group border-2 border-foreground bg-background p-5 transition-colors duration-100 md:p-7 hover:bg-foreground hover:text-background"
                >
                  <h3 className="font-display text-lg leading-tight text-foreground group-hover:text-background md:text-xl">{item.q}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground group-hover:text-background/80 md:text-base">
                    {item.a}
                  </p>
                </article>
              ))}
            </div>
          </Container>
        </section>

        <Pricing />

        {/* Final CTA — inverted + radial (spec) */}
        <section id="start" className="section-cta-final py-20 md:py-28" aria-label="Get started">
          <Container>
            <p className="mono-label text-xs text-background/60">{finalCta.kicker}</p>
            <h2 className="font-display mt-4 max-w-2xl text-3xl leading-[0.95] text-background md:text-4xl lg:text-5xl">
              {finalCta.title}
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-background/80 md:text-base">{finalCta.lead}</p>
            <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center">
              <a
                href="/signup"
                className="focus-outline btn-base min-h-[44px] border-2 border-background bg-background text-center text-foreground transition-none hover:bg-transparent hover:text-background"
              >
                {hero.ctaPrimary} →
              </a>
              <a
                href="/login"
                className="focus-outline min-h-[44px] min-w-[44px] border-2 border-transparent bg-transparent px-4 py-3 text-center text-sm text-background/90 underline-offset-4 transition-none hover:underline"
              >
                {hero.ctaSecondary}
              </a>
            </div>
          </Container>
        </section>
      </main>
      <Footer blurb={footerCopy.blurb} />
    </>
  );
}

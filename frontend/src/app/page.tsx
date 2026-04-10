import Link from 'next/link';
import { MarketingNav } from '@/components/marketing-nav';

export default function HomePage() {
  return (
    <div className="min-h-screen">
      <MarketingNav />

      <section className="mx-auto grid max-w-6xl gap-14 px-6 pb-20 pt-8 md:px-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
        <div className="space-y-8">
          <div className="section-badge">
            <span className="section-badge-dot" />
            <span className="section-badge-text">Now available</span>
          </div>
          <h1 className="relative isolate max-w-[16ch] text-4xl font-bold leading-[1.05] tracking-[-0.02em] text-foreground md:text-6xl lg:text-7xl">
            Transform the way your team <span className="hero-highlight">works</span>
          </h1>
          <p className="max-w-xl text-base leading-relaxed text-muted-foreground md:text-lg">
            VerifyIQ from Nordic Company Data brings your team together with powerful tools for company
            verification, screening, monitoring, and data workflows—built for compliance and scale.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link className="primary-btn" href="/signup">
              Start free trial
              <span aria-hidden>→</span>
            </Link>
            <Link className="secondary-btn" href="/pricing">
              Watch demo
            </Link>
          </div>
          <div className="flex flex-wrap items-center gap-4 pt-1">
            <div className="flex -space-x-2">
              {['A', 'B', 'C', 'D', 'E', 'F'].map((letter, i) => (
                <span
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-muted text-[11px] font-medium text-muted-foreground shadow-sm"
                  key={i}
                >
                  {letter}
                </span>
              ))}
            </div>
            <div className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">2,000+ teams</span>
              <span className="mx-1.5 text-border">·</span>
              Join teams already using VerifyIQ for Nordic company intelligence
            </div>
          </div>
        </div>

        <div className="relative hidden lg:block">
          <div className="panel relative h-[440px] overflow-hidden p-8">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_70%_15%,rgba(37,99,235,0.1),transparent_45%)]" />
            <div className="pointer-events-none absolute right-8 top-8 h-28 w-28 rounded-full border border-dashed border-border/80" />
            <div className="absolute left-10 top-10 h-11 w-11 rounded-2xl border border-border bg-muted/80 shadow-soft" />

            <div className="absolute left-12 top-32 w-[240px] rounded-2xl border border-border bg-card p-5 shadow-card">
              <div className="mb-3 h-2 w-28 rounded-full bg-muted" />
              <div className="h-2 w-36 rounded-full bg-muted" />
              <div className="mt-5 flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-primary" />
                <span className="text-xs font-medium text-primary">+127%</span>
                <span className="text-xs text-muted-foreground">Growth rate</span>
              </div>
            </div>

            <div className="absolute right-12 top-40 w-[200px] rounded-2xl border border-border bg-card p-5 shadow-card">
              <p className="text-2xl font-bold text-foreground">500k+</p>
              <p className="text-xs text-muted-foreground">Active lookups</p>
            </div>

            <div className="absolute bottom-12 right-12 h-14 w-14 rounded-2xl bg-primary shadow-primary" />
            <div className="pointer-events-none absolute bottom-16 left-16 grid grid-cols-3 gap-1.5 opacity-40">
              {Array.from({ length: 9 }).map((_, i) => (
                <span key={i} className="h-1.5 w-1.5 rounded-full bg-primary/40" />
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="product" className="mx-auto max-w-6xl px-6 pb-24 md:px-10">
        <div className="section-badge mb-4">
          <span className="section-badge-dot" />
          <span className="section-badge-text">Product</span>
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
          Everything you need for Nordic company intelligence
        </h2>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          Verification, registry data, bulk processing, and API access—unified in VerifyIQ.
        </p>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            ['Search and lookup', 'Org numbers and identifiers with freshness you can trust.'],
            ['Bulk and automation', 'Queue large volumes with clear status and exports.'],
            ['API and billing', 'Keys, plans, and subscription management in one place.'],
          ].map(([title, desc]) => (
            <div key={title} className="panel p-6">
              <h3 className="text-lg font-semibold text-foreground">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="about" className="mx-auto max-w-6xl px-6 pb-28 md:px-10">
        <div className="panel p-8 md:p-10">
          <div className="section-badge mb-4">
            <span className="section-badge-dot" />
            <span className="section-badge-text">About</span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">Nordic Company Data</h2>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground">
            We build VerifyIQ so compliance and operations teams can trust company data across onboarding,
            monitoring, and credit workflows—with the same polished experience you expect from modern SaaS.
          </p>
        </div>
      </section>
    </div>
  );
}

import Link from 'next/link';
import { MarketingNav } from '@/components/marketing-nav';

const stats = [
  { value: '+127%', label: 'Growth rate' },
  { value: '500k+', label: 'Active Users' },
  { value: '99.99%', label: 'Uptime SLA' },
  { value: '24/7', label: 'Support Access' },
  { value: '$10M+', label: 'Customer Savings' },
];

const features = [
  'Real-time Collaboration',
  'Smart Automation',
  'Advanced Analytics',
  'Seamless Integrations',
  'Enterprise Security',
  '24/7 Support',
  'Global Infrastructure',
];

const blogPosts = [
  {
    date: '2026-04-02',
    author: 'Nordic Team',
    title: 'Boosting Verification Productivity with Smart Automation',
    excerpt: 'Discover how VerifyIQ automation can reduce manual review loops and speed up compliant onboarding.',
  },
  {
    date: '2026-03-26',
    author: 'Data Ops',
    title: 'The Future of Collaboration in Company Intelligence',
    excerpt: 'How teams align faster with shared data, case context, and live status signals.',
  },
  {
    date: '2026-03-19',
    author: 'Platform',
    title: 'Scaling VerifyIQ Workflows Across Regions',
    excerpt: 'Practical guidance for resilient integrations, low-latency APIs, and reliable growth.',
  },
];

const faqs = [
  {
    q: 'How does the trial work?',
    a: 'Start your 14-day trial with full access to the selected tier. Cancel anytime.',
  },
  {
    q: 'Can we change plans later?',
    a: 'Yes. Upgrade or downgrade anytime. Billing changes are prorated automatically.',
  },
  {
    q: 'Is our company data secure?',
    a: 'Yes. VerifyIQ uses encrypted transport and strict access controls across the platform.',
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen">
      <MarketingNav />

      <section className="relative overflow-hidden py-32 md:py-48 lg:py-56">
        <div className="mx-auto grid max-w-6xl gap-14 px-6 md:px-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div className="space-y-8">
            <div className="section-badge">
              <span className="section-badge-dot" />
              <span className="section-badge-text">Now available</span>
            </div>
            <h1 className="relative isolate mb-8 max-w-4xl text-[2.75rem] font-normal leading-[1.05] tracking-[-0.02em] text-foreground sm:text-6xl md:text-7xl lg:text-[5.25rem]">
              Transform the way your team <span className="hero-highlight">works</span>
            </h1>
            <p className="max-w-xl text-base leading-relaxed text-muted-foreground md:text-lg">
              VerifyIQ by Nordic Company Data brings your team together with powerful tools to
              streamline workflows, improve trust, and deliver better decisions.
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
                Join 50,000+ teams already using VerifyIQ
              </div>
            </div>
          </div>

          <div className="relative hidden lg:block">
            <div className="panel relative h-[500px] overflow-hidden p-8">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_70%_15%,rgba(37,99,235,0.1),transparent_45%)]" />
              <div className="pointer-events-none absolute right-8 top-8 h-36 w-36 rounded-full border border-dashed border-border/80" />
              <div className="absolute left-10 top-10 h-12 w-12 rounded-2xl border border-border bg-muted/80 shadow-soft" />

              <div className="absolute left-16 top-40 w-[260px] rounded-2xl border border-border bg-card p-5 shadow-card">
                <div className="mb-3 h-2 w-28 rounded-full bg-muted" />
                <div className="h-2 w-36 rounded-full bg-muted" />
                <div className="mt-5 flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-primary" />
                  <span className="text-xs font-medium text-primary">+127%</span>
                  <span className="text-xs text-muted-foreground">Growth rate</span>
                </div>
              </div>

              <div className="absolute right-14 top-56 w-[180px] rounded-2xl border border-border bg-card p-5 shadow-card">
                <p className="text-2xl font-semibold text-foreground">+127%</p>
                <p className="text-xs text-muted-foreground">Growth rate</p>
              </div>

              <div className="absolute bottom-10 right-10 h-14 w-14 rounded-2xl bg-primary shadow-primary" />
              <div className="pointer-events-none absolute bottom-16 left-16 grid grid-cols-3 gap-1.5 opacity-40">
                {Array.from({ length: 9 }).map((_, i) => (
                  <span key={i} className="h-1.5 w-1.5 rounded-full bg-primary/40" />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 md:py-24">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-6 md:grid-cols-5 md:px-10">
          {stats.map((stat) => (
            <article key={stat.label} className="panel p-5">
              <p className="text-2xl font-semibold text-foreground">{stat.value}</p>
              <p className="mt-1 text-xs text-muted-foreground">{stat.label}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="product" className="py-20 md:py-28">
        <div className="mx-auto max-w-6xl px-6 md:px-10">
          <div className="section-badge mb-5">
            <span className="section-badge-dot" />
            <span className="section-badge-text">Features</span>
          </div>
          <h2 className="max-w-xl text-3xl font-normal leading-[1.15] text-foreground md:text-4xl lg:text-[3.25rem]">
            Everything you need to succeed
          </h2>
          <p className="mt-4 max-w-2xl text-muted-foreground">
            Powerful tools designed to help your team work smarter, not harder.
          </p>
          <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <article key={feature} className="panel p-6">
                <h3 className="text-lg font-semibold tracking-tight text-foreground">{feature}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  Production-ready modules in VerifyIQ with a consistent interface and workflow model.
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 md:py-28">
        <div className="mx-auto max-w-6xl px-6 md:px-10">
          <div className="mb-10 flex items-end justify-between gap-4">
            <div>
              <div className="section-badge mb-5">
                <span className="section-badge-dot" />
                <span className="section-badge-text">Blog</span>
              </div>
              <h2 className="text-3xl font-normal text-foreground md:text-4xl lg:text-[3.25rem]">
                Latest insights from VerifyIQ
              </h2>
            </div>
            <Link className="secondary-btn !min-h-10 px-4 text-sm" href="/dashboard">
              View all posts
            </Link>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {blogPosts.map((post) => (
              <article key={post.title} className="panel p-6">
                <p className="text-xs text-muted-foreground">
                  {post.date} · {post.author}
                </p>
                <h3 className="mt-3 text-xl font-semibold leading-snug tracking-tight text-foreground">
                  {post.title}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{post.excerpt}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 md:py-28">
        <div className="mx-auto max-w-6xl px-6 md:px-10">
          <div className="section-badge mb-5">
            <span className="section-badge-dot" />
            <span className="section-badge-text">Process</span>
          </div>
          <h2 className="text-3xl font-normal text-foreground md:text-4xl lg:text-[3.25rem]">
            How VerifyIQ works
          </h2>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {[
              ['1', 'Connect your data', 'Integrate your existing systems and data sources.'],
              ['2', 'Configure workflows', 'Set up onboarding, screening, and monitoring logic.'],
              ['3', 'Start collaborating', 'Invite your team and run operations in one workspace.'],
            ].map(([n, t, d]) => (
              <article key={n} className="panel p-6">
                <p className="text-4xl font-semibold text-primary">{n}</p>
                <h3 className="mt-4 text-xl font-semibold text-foreground">{t}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{d}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 md:py-28">
        <div className="mx-auto max-w-6xl px-6 md:px-10">
          <div className="section-badge mb-5">
            <span className="section-badge-dot" />
            <span className="section-badge-text">Pricing</span>
          </div>
          <h2 className="text-3xl font-normal text-foreground md:text-4xl lg:text-[3.25rem]">
            Simple, transparent pricing
          </h2>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {[
              ['Starter', '$29/month', 'Perfect for small teams getting started'],
              ['Professional', '$79/month', 'For growing teams needing more power'],
              ['Enterprise', 'Custom', 'For advanced security and large scale'],
            ].map(([name, price, desc], idx) => (
              <article key={name} className={`panel p-8 ${idx === 1 ? 'ring-2 ring-primary/30' : ''}`}>
                <h3 className="text-xl font-semibold text-foreground">{name}</h3>
                <p className="mt-3 text-3xl font-semibold text-foreground">{price}</p>
                <p className="mt-3 text-sm text-muted-foreground">{desc}</p>
                <Link className="primary-btn mt-8 w-full" href="/signup">
                  Start free trial
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 md:py-28">
        <div className="mx-auto max-w-6xl px-6 md:px-10">
          <div className="section-badge mb-5">
            <span className="section-badge-dot" />
            <span className="section-badge-text">FAQ</span>
          </div>
          <h2 className="text-3xl font-normal text-foreground md:text-4xl">Frequently asked questions</h2>
          <div className="mt-10 space-y-4">
            {faqs.map((item) => (
              <article key={item.q} className="panel p-6">
                <h3 className="text-lg font-semibold text-foreground">{item.q}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{item.a}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="about" className="py-24">
        <div className="mx-auto max-w-6xl px-6 md:px-10">
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
        </div>
      </section>
    </div>
  );
}

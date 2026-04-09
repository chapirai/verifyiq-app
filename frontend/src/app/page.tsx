import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="min-h-screen px-6 py-16 md:px-10">
      <section className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <div className="space-y-6">
          <div className="section-badge">
            <span className="section-badge-dot" />
            <span className="section-badge-text">Minimalist Modern</span>
          </div>
          <h1 className="text-[2.75rem] leading-[1.05] text-foreground md:text-6xl">
            Verify entities with <span className="gradient-text">clarity</span> and confidence
          </h1>
          <p className="max-w-xl text-lg text-muted-foreground">
            VerifyIQ helps compliance teams run onboarding, screening, monitoring, and risk workflows
            from one structured platform.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link className="primary-btn inline-flex items-center justify-center" href="/signup">
              Start free trial
            </Link>
            <Link className="secondary-btn inline-flex items-center justify-center" href="/login">
              Sign in
            </Link>
          </div>
        </div>

        <div className="panel relative overflow-hidden p-8">
          <div className="absolute -right-16 -top-16 h-52 w-52 rounded-full bg-[radial-gradient(circle,rgba(0,82,255,0.22),transparent_68%)]" />
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Live product areas</h2>
            {['Dashboard foundation', 'Search and company lookup', 'Bulk processing', 'Billing and plans'].map(
              (item) => (
                <div key={item} className="rounded-xl border border-border bg-muted/70 px-4 py-3 text-sm">
                  {item}
                </div>
              ),
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

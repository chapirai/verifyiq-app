import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#f7f8fc]">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5 md:px-10">
        <div className="flex items-center gap-3">
          <span className="h-4 w-4 rounded-full bg-foreground" />
          <p className="text-sm font-medium">VerifyIQ Inc.</p>
        </div>
        <nav className="hidden items-center gap-8 text-xs text-muted-foreground md:flex">
          <Link href="/search">Features</Link>
          <Link href="/pricing">Pricing</Link>
          <Link href="/companies">About</Link>
        </nav>
        <div className="flex items-center gap-2">
          <Link className="secondary-btn h-9 px-4 text-xs" href="/login">
            Log in
          </Link>
          <Link className="primary-btn h-9 px-4 text-xs" href="/signup">
            Sign up
          </Link>
        </div>
      </header>

      <section className="mx-auto grid max-w-6xl gap-14 px-6 pb-16 pt-12 md:px-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
        <div className="space-y-7">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-white px-4 py-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-accent">Now available</span>
          </div>
          <h1 className="max-w-[15ch] text-5xl leading-[1.02] tracking-[-0.02em] text-foreground md:text-7xl">
            Transform the way your team <span className="gradient-text">works</span>
          </h1>
          <p className="max-w-xl text-base leading-relaxed text-muted-foreground md:text-lg">
            VerifyIQ brings your team together with structured workflows for verification, screening,
            monitoring, and credit decisions.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link className="primary-btn inline-flex items-center justify-center" href="/signup">
              Start free trial
            </Link>
            <Link className="secondary-btn inline-flex items-center justify-center" href="/pricing">
              Watch demo
            </Link>
          </div>
          <div className="flex items-center gap-4 pt-1">
            <div className="flex -space-x-2">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <span
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-muted text-[10px] text-muted-foreground"
                  key={i}
                >
                  {i}
                </span>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">2,000+ teams</span> use VerifyIQ daily
            </p>
          </div>
        </div>

        <div className="relative hidden lg:block">
          <div className="panel relative h-[420px] overflow-hidden p-8">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_20%,rgba(0,82,255,0.08),transparent_40%)]" />
            <div className="absolute right-10 top-10 h-24 w-24 rounded-full border border-dashed border-border" />
            <div className="absolute left-12 top-12 h-10 w-10 rounded-2xl border border-border bg-muted" />

            <div className="absolute left-16 top-28 w-56 rounded-2xl border border-border bg-white p-4 shadow-soft">
              <div className="mb-3 h-2 w-24 rounded bg-muted" />
              <div className="h-2 w-32 rounded bg-muted" />
              <span className="mt-4 inline-block rounded-full bg-accent/10 px-2 py-1 text-xs text-accent">
                Workflow synced
              </span>
            </div>

            <div className="absolute right-14 top-44 w-44 rounded-2xl border border-border bg-white p-4 shadow-soft">
              <p className="text-2xl font-semibold text-foreground">+127%</p>
              <p className="text-xs text-muted-foreground">Growth rate</p>
            </div>

            <div className="absolute bottom-10 right-10 h-12 w-12 rounded-2xl bg-gradient-to-br from-accent to-accent-secondary shadow-accent" />
          </div>
        </div>
      </section>
    </main>
  );
}

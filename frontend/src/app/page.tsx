import Link from 'next/link';

export default function RootPage() {
  return (
    <main className="min-h-screen bg-background text-white">
      <section className="mx-auto max-w-6xl px-6 py-20">
        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">VerifyIQ</p>
        <h1 className="mt-4 text-4xl font-semibold md:text-5xl">
          Company intelligence for KYC, risk, and automation
        </h1>
        <p className="mt-5 max-w-3xl text-lg text-slate-300">
          Search, enrich, and monitor company data through one dashboard and API foundation.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/signup" className="rounded-xl bg-indigo-600 px-6 py-3 font-medium hover:bg-indigo-500">
            Get Started
          </Link>
          <Link href="/pricing" className="rounded-xl border border-border px-6 py-3 font-medium hover:bg-card">
            View Pricing
          </Link>
          <Link href="/login" className="rounded-xl border border-border px-6 py-3 font-medium hover:bg-card">
            Login
          </Link>
        </div>
      </section>
    </main>
  );
}

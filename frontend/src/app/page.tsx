import Link from 'next/link';

export default function RootPage() {
  return (
    <main className="min-h-screen bg-background text-white">
      <section className="mx-auto max-w-6xl px-6 py-20">
        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">VerifyIQ</p>
        <h1 className="mt-4 text-4xl font-semibold md:text-5xl">
          Nordic company intelligence for KYC, credit, and API automation
        </h1>
        <p className="mt-5 max-w-3xl text-lg text-slate-300">
          Demand-driven data retrieval with historical snapshots, structured outputs, and operational workflows.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/signup" className="rounded-xl bg-indigo-600 px-6 py-3 font-medium hover:bg-indigo-500">
            Get API Access
          </Link>
          <Link href="/login" className="rounded-xl border border-border px-6 py-3 font-medium hover:bg-card">
            Access Platform
          </Link>
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-6 pb-10">
        <h2 className="text-2xl font-semibold">Use Cases</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {['KYC & Compliance', 'Credit & Underwriting', 'API Integration', 'Sales & Lead Generation'].map((item) => (
            <div key={item} className="panel p-5">
              <p className="font-medium">{item}</p>
            </div>
          ))}
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-6 pb-10">
        <h2 className="text-2xl font-semibold">Product Paths</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {['Dashboard', 'API', 'SDK / Integration'].map((item) => (
            <div key={item} className="panel p-5">
              <p className="font-medium">{item}</p>
            </div>
          ))}
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-6 pb-10">
        <div className="panel p-6">
          <h2 className="text-2xl font-semibold">Data Advantage</h2>
          <p className="mt-2 text-slate-300">
            Every lookup becomes reusable data with snapshots, freshness metadata, and change tracking.
          </p>
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-6 pb-20">
        <div className="panel p-6">
          <h2 className="text-2xl font-semibold">Trust and Reliability</h2>
          <p className="mt-2 text-slate-300">
            Timestamped responses, source-aware metadata, and resilient asynchronous processing for high-confidence workflows.
          </p>
        </div>
      </section>
    </main>
  );
}

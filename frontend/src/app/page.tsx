import Link from 'next/link';

export default function RootPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="mx-auto max-w-6xl px-6 py-24">
        <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Nordic Company Data</p>
        <h1 className="mt-4 text-5xl leading-tight md:text-6xl" style={{ fontFamily: 'var(--font-calistoga), Georgia, serif' }}>
          VerifyIQ for <span className="gradient-text">KYC, credit, and API automation</span>
        </h1>
        <p className="mt-5 max-w-3xl text-lg text-muted-foreground">
          Demand-driven data retrieval with historical snapshots, structured outputs, and operational workflows.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/signup" className="primary-btn">
            Get API Access
          </Link>
          <Link href="/login" className="secondary-btn">
            Access Platform
          </Link>
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-6 pb-10">
        <h2 className="text-3xl" style={{ fontFamily: 'var(--font-calistoga), Georgia, serif' }}>Use Cases</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {['KYC & Compliance', 'Credit & Underwriting', 'API Integration', 'Sales & Lead Generation'].map((item) => (
            <div key={item} className="panel p-5">
              <p className="font-medium">{item}</p>
            </div>
          ))}
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-6 pb-10">
        <h2 className="text-3xl" style={{ fontFamily: 'var(--font-calistoga), Georgia, serif' }}>Product Paths</h2>
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
          <h2 className="text-3xl" style={{ fontFamily: 'var(--font-calistoga), Georgia, serif' }}>Data Advantage</h2>
          <p className="mt-2 text-muted-foreground">
            Every lookup becomes reusable data with snapshots, freshness metadata, and change tracking.
          </p>
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-6 pb-20">
        <div className="panel p-6">
          <h2 className="text-3xl" style={{ fontFamily: 'var(--font-calistoga), Georgia, serif' }}>Trust and Reliability</h2>
          <p className="mt-2 text-muted-foreground">
            Timestamped responses, source-aware metadata, and resilient asynchronous processing for high-confidence workflows.
          </p>
        </div>
      </section>
    </main>
  );
}

export default function PropertyPage() {
  return (
    <section className="space-y-8">
      <div>
        <p className="text-sm text-slate-400">Property</p>
        <h1 className="text-3xl font-semibold">Property Information</h1>
        <p className="mt-2 text-slate-400">Company and individual property ownership records</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <div className="panel p-6">
          <h2 className="text-xl font-semibold">Company Property</h2>
          <p className="mt-3 text-slate-300">Properties owned by companies including cadastral unit references and valuations.</p>
        </div>
        <div className="panel p-6">
          <h2 className="text-xl font-semibold">Individual Property</h2>
          <p className="mt-3 text-slate-300">Properties owned by individuals. Access subject to data permissions and purpose limitation controls.</p>
        </div>
        <div className="panel p-6">
          <h2 className="text-xl font-semibold">Property Signals</h2>
          <p className="mt-3 text-slate-300">Property-based underwriting and risk signals derived from ownership patterns.</p>
        </div>
      </div>
    </section>
  );
}

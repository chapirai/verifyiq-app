export default function RiskIndicatorsPage() {
  return (
    <section className="space-y-8">
      <div>
        <p className="text-sm text-slate-400">Risk</p>
        <h1 className="text-3xl font-semibold">Risk Indicators</h1>
        <p className="mt-2 text-slate-400">Configurable risk signal evaluation and monitoring</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <div className="panel p-6">
          <h2 className="text-xl font-semibold">Indicator Configurations</h2>
          <p className="mt-3 text-slate-300">Ownership, sanctions, financial, and operational indicators configured per tenant.</p>
        </div>
        <div className="panel p-6">
          <h2 className="text-xl font-semibold">Evaluation Results</h2>
          <p className="mt-3 text-slate-300">Triggered indicators with severity level and human-readable reason for each signal.</p>
        </div>
        <div className="panel p-6">
          <h2 className="text-xl font-semibold">Custom Thresholds</h2>
          <p className="mt-3 text-slate-300">Configure per-tenant risk thresholds to tune sensitivity for each indicator type.</p>
        </div>
      </div>
    </section>
  );
}

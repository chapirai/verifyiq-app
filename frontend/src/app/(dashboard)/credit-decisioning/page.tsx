export default function CreditDecisioningPage() {
  return (
    <section className="space-y-8">
      <div>
        <p className="text-sm text-slate-400">Credit</p>
        <h1 className="text-3xl font-semibold">Credit Decisioning</h1>
        <p className="mt-2 text-slate-400">Rule-based credit decisions for companies and individuals</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <div className="panel p-6">
          <h2 className="text-xl font-semibold">Decision Templates</h2>
          <p className="mt-3 text-slate-300">Configurable approve, reject, and manual review rules applied at decision time.</p>
        </div>
        <div className="panel p-6">
          <h2 className="text-xl font-semibold">Decision Results</h2>
          <p className="mt-3 text-slate-300">History of credit decisions with explainable reasons for each outcome.</p>
        </div>
        <div className="panel p-6">
          <h2 className="text-xl font-semibold">Rule Engine</h2>
          <p className="mt-3 text-slate-300">Parameter selection and threshold configuration for the underlying decision rules.</p>
        </div>
      </div>
    </section>
  );
}

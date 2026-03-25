const statCards = [
  ['Dataset Families', '14'],
  ['Active Entitlements', '—'],
  ['Monthly API Calls', '—'],
];

export default function EntitlementsPage() {
  return (
    <section className="space-y-8">
      <div>
        <p className="text-sm text-slate-400">Administration</p>
        <h1 className="text-3xl font-semibold">Dataset Entitlements &amp; Usage</h1>
        <p className="mt-2 text-slate-400">Control per-tenant access to dataset families and track billing</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {statCards.map(([label, value]) => (
          <div key={label} className="panel p-5">
            <p className="text-sm text-slate-400">{label}</p>
            <p className="mt-3 text-3xl font-semibold">{value}</p>
          </div>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <div className="panel p-6">
          <h2 className="text-xl font-semibold">Entitlement Configuration</h2>
          <p className="mt-3 text-slate-300">Enable or disable datasets per tenant and set call quotas per dataset family.</p>
        </div>
        <div className="panel p-6">
          <h2 className="text-xl font-semibold">Usage by Dataset Family</h2>
          <p className="mt-3 text-slate-300">Breakdown of API calls and billing units per dataset family for the current period.</p>
        </div>
        <div className="panel p-6">
          <h2 className="text-xl font-semibold">Usage History</h2>
          <p className="mt-3 text-slate-300">Timeline of usage events with dataset family classification for audit and billing.</p>
        </div>
      </div>
    </section>
  );
}

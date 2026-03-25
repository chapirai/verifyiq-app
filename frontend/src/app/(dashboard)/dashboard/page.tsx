const datasetCards = [
  ['Ownership pulls', '0'],
  ['Sanctions/PEP checks', '0'],
  ['Company documents', '0'],
  ['Credit decisions', '0'],
];

const cards = [
  ['Active onboarding cases', '12'],
  ['Unreviewed screening matches', '4'],
  ['Monitoring alerts', '9'],
  ['Webhook deliveries today', '128'],
];

export default function DashboardPage() {
  return (
    <section className="space-y-8">
      <div>
        <p className="text-sm text-slate-400">Operations</p>
        <h1 className="text-3xl font-semibold">Compliance dashboard</h1>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map(([label, value]) => (
          <div key={label} className="panel p-5">
            <p className="text-sm text-slate-400">{label}</p>
            <p className="mt-3 text-3xl font-semibold">{value}</p>
          </div>
        ))}
      </div>
      <div className="panel p-6">
        <h2 className="text-xl font-semibold">Today’s focus</h2>
        <p className="mt-3 max-w-3xl text-slate-300">Review onboarding exceptions, clear screening queue, and inspect webhook failures before end of day.</p>
      </div>
      <div>
        <h2 className="text-xl font-semibold mb-4">Dataset Usage (This Month)</h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {datasetCards.map(([label, value]) => (
            <div key={label} className="panel p-5">
              <p className="text-sm text-slate-400">{label}</p>
              <p className="mt-3 text-3xl font-semibold">{value}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

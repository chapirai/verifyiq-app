const alerts = [
  ['ALT-301', 'Board member changed', 'Company monitoring'],
  ['ALT-302', 'Status updated', 'Registry monitoring'],
];

export default function MonitoringPage() {
  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm text-slate-400">Ongoing due diligence</p>
        <h1 className="text-3xl font-semibold">Monitoring alerts</h1>
      </div>
      <div className="grid gap-4">
        {alerts.map(([id, title, type]) => (
          <div key={id} className="panel p-5">
            <p className="text-sm text-slate-400">{id} · {type}</p>
            <h2 className="mt-1 text-xl font-medium">{title}</h2>
          </div>
        ))}
      </div>
    </section>
  );
}

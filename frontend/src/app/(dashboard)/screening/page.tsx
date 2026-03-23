const matches = [
  ['SCR-2001', 'Potential sanctions match', 'High'],
  ['SCR-2002', 'PEP media mention', 'Medium'],
];

export default function ScreeningPage() {
  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm text-slate-400">Queue</p>
        <h1 className="text-3xl font-semibold">Screening review</h1>
      </div>
      <div className="panel p-0 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-900/70 text-sm text-slate-400">
            <tr>
              <th className="px-4 py-3">Case</th>
              <th className="px-4 py-3">Finding</th>
              <th className="px-4 py-3">Severity</th>
            </tr>
          </thead>
          <tbody>
            {matches.map(([id, finding, severity]) => (
              <tr key={id} className="border-t border-border">
                <td className="px-4 py-3">{id}</td>
                <td className="px-4 py-3">{finding}</td>
                <td className="px-4 py-3">{severity}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

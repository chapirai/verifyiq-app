const companies = [
  ['556000-0001', 'Nordic Example AB', 'Active'],
  ['556000-0002', 'Baltic Compliance AB', 'Pending refresh'],
];

export default function CompaniesPage() {
  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm text-slate-400">Registry</p>
        <h1 className="text-3xl font-semibold">Company profiles</h1>
      </div>
      <div className="panel overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-900/70 text-sm text-slate-400">
            <tr>
              <th className="px-4 py-3">Org no.</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {companies.map(([org, name, status]) => (
              <tr key={org} className="border-t border-border">
                <td className="px-4 py-3">{org}</td>
                <td className="px-4 py-3">{name}</td>
                <td className="px-4 py-3">{status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

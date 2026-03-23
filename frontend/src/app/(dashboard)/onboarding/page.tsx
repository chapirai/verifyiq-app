const cases = [
  ['ONB-1001', 'Nordic Example AB', 'EDD review'],
  ['ONB-1002', 'Anna Svensson', 'Awaiting documents'],
];

export default function OnboardingPage() {
  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm text-slate-400">Workflow</p>
        <h1 className="text-3xl font-semibold">Onboarding cases</h1>
      </div>
      <div className="grid gap-4">
        {cases.map(([id, subject, state]) => (
          <div key={id} className="panel p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">{id}</p>
                <h2 className="mt-1 text-xl font-medium">{subject}</h2>
              </div>
              <span className="rounded-full border border-slate-700 px-3 py-1 text-sm text-slate-200">{state}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

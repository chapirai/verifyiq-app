export default function CompanyCasesPage() {
  return (
    <section className="space-y-8">
      <div>
        <p className="text-sm text-slate-400">Legal</p>
        <h1 className="text-3xl font-semibold">Company Legal Cases</h1>
        <p className="mt-2 text-slate-400">Official company matters, legal events, and business prohibitions</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <div className="panel p-6">
          <h2 className="text-xl font-semibold">Company Cases / Företagsärenden</h2>
          <p className="mt-3 text-slate-300">Official cases registered with Bolagsverket including reconstructions and liquidations.</p>
        </div>
        <div className="panel p-6">
          <h2 className="text-xl font-semibold">Business Prohibitions / Näringsförbud</h2>
          <p className="mt-3 text-slate-300">Active and historical business prohibitions for individuals associated with the company.</p>
        </div>
        <div className="panel p-6">
          <h2 className="text-xl font-semibold">Legal Event History</h2>
          <p className="mt-3 text-slate-300">Timeline of material legal and regulatory events affecting the company.</p>
        </div>
      </div>
    </section>
  );
}

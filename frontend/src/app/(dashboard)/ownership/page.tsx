export default function OwnershipPage() {
  return (
    <section className="space-y-8">
      <div>
        <p className="text-sm text-slate-400">Corporate structure</p>
        <h1 className="text-3xl font-semibold">Ownership &amp; Corporate Structure</h1>
        <p className="mt-2 text-slate-400">Manage ownership links, beneficial owners, and workplaces</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <div className="panel p-6">
          <h2 className="text-xl font-semibold">Ownership Links</h2>
          <p className="mt-3 text-slate-300">Person-to-company and company-to-company ownership structures including share percentages and voting rights.</p>
        </div>
        <div className="panel p-6">
          <h2 className="text-xl font-semibold">Beneficial Owners / Verklig Huvudman</h2>
          <p className="mt-3 text-slate-300">UBO records including alternative beneficial owners as registered with Bolagsverket.</p>
        </div>
        <div className="panel p-6">
          <h2 className="text-xl font-semibold">Workplaces / Arbetsställen</h2>
          <p className="mt-3 text-slate-300">CFAR-registered workplace locations linked to the company.</p>
        </div>
      </div>
    </section>
  );
}

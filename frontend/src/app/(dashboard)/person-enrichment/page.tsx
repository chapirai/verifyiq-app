export default function PersonEnrichmentPage() {
  return (
    <section className="space-y-8">
      <div>
        <p className="text-sm text-slate-400">KYC</p>
        <h1 className="text-3xl font-semibold">Person Enrichment</h1>
        <p className="mt-2 text-slate-400">Population register and KYC person data (subject to data permissions)</p>
      </div>
      <div className="panel p-5 border-l-4 border-yellow-500">
        <p className="text-slate-300">Sensitive person data is subject to strict permissioning, masking, and audit controls.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <div className="panel p-6">
          <h2 className="text-xl font-semibold">Person Records</h2>
          <p className="mt-3 text-slate-300">Enriched person data sourced from Folkbokföringsregistret including address and civil status.</p>
        </div>
        <div className="panel p-6">
          <h2 className="text-xl font-semibold">Board Assignments</h2>
          <p className="mt-3 text-slate-300">All company roles linked to a person across all registered entities.</p>
        </div>
        <div className="panel p-6">
          <h2 className="text-xl font-semibold">Compliance Checks</h2>
          <p className="mt-3 text-slate-300">Business prohibition, sanctions, and PEP status per person.</p>
        </div>
      </div>
    </section>
  );
}

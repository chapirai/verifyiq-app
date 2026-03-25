export default function FinancialPage() {
  return (
    <section className="space-y-8">
      <div>
        <p className="text-sm text-slate-400">Finance</p>
        <h1 className="text-3xl font-semibold">Financial Information &amp; Ratings</h1>
        <p className="mt-2 text-slate-400">Company financial statements, credit ratings, and trends</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <div className="panel p-6">
          <h2 className="text-xl font-semibold">Financial Statements</h2>
          <p className="mt-3 text-slate-300">Annual reports, fiscal year data, and P&amp;L summary sourced from official filings.</p>
        </div>
        <div className="panel p-6">
          <h2 className="text-xl font-semibold">Credit Ratings</h2>
          <p className="mt-3 text-slate-300">Current and historical ratings from external providers including Creditsafe and UC.</p>
        </div>
        <div className="panel p-6">
          <h2 className="text-xl font-semibold">Financial Trends</h2>
          <p className="mt-3 text-slate-300">Revenue, equity, and result trends over time for longitudinal analysis.</p>
        </div>
      </div>
    </section>
  );
}

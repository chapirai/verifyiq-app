export default function HelpPage() {
  return (
    <section className="space-y-8">
      <header className="space-y-3">
        <p className="mono-label text-[10px] text-muted-foreground">Workspace guide</p>
        <h1 className="font-display text-5xl">Admin user guide</h1>
        <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
          This guide explains where to click in the app and what each page is used for. It includes the exact admin
          flow for triggering Bolagsverket weekly bulk ZIP download, unzip/parse, and ingestion.
        </p>
      </header>

      <article className="border-2 border-foreground p-6 space-y-3">
        <h2 className="font-display text-3xl">Prerequisites (admin-only actions)</h2>
        <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
          <li>Your user role must be <code>admin</code>.</li>
          <li>Your user <code>tenant_id</code> must match <code>BV_BULK_PLATFORM_ADMIN_TENANT_ID</code> if that env var is set.</li>
          <li>
            Bulk env vars must be configured in backend:
            <code> BV_BULK_WEEKLY_ENABLED=true</code> and a valid <code>BV_BULK_WEEKLY_URL</code>.
          </li>
        </ul>
      </article>

      <article className="border-2 border-foreground p-6 space-y-3">
        <h2 className="font-display text-3xl">How to trigger full BV bulk ingestion</h2>
        <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
          <li>Open sidebar item <strong>Overview</strong> (route <code>/dashboard</code>).</li>
          <li>Find panel <strong>Operations dashboard</strong> (only visible for platform admin).</li>
          <li>
            Click <strong>Force download + full ingest</strong>. This starts:
            download ZIP -&gt; extract TXT -&gt; parse -&gt; apply upserts.
          </li>
          <li>
            Monitor status in the same panel:
            <strong>Weekly runs</strong>, <strong>Run health trend</strong>, and <strong>API calls daily</strong>.
          </li>
          <li>
            Optional: in <code>/companies/workspace/&lt;orgNumber&gt;</code>, use admin block button
            <strong> Ingest latest bulk file</strong>.
          </li>
        </ol>
      </article>

      <article className="border-2 border-foreground p-6 space-y-4">
        <h2 className="font-display text-3xl">Page-by-page usage</h2>
        <div className="space-y-4 text-sm text-muted-foreground">
          <p><strong>Overview</strong> (<code>/dashboard</code>) - operational KPIs, runtime safety, exports, and admin bulk controls.</p>
          <p><strong>Company lookup</strong> (<code>/search</code>) - search entities, start deep lookup, move to company workspace.</p>
          <p><strong>Companies</strong> (<code>/companies</code>) - browse indexed companies, open detailed workspace per org.</p>
          <p><strong>Lists</strong> (<code>/lists</code>) - create and maintain target lists, bulk add/remove organisations.</p>
          <p><strong>Compare</strong> (<code>/compare</code>) - compare shortlisted companies side-by-side.</p>
          <p><strong>Alerts</strong> (<code>/alerts</code>) - monitor changes, review alert feed, acknowledge and track.</p>
          <p><strong>Bulk</strong> (<code>/bulk</code>) - run file-based enrichment jobs and inspect per-row outcomes.</p>
          <p><strong>Billing</strong> (<code>/billing</code>) - view current plan/path, start checkout, open Stripe billing portal.</p>
          <p><strong>API access</strong> (<code>/api-keys</code>) - create/revoke API keys for live or sandbox use.</p>
          <p><strong>OAuth</strong> (<code>/api-oauth-clients</code>) - create/revoke machine clients and scopes.</p>
          <p><strong>Sandbox</strong> (<code>/api-sandbox</code>) - test API connectivity and sandbox credentials.</p>
          <p><strong>Settings</strong> (<code>/settings</code>) - verify active user/tenant context and profile details.</p>
        </div>
      </article>

      <article className="border-2 border-foreground p-6 space-y-3">
        <h2 className="font-display text-3xl">Company workspace (deep operations)</h2>
        <p className="text-sm text-muted-foreground">
          Open from Companies/Search into <code>/companies/workspace/&lt;orgNumber&gt;</code>. Use tabs/cards for ownership, annual
          reports, risk, source diagnostics, and decision support outputs. Admin users also get bulk-ingest shortcut controls.
        </p>
      </article>
    </section>
  );
}

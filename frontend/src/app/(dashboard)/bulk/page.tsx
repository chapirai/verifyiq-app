'use client';

import { useEffect, useState } from 'react';
import { SectionHeader } from '@/components/section-header';
import { api } from '@/lib/api';

export default function BulkPage() {
  const [input, setInput] = useState('');
  const [jobs, setJobs] = useState<Array<{ id: string; status: string; rowsTotal: number; rowsProcessed: number }>>(
    [],
  );
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    try {
      setJobs(await api.listBulkJobs());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load jobs.');
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function createJob() {
    const identifiers = input
      .split('\n')
      .map((v) => v.trim())
      .filter(Boolean);
    if (!identifiers.length) return;
    try {
      await api.createBulkJob({ fileName: `manual-${Date.now()}.txt`, identifiers });
      setInput('');
      await refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create job.');
    }
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Bulk processing"
        title="Queue and track bulk lookups"
        description="Submit many identifiers, monitor status, and process work asynchronously."
      />
      {error ? <div className="alert-error">{error}</div> : null}
      <section className="panel space-y-4 p-6">
        <textarea
          className="textarea-ui"
          placeholder="One identifier per line"
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <button className="primary-btn" onClick={() => void createJob()} type="button">
          Start bulk job
        </button>
      </section>
      <section className="panel p-6">
        <h2 className="mb-3 text-lg font-semibold">Recent jobs</h2>
        <div className="space-y-2 text-sm">
          {jobs.map((job) => (
            <div key={job.id} className="rounded-xl border border-border bg-muted/40 px-4 py-3">
              <p className="font-mono">{job.id}</p>
              <p className="text-muted-foreground">
                {job.status} - {job.rowsProcessed}/{job.rowsTotal}
              </p>
            </div>
          ))}
          {!jobs.length ? <p className="text-muted-foreground">No jobs yet.</p> : null}
        </div>
      </section>
    </div>
  );
}

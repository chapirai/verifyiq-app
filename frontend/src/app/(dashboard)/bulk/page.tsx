'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export default function BulkPage() {
  const [fileName, setFileName] = useState('portfolio.csv');
  const [rowsTotal, setRowsTotal] = useState(100);
  const [jobs, setJobs] = useState<Array<{ id: string; fileName: string; rowsTotal: number; rowsProcessed: number; status: string; createdAt: string }>>([]);
  const [error, setError] = useState('');

  async function refresh() {
    try {
      setJobs(await api.listBulkJobs());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load bulk jobs');
    }
  }

  async function createJob() {
    try {
      await api.createBulkJob({ fileName, rowsTotal });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create job');
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm text-slate-400">Bulk Processing</p>
        <h1 className="text-3xl font-semibold">Portfolio Uploads</h1>
      </div>
      <div className="panel p-6">
        <div className="grid gap-3 md:grid-cols-3">
          <input value={fileName} onChange={(e) => setFileName(e.target.value)} className="rounded-xl border border-border bg-background px-3 py-2" />
          <input type="number" value={rowsTotal} onChange={(e) => setRowsTotal(Number(e.target.value))} className="rounded-xl border border-border bg-background px-3 py-2" />
          <button onClick={createJob} className="rounded-xl bg-indigo-600 px-4 py-2 font-medium">Queue job</button>
        </div>
      </div>
      <div className="panel p-6">
        <h2 className="text-lg font-semibold">Recent jobs</h2>
        <div className="mt-3 space-y-2">
          {jobs.map((job) => (
            <div key={job.id} className="rounded-lg border border-border p-3">
              <p className="font-medium">{job.fileName}</p>
              <p className="text-xs text-slate-400">Rows: {job.rowsProcessed}/{job.rowsTotal} • Status: {job.status}</p>
            </div>
          ))}
        </div>
      </div>
      {error ? <p className="text-sm text-red-400">{error}</p> : null}
    </section>
  );
}

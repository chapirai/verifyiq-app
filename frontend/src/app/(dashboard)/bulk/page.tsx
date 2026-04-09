'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';

export default function BulkPage() {
  const [fileName, setFileName] = useState('portfolio.csv');
  const [identifiersText, setIdentifiersText] = useState('5560000001\n5565595450');
  const [jobs, setJobs] = useState<Array<{ id: string; fileName: string; rowsTotal: number; rowsProcessed: number; successCount?: number; failedCount?: number; remainingCount?: number; status: string; createdAt: string }>>([]);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [selectedItems, setSelectedItems] = useState<Array<{ id: string; identifier: string; status: string; attemptCount: number; errorReason: string | null }>>([]);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    try {
      const nextJobs = await api.listBulkJobs();
      setJobs(nextJobs);
      if (!selectedJobId && nextJobs.length > 0) {
        setSelectedJobId(nextJobs[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load bulk jobs');
    }
  }, [selectedJobId]);

  async function createJob() {
    try {
      const identifiers = identifiersText
        .split(/\r?\n|,|;|\s+/)
        .map((x) => x.trim())
        .filter(Boolean);
      const created = await api.createBulkJob({ fileName, identifiers });
      setSelectedJobId(created.id);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create job');
    }
  }

  async function refreshItems(jobId: string) {
    try {
      const items = await api.listBulkJobItems(jobId);
      setSelectedItems(
        items.map((item) => ({
          id: item.id,
          identifier: item.identifier,
          status: item.status,
          attemptCount: item.attemptCount,
          errorReason: item.errorReason,
        })),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load job items');
    }
  }

  async function retryFailed() {
    if (!selectedJobId) return;
    try {
      await api.retryFailedBulkItems(selectedJobId);
      await refresh();
      await refreshItems(selectedJobId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Retry failed');
    }
  }

  async function downloadResults() {
    if (!selectedJobId) return;
    try {
      const { blob, fileName: name } = await api.downloadBulkResults(selectedJobId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Download failed');
    }
  }

  useEffect(() => {
    void refresh();
    const interval = setInterval(() => {
      void refresh();
      if (selectedJobId) {
        void refreshItems(selectedJobId);
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [refresh, selectedJobId]);

  useEffect(() => {
    if (selectedJobId) {
      void refreshItems(selectedJobId);
    } else {
      setSelectedItems([]);
    }
  }, [selectedJobId]);

  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm text-slate-400">Bulk Processing</p>
        <h1 className="text-3xl font-semibold">Portfolio Uploads</h1>
      </div>
      <div className="panel p-6">
        <div className="space-y-3">
          <input value={fileName} onChange={(e) => setFileName(e.target.value)} className="rounded-xl border border-border bg-background px-3 py-2" />
          <textarea
            value={identifiersText}
            onChange={(e) => setIdentifiersText(e.target.value)}
            rows={6}
            className="w-full rounded-xl border border-border bg-background px-3 py-2 font-mono text-sm"
            placeholder="One org number per line"
          />
          <button onClick={createJob} className="rounded-xl bg-indigo-600 px-4 py-2 font-medium">Queue job</button>
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
      <div className="panel p-6">
        <h2 className="text-lg font-semibold">Recent jobs</h2>
        <div className="mt-3 space-y-2">
          {jobs.map((job) => (
            <button key={job.id} onClick={() => setSelectedJobId(job.id)} className={`w-full rounded-lg border p-3 text-left ${selectedJobId === job.id ? 'border-indigo-500' : 'border-border'}`}>
              <p className="font-medium">{job.fileName}</p>
              <p className="text-xs text-slate-400">Rows: {job.rowsProcessed}/{job.rowsTotal} • Success: {job.successCount ?? 0} • Failed: {job.failedCount ?? 0} • Remaining: {job.remainingCount ?? 0}</p>
              <p className="text-xs text-slate-400">Status: {job.status}</p>
            </button>
          ))}
        </div>
      </div>
      <div className="panel p-6">
        <div className="mb-3 flex gap-2">
          <button onClick={retryFailed} disabled={!selectedJobId} className="rounded-xl bg-amber-600 px-3 py-2 text-sm font-medium disabled:opacity-60">Retry failed</button>
          <button onClick={downloadResults} disabled={!selectedJobId} className="rounded-xl bg-slate-700 px-3 py-2 text-sm font-medium disabled:opacity-60">Download CSV</button>
        </div>
        <h2 className="text-lg font-semibold">Selected job items</h2>
        <div className="mt-3 max-h-[420px] space-y-2 overflow-auto">
          {selectedItems.map((item) => (
            <div key={item.id} className="rounded-lg border border-border p-3">
              <p className="font-mono text-sm">{item.identifier}</p>
              <p className="text-xs text-slate-400">Status: {item.status} • Attempts: {item.attemptCount}</p>
              {item.errorReason ? <p className="text-xs text-red-400">{item.errorReason}</p> : null}
            </div>
          ))}
          {selectedItems.length === 0 ? <p className="text-sm text-slate-400">No items yet.</p> : null}
        </div>
      </div>
      </div>
      {error ? <p className="text-sm text-red-400">{error}</p> : null}
    </section>
  );
}

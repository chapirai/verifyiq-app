'use client';

import { FormEvent, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { BulkJob } from '@/types/api';
import { Button } from '@/components/ui/Button';
import { EmptyState, ErrorState, LoadingSkeleton } from '@/components/ui/StateBlocks';
import { Table } from '@/components/ui/Table';
import { Textarea } from '@/components/ui/Textarea';
import { Input } from '@/components/ui/Input';

export default function BulkPage() {
  const [jobs, setJobs] = useState<BulkJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [fileName, setFileName] = useState('bulk-upload.csv');
  const [rows, setRows] = useState('5566778899\n5599001122');
  const [selectedJob, setSelectedJob] = useState<string>('');
  const [items, setItems] = useState<Array<{ identifier: string; status: string; errorReason?: string }>>([]);

  const load = () => {
    setLoading(true);
    api.listBulkJobs()
      .then((res) => setJobs(res.data))
      .catch((err: { message?: string }) => setError(err.message ?? 'Failed to load jobs'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  if (loading) return <LoadingSkeleton lines={7} />;
  if (error) return <ErrorState title="Bulk processing unavailable" message={error} />;

  const onCreate = async (event: FormEvent) => {
    event.preventDefault();
    const identifiers = rows
      .split(/\r?\n/)
      .map((x) => x.trim())
      .filter(Boolean);
    await api.createBulkJob({ fileName, rowsTotal: identifiers.length, identifiers });
    load();
  };

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-5xl">Bulk enrichment</h1>
      </div>
      <form onSubmit={onCreate} className="grid gap-3 border-2 border-foreground p-4">
        <Input value={fileName} onChange={(e) => setFileName(e.target.value)} placeholder="File name" required />
        <Textarea value={rows} onChange={(e) => setRows(e.target.value)} placeholder="One org number per line" />
        <Button type="submit" className="w-full md:w-auto">Create job</Button>
      </form>
      {jobs.length === 0 ? (
        <EmptyState title="No bulk jobs yet" description="Upload CSV/Excel flow is next; API bulk orchestration is now connected." />
      ) : (
        <>
          <Table>
            <thead><tr><th>File</th><th>Status</th><th>Processed</th><th>Failed</th><th>Created</th><th /></tr></thead>
            <tbody>
              {jobs.map((job) => (
                <tr key={job.id}>
                  <td>{job.fileName}</td>
                  <td>{job.status}</td>
                  <td>{job.rowsProcessed}/{job.rowsTotal}</td>
                  <td>{job.failedCount}</td>
                  <td>{new Date(job.createdAt).toLocaleString()}</td>
                  <td>
                    <div className="flex gap-3">
                      <button
                        className="underline underline-offset-4"
                        onClick={async () => {
                          setSelectedJob(job.id);
                          const list = await api.getBulkJobItems(job.id) as { data?: Array<{ identifier: string; status: string; errorReason?: string }> };
                          setItems(list.data ?? []);
                        }}
                      >
                        Inspect
                      </button>
                      {job.failedCount > 0 ? (
                        <button
                          className="underline underline-offset-4"
                          onClick={async () => {
                            await api.retryBulkFailures(job.id);
                            load();
                          }}
                        >
                          Retry failed
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
          <p className="text-sm text-muted-foreground">
            Bulk processing is intentionally sequential per company in the background due to Bolagsverket provider limits.
            Uploads are queued and processed one-by-one with retry support.
          </p>
          {selectedJob ? (
            <div className="space-y-3 border-2 border-foreground p-4">
              <div className="flex items-center justify-between">
                <p className="mono-label text-[10px]">Job items: {selectedJob}</p>
                <a className="underline underline-offset-4" href={api.getBulkCsvUrl(selectedJob)} target="_blank" rel="noreferrer">Download CSV</a>
              </div>
              <Table>
                <thead><tr><th>Identifier</th><th>Status</th><th>Error</th></tr></thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={`${item.identifier}-${item.status}`}>
                      <td>{item.identifier}</td>
                      <td>{item.status}</td>
                      <td>{item.errorReason ?? '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}

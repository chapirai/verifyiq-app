'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { CompanyListResponse } from '@/types/api';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { EmptyState, ErrorState, LoadingSkeleton } from '@/components/ui/StateBlocks';
import { Table } from '@/components/ui/Table';

export default function CompaniesPage() {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [result, setResult] = useState<CompanyListResponse | null>(null);

  const load = (search = query, nextPage = page, statusFilter = status) => {
    setLoading(true);
    setError('');
    const qs = new URLSearchParams({
      page: String(nextPage),
      limit: '20',
      sort_by: 'updatedAt',
      sort_dir: 'desc',
    });
    if (search) qs.set('q', search);
    if (statusFilter) qs.set('status', statusFilter);
    api.getCompanies(qs.toString())
      .then(setResult)
      .catch((err: { message?: string }) => setError(err.message ?? 'Failed to fetch companies'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    setLoading(true);
    setError('');
    const qs = new URLSearchParams({
      page: String(page),
      limit: '20',
      sort_by: 'updatedAt',
      sort_dir: 'desc',
    });
    if (query) qs.set('q', query);
    if (status) qs.set('status', status);
    api.getCompanies(qs.toString())
      .then(setResult)
      .catch((err: { message?: string }) => setError(err.message ?? 'Failed to fetch companies'))
      .finally(() => setLoading(false));
  }, [page, query, status]);

  return (
    <section className="space-y-6">
      <h1 className="font-display text-5xl">Companies</h1>
      <div className="grid gap-3 md:grid-cols-[1fr_180px_auto]">
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name or org number" />
        <Select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option value="ACTIVE">ACTIVE</option>
          <option value="INACTIVE">INACTIVE</option>
          <option value="LIQUIDATION">LIQUIDATION</option>
          <option value="BANKRUPT">BANKRUPT</option>
          <option value="DISSOLVED">DISSOLVED</option>
        </Select>
        <Button onClick={() => { setPage(1); load(query, 1, status); }}>Search</Button>
      </div>
      {loading ? <LoadingSkeleton lines={8} /> : null}
      {!loading && error ? <ErrorState title="Search error" message={error} /> : null}
      {!loading && !error && result && result.data.length === 0 ? (
        <EmptyState title="No companies found" description="Try broader criteria or run a direct lookup." />
      ) : null}
      {!loading && !error && result && result.data.length > 0 ? (
        <Table>
          <thead>
            <tr><th>Name</th><th>Org Number</th><th>Status</th><th /></tr>
          </thead>
          <tbody>
            {result.data.map((company) => (
              <tr key={company.id}>
                <td>{company.legalName}</td>
                <td>{company.organisationNumber}</td>
                <td>{company.status}</td>
                <td><Link href={`/companies/${company.id}`} className="underline underline-offset-4">View</Link></td>
              </tr>
            ))}
          </tbody>
        </Table>
      ) : null}
      {!loading && !error && result ? (
        <div className="flex items-center justify-between border-2 border-foreground p-3 text-sm">
          <p>Page {result.page} of {Math.max(1, Math.ceil(result.total / result.limit))}</p>
          <div className="flex gap-2">
            <Button variant="secondary" className="min-h-9 px-3 py-1 text-[10px]" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
            <Button variant="secondary" className="min-h-9 px-3 py-1 text-[10px]" disabled={!result.has_next} onClick={() => setPage((p) => p + 1)}>Next</Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

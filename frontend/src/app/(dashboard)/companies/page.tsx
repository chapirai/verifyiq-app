'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { SectionHeader } from '@/components/section-header';
import { api, type CompanyListItem } from '@/lib/api';

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<CompanyListItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const result = await api.listCompanies();
        setCompanies(result.data);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load companies.');
      }
    }
    void load();
  }, []);

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Companies"
        title="Tenant company registry"
        description="View companies stored in your workspace and open detailed profiles."
      />
      <section className="panel p-6">
        {error ? <p className="text-sm text-red-700">{error}</p> : null}
        <div className="space-y-2">
          {companies.map((company) => (
            <Link
              key={company.organisationNumber}
              className="block rounded-xl border border-border bg-muted/30 px-4 py-3 transition hover:border-accent/40"
              href={`/companies/${encodeURIComponent(company.organisationNumber)}`}
            >
              <p className="font-medium">{company.legalName || company.organisationNumber}</p>
              <p className="text-xs text-muted-foreground">{company.organisationNumber}</p>
            </Link>
          ))}
          {!companies.length ? <p className="text-sm text-muted-foreground">No companies found.</p> : null}
        </div>
      </section>
    </div>
  );
}

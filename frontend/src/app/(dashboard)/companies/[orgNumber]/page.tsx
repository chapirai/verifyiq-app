'use client';

import { useParams } from 'next/navigation';
import { useMemo } from 'react';
import { CompanyDetailsGrid } from '@/components/company/CompanyDetailsGrid';
import { CompanyHeader } from '@/components/company/CompanyHeader';
import { FreshnessPanel } from '@/components/company/FreshnessPanel';
import { SectionHeader } from '@/components/section-header';
import { useCompanyFreshness } from '@/hooks/use-company-freshness';
import { useCompanyLookup } from '@/hooks/use-company-lookup';

export default function CompanyProfilePage() {
  const params = useParams<{ orgNumber: string }>();
  const orgNumber = decodeURIComponent(params.orgNumber);
  const { data, loading, error } = useCompanyLookup(orgNumber);
  const freshness = useCompanyFreshness(orgNumber);

  const displayName = useMemo(
    () => data?.company?.legalName || orgNumber,
    [data?.company?.legalName, orgNumber],
  );

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Company profile"
        title={displayName}
        description="Detailed profile composed from normalized provider enrichment."
      />
      {loading ? <p className="text-sm text-muted-foreground">Loading company profile...</p> : null}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      {data ? (
        <>
          <CompanyHeader
            legalName={data.company?.legalName as string | undefined}
            orgNumber={data.company?.organisationNumber as string | undefined}
            status={data.company?.status as string | undefined}
            countryCode={data.company?.countryCode as string | undefined}
          />
          <FreshnessPanel
            data={freshness.data}
            loading={freshness.loading}
            error={freshness.error}
            onRetry={freshness.retry}
          />
          <CompanyDetailsGrid
            orgNumber={data.company?.organisationNumber as string | undefined}
            registeredAt={data.company?.registeredAt as string | undefined}
            companyForm={data.company?.companyForm as string | undefined}
            countryCode={data.company?.countryCode as string | undefined}
            businessDescription={data.company?.businessDescription as string | undefined}
          />
        </>
      ) : null}
    </div>
  );
}

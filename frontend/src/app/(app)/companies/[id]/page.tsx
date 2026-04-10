'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { isLikelyOrgNumberParam, normalizeIdentitetsbeteckning } from '@/lib/org-number';
import { Button } from '@/components/ui/Button';
import { LoadingSkeleton } from '@/components/ui/StateBlocks';

export default function CompanyLegacyIdPage({ params }: { params: { id: string } }) {
  const router = useRouter();

  useEffect(() => {
    if (isLikelyOrgNumberParam(params.id)) {
      router.replace(`/companies/workspace/${normalizeIdentitetsbeteckning(params.id)}`);
    }
  }, [params.id, router]);

  if (isLikelyOrgNumberParam(params.id)) {
    return <LoadingSkeleton lines={8} />;
  }

  return (
    <section className="space-y-6 border-2 border-foreground p-8">
      <p className="mono-label text-[10px]">Company by database ID</p>
      <h1 className="font-display text-4xl">This route expects an organisation number</h1>
      <p className="text-muted-foreground">
        The backend does not yet expose GET /companies/:id for profile data. Open the workspace by{' '}
        <strong>10- or 12-digit identitetsbeteckning</strong> (with or without dashes).
      </p>
      <div className="flex flex-wrap gap-3">
        <Button href="/search" variant="primary">
          Go to lookup
        </Button>
        <Button href="/companies" variant="secondary">
          Company list
        </Button>
      </div>
      <p className="font-mono text-sm">
        Tip: from the list, use <strong>View</strong> — it now opens{' '}
        <code className="border border-foreground px-1">/companies/workspace/&lt;org&gt;</code>.
      </p>
    </section>
  );
}

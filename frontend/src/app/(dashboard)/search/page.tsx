'use client';

import { useRouter } from 'next/navigation';
import type { Route } from 'next';
import SearchForm from '@/components/SearchForm';
import { SectionHeader } from '@/components/section-header';

export default function SearchPage() {
  const router = useRouter();

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Search"
        title="Lookup companies by identifier"
        description="Run direct lookups for Swedish organization numbers and personnummer."
      />
      <SearchForm
        onSearch={(identifier) =>
          router.push((`/search/results?q=${encodeURIComponent(identifier)}` as unknown) as Route)
        }
      />
    </div>
  );
}

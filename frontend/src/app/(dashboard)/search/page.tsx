'use client';

import { useState } from 'react';
import SearchForm from '@/components/SearchForm';

export default function SearchPage() {
  const [lastSearch, setLastSearch] = useState<string | null>(null);

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div>
        <p className="text-sm text-slate-400">Company Lookup</p>
        <h1 className="mt-1 text-3xl font-semibold">Company Search</h1>
        <p className="mt-2 text-sm text-slate-400">
          Search for a Swedish company by its 12-digit organisation number to initiate a KYC lookup.
        </p>
      </div>

      {/* Search form */}
      <SearchForm onSearch={setLastSearch} />

      {/* Acknowledgement / next step */}
      {lastSearch && (
        <div className="rounded-2xl border border-indigo-800 bg-indigo-900/20 p-6">
          <p className="text-sm text-indigo-300">
            Lookup initiated for organisation number{' '}
            <span className="font-mono font-medium text-white">{lastSearch}</span>.
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Full enrichment results will be available once the backend lookup is wired up.
          </p>
        </div>
      )}
    </div>
  );
}

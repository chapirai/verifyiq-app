'use client';

import { useState, useCallback } from 'react';
import {
  classifyIdentifier,
  validateIdentifier,
  identifierError,
  IDENTIFIER_TYPE_LABELS,
} from '@/utils/validation/validateIdentifier';
import { useRecentSearches, type RecentSearchEntry } from '@/hooks/use-recent-searches';

interface SearchFormProps {
  onSearch: (identifier: string) => void;
  loading?: boolean;
}

// ─── Small presentational helpers ────────────────────────────────────────────

function FreshnessDot({ freshness }: { freshness: 'fresh' | 'stale' | 'expired' }) {
  const colorClass =
    freshness === 'fresh'
      ? 'bg-emerald-400'
      : freshness === 'stale'
        ? 'bg-yellow-400'
        : 'bg-red-400';
  return (
    <span
      className={`h-1.5 w-1.5 rounded-full ${colorClass}`}
      aria-label={`Freshness: ${freshness}`}
      role="img"
    />
  );
}

function SourceLabel({ source }: { source: 'DB' | 'API' }) {
  const isDB = source === 'DB';
  const label = isDB ? 'Database cache' : 'Live API';
  return (
    <span
      className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
        isDB ? 'bg-emerald-900/60 text-emerald-300' : 'bg-blue-900/60 text-blue-300'
      }`}
      title={label}
      aria-label={`Source: ${label}`}
    >
      {isDB ? 'DB' : 'API'}
    </span>
  );
}

function RecentSearchItem({
  entry,
  onClick,
}: {
  entry: RecentSearchEntry;
  onClick: (identifier: string) => void;
}) {
  const metaSummary = entry.metadata
    ? ` — ${entry.metadata.freshness} data from ${entry.metadata.source === 'DB' ? 'database cache' : 'live API'}`
    : '';
  return (
    <li>
      <button
        type="button"
        onClick={() => onClick(entry.identifier)}
        aria-label={`Search for company ${entry.identifier}${metaSummary}`}
        className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5 transition hover:border-indigo-500 hover:text-white"
      >
        <span className="font-mono text-xs text-slate-300">{entry.identifier}</span>
        {entry.metadata && (
          <span className="flex items-center gap-1" aria-hidden="true">
            <FreshnessDot freshness={entry.metadata.freshness} />
            <SourceLabel source={entry.metadata.source} />
          </span>
        )}
      </button>
    </li>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function SearchForm({ onSearch, loading = false }: SearchFormProps) {
  const [value, setValue] = useState('');
  const [touched, setTouched] = useState(false);
  const { searches, addSearch, clearSearches } = useRecentSearches();

  const isValid = validateIdentifier(value);
  const identifierType = classifyIdentifier(value);
  const error = touched ? identifierError(value) : null;

  const handleSubmit = useCallback(() => {
    if (!isValid || loading) return;
    addSearch(value.trim());
    onSearch(value.trim());
  }, [isValid, loading, value, addSearch, onSearch]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        setTouched(true);
        handleSubmit();
      }
    },
    [handleSubmit],
  );

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setValue(e.target.value);
  }, []);

  const handleBlur = useCallback(() => {
    setTouched(true);
  }, []);

  const handleRecentClick = useCallback(
    (identifier: string) => {
      setValue(identifier);
      setTouched(true);
      addSearch(identifier);
      onSearch(identifier);
    },
    [addSearch, onSearch],
  );

  return (
    <div className="space-y-6">
      {/* Search input */}
      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label
              htmlFor="identifier-input"
              className="mb-1 block text-xs uppercase tracking-widest text-slate-400"
            >
              Swedish Organisation Number or Personnummer
            </label>
            <input
              id="identifier-input"
              type="text"
              value={value}
              onChange={handleChange}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
              placeholder="e.g. 5560000001 or 197001011234"
              autoComplete="off"
              spellCheck={false}
              className={[
                'w-full rounded-xl border bg-background px-4 py-2.5 text-sm text-white placeholder-slate-500 transition',
                'focus:outline-none focus:ring-2',
                error
                  ? 'border-red-500 focus:ring-red-500/50'
                  : isValid
                    ? 'border-emerald-500 focus:ring-emerald-500/50'
                    : 'border-border focus:ring-indigo-500',
              ].join(' ')}
            />
            {error && <p className="mt-1.5 text-xs text-red-400">{error}</p>}
            {!error && isValid && (
              <p className="mt-1.5 text-xs text-emerald-400">
                ✓ Valid {IDENTIFIER_TYPE_LABELS[identifierType]}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              setTouched(true);
              handleSubmit();
            }}
            disabled={!isValid || loading}
            className="rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? 'Searching…' : 'Search'}
          </button>
        </div>

        <p className="mt-3 text-xs text-slate-500">
          Enter a 10-digit or 12-digit Swedish organisation number, or a 12-digit personnummer.
        </p>
      </div>

      {/* Recent searches */}
      {searches.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-6">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400">
              Recent Searches
            </h3>
            <button
              type="button"
              onClick={clearSearches}
              className="text-xs text-slate-500 transition hover:text-slate-300"
            >
              Clear
            </button>
          </div>
          <ul className="flex flex-wrap gap-2">
            {searches.map((entry) => (
              <RecentSearchItem
                key={entry.identifier}
                entry={entry}
                onClick={handleRecentClick}
              />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

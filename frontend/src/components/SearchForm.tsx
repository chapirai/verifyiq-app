'use client';

import { useState, useCallback } from 'react';
import { validateOrgNumber, orgNumberError } from '@/utils/validation/validateOrgNumber';
import { useRecentSearches } from '@/hooks/use-recent-searches';

interface SearchFormProps {
  onSearch: (orgNumber: string) => void;
  loading?: boolean;
}

export default function SearchForm({ onSearch, loading = false }: SearchFormProps) {
  const [value, setValue] = useState('');
  const [touched, setTouched] = useState(false);
  const { searches, addSearch, clearSearches } = useRecentSearches();

  const isValid = validateOrgNumber(value);
  const error = touched ? orgNumberError(value) : null;

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
    (recent: string) => {
      setValue(recent);
      setTouched(true);
      addSearch(recent);
      onSearch(recent);
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
              htmlFor="org-number-input"
              className="mb-1 block text-xs uppercase tracking-widest text-slate-400"
            >
              Swedish Organisation Number
            </label>
            <input
              id="org-number-input"
              type="text"
              value={value}
              onChange={handleChange}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
              placeholder="e.g. 202100123456"
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
              <p className="mt-1.5 text-xs text-emerald-400">✓ Valid organisation number</p>
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
          Enter a 12-digit Swedish organisation number (NNNNNNNNNNNN or with optional hyphen/space
          separator).
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
            {searches.map((recent) => (
              <li key={recent}>
                <button
                  type="button"
                  onClick={() => handleRecentClick(recent)}
                  className="rounded-lg border border-border bg-background px-3 py-1.5 font-mono text-xs text-slate-300 transition hover:border-indigo-500 hover:text-white"
                >
                  {recent}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

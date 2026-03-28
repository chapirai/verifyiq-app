'use client';

import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'verifyiq:recent-searches';
const MAX_ENTRIES = 10;

/** Backend-provided provenance metadata attached to a recent search entry. */
export interface RecentSearchMetadata {
  source: 'DB' | 'API';
  freshness: 'fresh' | 'stale' | 'expired';
  fetched_at: string;
  age_days: number;
}

/** A single entry in the recent searches list. */
export interface RecentSearchEntry {
  identifier: string;
  searchedAt: string;
  metadata?: RecentSearchMetadata;
}

/** Type guard: checks whether a value looks like a RecentSearchEntry. */
function isRecentSearchEntry(v: unknown): v is RecentSearchEntry {
  return (
    typeof v === 'object' &&
    v !== null &&
    typeof (v as RecentSearchEntry).identifier === 'string' &&
    typeof (v as RecentSearchEntry).searchedAt === 'string'
  );
}

/** Migrate legacy plain-string entries to the structured format. */
function migrateEntry(v: unknown): RecentSearchEntry | null {
  if (typeof v === 'string' && v.trim()) {
    return { identifier: v.trim(), searchedAt: new Date().toISOString() };
  }
  if (isRecentSearchEntry(v)) return v;
  return null;
}

export function useRecentSearches() {
  const [searches, setSearches] = useState<RecentSearchEntry[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const entries = parsed.map(migrateEntry).filter((e): e is RecentSearchEntry => e !== null);
          setSearches(entries);
        }
      }
    } catch {
      // Ignore parse errors – treat as empty
    }
  }, []);

  const addSearch = useCallback((identifier: string, metadata?: RecentSearchMetadata) => {
    const trimmed = identifier.trim();
    if (!trimmed) return;
    setSearches((prev) => {
      const entry: RecentSearchEntry = {
        identifier: trimmed,
        searchedAt: new Date().toISOString(),
        ...(metadata ? { metadata } : {}),
      };
      const deduped = [entry, ...prev.filter((s) => s.identifier !== trimmed)].slice(
        0,
        MAX_ENTRIES,
      );
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(deduped));
      } catch {
        // Ignore storage errors (e.g. private browsing quota)
      }
      return deduped;
    });
  }, []);

  /** Update the metadata for an existing entry (called after API response returns). */
  const updateSearchMetadata = useCallback((identifier: string, metadata: RecentSearchMetadata) => {
    const trimmed = identifier.trim();
    if (!trimmed) return;
    setSearches((prev) => {
      const updated = prev.map((s) =>
        s.identifier === trimmed ? { ...s, metadata } : s,
      );
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch {
        // Ignore
      }
      return updated;
    });
  }, []);

  const clearSearches = useCallback(() => {
    setSearches([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore
    }
  }, []);

  return { searches, addSearch, updateSearchMetadata, clearSearches };
}

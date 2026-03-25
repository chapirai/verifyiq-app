'use client';

import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'verifyiq:recent-searches';
const MAX_ENTRIES = 10;

export function useRecentSearches() {
  const [searches, setSearches] = useState<string[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setSearches(parsed.filter((v): v is string => typeof v === 'string'));
        }
      }
    } catch {
      // Ignore parse errors – treat as empty
    }
  }, []);

  const addSearch = useCallback((value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    setSearches((prev) => {
      const deduped = [trimmed, ...prev.filter((s) => s !== trimmed)].slice(0, MAX_ENTRIES);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(deduped));
      } catch {
        // Ignore storage errors (e.g. private browsing quota)
      }
      return deduped;
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

  return { searches, addSearch, clearSearches };
}

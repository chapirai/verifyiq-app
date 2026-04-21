'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { normalizeIdentitetsbeteckning } from '@/lib/org-number';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { EmptyState, ErrorState } from '@/components/ui/StateBlocks';
import { Table } from '@/components/ui/Table';
import type { TargetList } from '@/types/target-lists';

type SearchRow = {
  id: string;
  legalName: string;
  organisationNumber: string;
  status: string;
};

export default function ListsPage() {
  const searchParams = useSearchParams();
  const [lists, setLists] = useState<TargetList[]>([]);
  const [activeListId, setActiveListId] = useState<string>('');
  const [newListName, setNewListName] = useState('');
  const [query, setQuery] = useState('');
  const [searchRows, setSearchRows] = useState<SearchRow[]>([]);
  const [searchError, setSearchError] = useState('');
  const [listsLoading, setListsLoading] = useState(true);
  const [listsError, setListsError] = useState('');

  const loadLists = async () => {
    setListsLoading(true);
    setListsError('');
    try {
      const loaded = await api.listTargetLists();
      setLists(loaded);
      setActiveListId((current) => {
        if (current && loaded.some((l) => l.id === current)) return current;
        return loaded[0]?.id ?? '';
      });
    } catch (e) {
      setListsError(e instanceof Error ? e.message : 'Could not load lists');
      setLists([]);
    } finally {
      setListsLoading(false);
    }
  };

  useEffect(() => {
    void loadLists();
  }, []);

  const activeList = useMemo(() => lists.find((x) => x.id === activeListId) ?? null, [lists, activeListId]);

  const compareListHref = useMemo(() => {
    if (!activeList || activeList.organisationNumbers.length < 2) return '';
    const orgs = activeList.organisationNumbers.slice(0, 8).join(',');
    return `/compare?orgs=${encodeURIComponent(orgs)}`;
  }, [activeList]);

  const createList = async () => {
    const name = newListName.trim();
    if (!name) return;
    const created = await api.createTargetList(name);
    await loadLists();
    setActiveListId(created.id);
    setNewListName('');
  };

  const removeList = async (id: string) => {
    await api.deleteTargetList(id);
    await loadLists();
    if (activeListId === id) setActiveListId('');
  };

  const addOrgToActiveList = async (org: string) => {
    if (!activeList) return;
    const norm = normalizeIdentitetsbeteckning(org);
    if (!norm) return;
    await api.addTargetListItem(activeList.id, norm);
    await loadLists();
  };

  const removeOrgFromActiveList = async (org: string) => {
    if (!activeList) return;
    await api.removeTargetListItem(activeList.id, org);
    await loadLists();
  };

  const runSearch = async () => {
    const q = query.trim();
    if (!q) return;
    setSearchError('');
    try {
      const qs = new URLSearchParams({
        q,
        page: '1',
        limit: '10',
        sort_by: 'updatedAt',
        sort_dir: 'desc',
      });
      const res = await api.getCompanies(qs.toString());
      setSearchRows(res.data as SearchRow[]);
    } catch (e) {
      setSearchRows([]);
      setSearchError(e instanceof Error ? e.message : 'Search failed');
    }
  };

  useEffect(() => {
    const org = normalizeIdentitetsbeteckning(searchParams.get('addOrg') ?? '');
    if (!activeList || (org.length !== 10 && org.length !== 12)) return;
    void addOrgToActiveList(org);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeList?.id, searchParams]);

  return (
    <section className="space-y-6">
      <h1 className="font-display text-5xl">Target lists</h1>
      <p className="max-w-3xl text-sm text-muted-foreground">
        Build analyst lists for pipeline prioritization. Lists store organisation numbers and can be used for compare and monitoring workflows.
      </p>

      {listsLoading ? <p className="text-sm text-muted-foreground">Loading lists…</p> : null}
      {listsError ? <ErrorState title="Lists unavailable" message={listsError} /> : null}

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <article className="space-y-3 border-2 border-foreground p-4">
          <p className="mono-label text-[10px]">Create list</p>
          <div className="flex gap-2">
            <Input value={newListName} onChange={(e) => setNewListName(e.target.value)} placeholder="e.g. Industrial carve-outs" />
            <Button type="button" onClick={() => void createList()}>Add</Button>
          </div>
          {lists.length === 0 ? (
            <EmptyState title="No lists yet" description="Create your first list to start building a target pipeline." />
          ) : (
            <ul className="space-y-2">
              {lists.map((list) => (
                <li key={list.id} className={`border p-2 ${activeListId === list.id ? 'border-foreground bg-muted/40' : 'border-border-light'}`}>
                  <button type="button" className="w-full text-left" onClick={() => setActiveListId(list.id)}>
                    <p className="text-sm font-medium">{list.name}</p>
                    <p className="text-xs text-muted-foreground">{list.organisationNumbers.length} companies</p>
                  </button>
                  <button type="button" className="mt-2 text-xs underline underline-offset-4" onClick={() => void removeList(list.id)}>
                    Delete list
                  </button>
                </li>
              ))}
            </ul>
          )}
        </article>

        <article className="space-y-4 border-2 border-foreground p-4">
          {!activeList ? (
            <EmptyState title="Select a list" description="Pick a list on the left to add companies and maintain targets." />
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="mono-label text-[10px]">Active list</p>
                  <h2 className="text-xl">{activeList.name}</h2>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {compareListHref ? (
                    <Link
                      href={compareListHref}
                      className="border-2 border-foreground bg-foreground px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-background hover:opacity-90"
                    >
                      Compare list
                    </Link>
                  ) : null}
                  <p className="text-xs text-muted-foreground">Updated {new Date(activeList.updatedAt).toLocaleString()}</p>
                </div>
              </div>

              <div className="grid gap-2 md:grid-cols-[1fr_auto]">
                <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search companies by name or org number" />
                <Button type="button" onClick={() => void runSearch()}>Search company</Button>
              </div>
              {searchError ? <ErrorState title="Search failed" message={searchError} /> : null}
              {searchRows.length > 0 ? (
                <Table>
                  <thead>
                    <tr><th>Name</th><th>Org number</th><th>Status</th><th /></tr>
                  </thead>
                  <tbody>
                    {searchRows.map((row) => (
                      <tr key={row.id}>
                        <td>{row.legalName}</td>
                        <td>{row.organisationNumber}</td>
                        <td>{row.status}</td>
                        <td>
                          <button className="underline underline-offset-4" onClick={() => void addOrgToActiveList(row.organisationNumber)}>
                            Add to list
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              ) : null}

              {activeList.organisationNumbers.length === 0 ? (
                <EmptyState title="List is empty" description="Add organisations from search to build your shortlist." />
              ) : (
                <Table>
                  <thead>
                    <tr><th>Organisation number</th><th>Workspace</th><th /></tr>
                  </thead>
                  <tbody>
                    {activeList.organisationNumbers.map((org) => (
                      <tr key={org}>
                        <td className="font-mono text-xs">{org}</td>
                        <td>
                          <Link href={`/companies/workspace/${org}`} className="underline underline-offset-4">Open workspace</Link>
                        </td>
                        <td>
                          <button className="underline underline-offset-4" onClick={() => void removeOrgFromActiveList(org)}>
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </>
          )}
        </article>
      </div>
    </section>
  );
}

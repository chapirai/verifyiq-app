'use client';

import { useMemo, useState } from 'react';
import { SectionHeader } from '@/components/section-header';

export interface DomainWorkspaceItem {
  id: string;
  name: string;
  owner: string;
  status: 'open' | 'in_review' | 'blocked' | 'done';
  updatedAt: string;
  score: number;
}

interface DomainWorkspaceProps {
  eyebrow: string;
  title: string;
  description: string;
  createLabel: string;
  emptyLabel: string;
  initialItems: DomainWorkspaceItem[];
}

const STATUS_LABEL: Record<DomainWorkspaceItem['status'], string> = {
  open: 'Open',
  in_review: 'In review',
  blocked: 'Blocked',
  done: 'Done',
};

const STATUS_CLASS: Record<DomainWorkspaceItem['status'], string> = {
  open: 'bg-blue-50 text-blue-700',
  in_review: 'bg-amber-50 text-amber-700',
  blocked: 'bg-red-50 text-red-700',
  done: 'bg-emerald-50 text-emerald-700',
};

export function DomainWorkspace({
  eyebrow,
  title,
  description,
  createLabel,
  emptyLabel,
  initialItems,
}: DomainWorkspaceProps) {
  const [query, setQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | DomainWorkspaceItem['status']>('all');
  const [items, setItems] = useState(initialItems);
  const [newName, setNewName] = useState('');

  const filtered = useMemo(
    () =>
      items.filter((item) => {
        const matchesQuery =
          !query.trim() ||
          item.name.toLowerCase().includes(query.toLowerCase()) ||
          item.owner.toLowerCase().includes(query.toLowerCase());
        const matchesStatus = filterStatus === 'all' || item.status === filterStatus;
        return matchesQuery && matchesStatus;
      }),
    [filterStatus, items, query],
  );

  const metrics = useMemo(
    () => ({
      total: items.length,
      open: items.filter((item) => item.status === 'open').length,
      blocked: items.filter((item) => item.status === 'blocked').length,
      avgScore: Math.round(items.reduce((sum, item) => sum + item.score, 0) / Math.max(items.length, 1)),
    }),
    [items],
  );

  function cycleStatus(id: string) {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const nextStatus: DomainWorkspaceItem['status'] =
          item.status === 'open'
            ? 'in_review'
            : item.status === 'in_review'
              ? 'done'
              : item.status === 'done'
                ? 'blocked'
                : 'open';
        return { ...item, status: nextStatus, updatedAt: new Date().toISOString().slice(0, 10) };
      }),
    );
  }

  function addItem() {
    if (!newName.trim()) return;
    setItems((prev) => [
      {
        id: `ITEM-${Date.now()}`,
        name: newName.trim(),
        owner: 'You',
        status: 'open',
        updatedAt: new Date().toISOString().slice(0, 10),
        score: 50,
      },
      ...prev,
    ]);
    setNewName('');
  }

  return (
    <div className="space-y-6">
      <SectionHeader eyebrow={eyebrow} title={title} description={description} />

      <section className="grid gap-4 md:grid-cols-4">
        <article className="panel p-5">
          <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground">Total</p>
          <p className="mt-2 text-3xl font-semibold">{metrics.total}</p>
        </article>
        <article className="panel p-5">
          <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground">Open</p>
          <p className="mt-2 text-3xl font-semibold">{metrics.open}</p>
        </article>
        <article className="panel p-5">
          <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground">Blocked</p>
          <p className="mt-2 text-3xl font-semibold">{metrics.blocked}</p>
        </article>
        <article className="panel p-5">
          <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground">Avg. score</p>
          <p className="mt-2 text-3xl font-semibold">{metrics.avgScore}</p>
        </article>
      </section>

      <section className="panel space-y-4 p-5">
        <div className="flex flex-col gap-3 lg:flex-row">
          <input
            className="input-ui flex-1"
            placeholder="Search by name or owner"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <select
            className="input-ui w-full lg:w-52"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as 'all' | DomainWorkspaceItem['status'])}
          >
            <option value="all">All statuses</option>
            <option value="open">Open</option>
            <option value="in_review">In review</option>
            <option value="blocked">Blocked</option>
            <option value="done">Done</option>
          </select>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            className="input-ui flex-1"
            placeholder={createLabel}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <button className="primary-btn" onClick={addItem} type="button">
            Add item
          </button>
        </div>
      </section>

      <section className="panel overflow-hidden">
        <div className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-3 border-b border-border bg-muted/60 px-5 py-3 text-xs uppercase tracking-[0.12em] text-muted-foreground">
          <p>Item</p>
          <p>Owner</p>
          <p>Status</p>
          <p>Score</p>
          <p>Action</p>
        </div>
        <div className="divide-y divide-border">
          {filtered.map((item) => (
            <div
              className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] items-center gap-3 px-5 py-4 text-sm"
              key={item.id}
            >
              <div>
                <p className="font-medium text-foreground">{item.name}</p>
                <p className="text-xs text-muted-foreground">{item.id}</p>
              </div>
              <p>{item.owner}</p>
              <p>
                <span className={`rounded-full px-2 py-1 text-xs ${STATUS_CLASS[item.status]}`}>
                  {STATUS_LABEL[item.status]}
                </span>
              </p>
              <p className="font-mono text-xs">{item.score}</p>
              <button className="secondary-btn h-9 px-3 text-xs" onClick={() => cycleStatus(item.id)} type="button">
                Move status
              </button>
            </div>
          ))}
          {!filtered.length ? (
            <p className="px-5 py-6 text-sm text-muted-foreground">{emptyLabel}</p>
          ) : null}
        </div>
      </section>
    </div>
  );
}

'use client';

import { useState } from 'react';

const TABS = ['Profile', 'Documents', 'Ownership', 'Risk', 'Monitoring'] as const;
type Tab = (typeof TABS)[number];

export function TabNavigation() {
  const [activeTab, setActiveTab] = useState<Tab>('Profile');

  return (
    <div className="border-b border-border">
      <nav className="-mb-px flex gap-1" aria-label="Company sections">
        {TABS.map((tab) => {
          const isActive = tab === activeTab;
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? 'border-b-2 border-accent text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              aria-current={isActive ? 'page' : undefined}
            >
              {tab}
              {tab !== 'Profile' && (
                <span className="ml-1.5 rounded bg-slate-700 px-1.5 py-0.5 text-[10px] text-slate-400">
                  Soon
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
}

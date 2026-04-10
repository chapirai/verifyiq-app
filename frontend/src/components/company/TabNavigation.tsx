'use client';

import { useState } from 'react';

const TABS = ['Profile', 'Documents', 'Ownership', 'Risk', 'Monitoring'] as const;
type Tab = (typeof TABS)[number];

export function TabNavigation() {
  const [activeTab, setActiveTab] = useState<Tab>('Profile');

  return (
    <div className="border-b border-border">
      <nav className="-mb-px flex flex-wrap gap-1" aria-label="Company sections">
        {TABS.map((tab) => {
          const isActive = tab === activeTab;
          return (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`rounded-t-lg px-4 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? 'border-b-2 border-primary text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              aria-current={isActive ? 'page' : undefined}
            >
              {tab}
              {tab !== 'Profile' && (
                <span className="ml-1.5 rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
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

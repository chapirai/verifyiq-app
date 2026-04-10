'use client';

import { useState } from 'react';
import { SectionHeader } from '@/components/section-header';

export default function SettingsPage() {
  const [companyName, setCompanyName] = useState('VerifyIQ Demo Tenant');
  const [notifyOps, setNotifyOps] = useState(true);
  const [retention, setRetention] = useState('365');

  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow="Settings"
        title="Workspace settings"
        description="Manage organization preferences, notifications, and retention defaults."
      />
      <section className="panel grid gap-5 p-6 md:grid-cols-2 md:p-8">
        <div className="space-y-1.5 md:col-span-2">
          <label className="text-sm font-medium text-foreground" htmlFor="ws-name">
            Workspace name
          </label>
          <input
            id="ws-name"
            className="input-ui"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground" htmlFor="retention">
            Retention (days)
          </label>
          <input
            id="retention"
            className="input-ui"
            value={retention}
            onChange={(e) => setRetention(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <span className="text-sm font-medium text-foreground">Operational alerts</span>
          <button
            className="secondary-btn w-full"
            onClick={() => setNotifyOps((v) => !v)}
            type="button"
          >
            {notifyOps ? 'Enabled' : 'Disabled'}
          </button>
        </div>
        <button className="primary-btn md:col-span-2" type="button">
          Save settings
        </button>
      </section>
    </div>
  );
}

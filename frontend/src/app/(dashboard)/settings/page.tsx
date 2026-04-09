'use client';

import { useState } from 'react';
import { SectionHeader } from '@/components/section-header';

export default function SettingsPage() {
  const [companyName, setCompanyName] = useState('VerifyIQ Demo Tenant');
  const [notifyOps, setNotifyOps] = useState(true);
  const [retention, setRetention] = useState('365');

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Settings"
        title="Workspace settings"
        description="Manage organization preferences, notifications, and retention defaults."
      />
      <section className="panel grid gap-4 p-6 md:grid-cols-2">
        <div className="space-y-1 md:col-span-2">
          <label className="text-sm text-muted-foreground">Workspace name</label>
          <input className="input-ui" value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
        </div>
        <div className="space-y-1">
          <label className="text-sm text-muted-foreground">Retention days</label>
          <input className="input-ui" value={retention} onChange={(e) => setRetention(e.target.value)} />
        </div>
        <div className="space-y-1">
          <label className="text-sm text-muted-foreground">Operational alerts</label>
          <button className="secondary-btn w-full" onClick={() => setNotifyOps((v) => !v)} type="button">
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

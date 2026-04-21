'use client';

import { useSearchParams } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { normalizeIdentitetsbeteckning } from '@/lib/org-number';
import type { MonitoringAlert, MonitoringSubscription } from '@/types/monitoring';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { EmptyState, ErrorState, LoadingSkeleton } from '@/components/ui/StateBlocks';
import { Table } from '@/components/ui/Table';

export default function AlertsPage() {
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState('');
  const [subscriptions, setSubscriptions] = useState<MonitoringSubscription[]>([]);
  const [alerts, setAlerts] = useState<MonitoringAlert[]>([]);
  const [orgNumber, setOrgNumber] = useState('');
  const [eventTypes, setEventTypes] = useState('ownership.change,board.change,financial.change');
  const [formError, setFormError] = useState('');

  const load = async () => {
    setLoading(true);
    setListError('');
    try {
      const [subRows, alertRows] = await Promise.all([api.listMonitoringSubscriptions(), api.listMonitoringAlerts()]);
      setSubscriptions(subRows);
      setAlerts(alertRows);
    } catch (e) {
      setListError(e instanceof Error ? e.message : 'Could not load alerts');
      setSubscriptions([]);
      setAlerts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    const o = normalizeIdentitetsbeteckning(searchParams.get('org') ?? '');
    if (o.length === 10 || o.length === 12) setOrgNumber(o);
  }, [searchParams]);

  const onCreateSubscription = async (event: FormEvent) => {
    event.preventDefault();
    const normalized = normalizeIdentitetsbeteckning(orgNumber);
    if (normalized.length !== 10 && normalized.length !== 12) {
      setFormError('Organisation number must be 10 or 12 digits.');
      return;
    }
    const events = eventTypes
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean);
    if (events.length === 0) {
      setFormError('At least one event type is required.');
      return;
    }
    setFormError('');
    await api.createMonitoringSubscription({
      organisationNumber: normalized,
      subjectType: 'company',
      eventTypes: events,
      datasetFamilies: ['ownership', 'financials', 'filings'],
      alertConfig: { delivery: 'in_app' },
    });
    setOrgNumber('');
    await load();
  };

  const acknowledgeAlert = async (id: string) => {
    await api.acknowledgeMonitoringAlert(id);
    await load();
  };

  return (
    <section className="space-y-6">
      <h1 className="font-display text-5xl">Alerts</h1>
      <p className="max-w-3xl text-sm text-muted-foreground">
        Subscribe to monitored organisations and track ownership, filing, and financial changes in one queue. Company workspace can prefill org via{' '}
        <span className="font-mono text-xs">?org=</span>.
      </p>

      {loading ? <LoadingSkeleton lines={4} /> : null}
      {!loading && listError ? <ErrorState title="Could not load subscriptions or alerts" message={listError} /> : null}

      <form onSubmit={onCreateSubscription} className="grid gap-3 border-2 border-foreground p-4 md:grid-cols-[1fr_1fr_auto]">
        <Input
          value={orgNumber}
          onChange={(e) => setOrgNumber(e.target.value)}
          placeholder="Organisation number"
          required
        />
        <Input
          value={eventTypes}
          onChange={(e) => setEventTypes(e.target.value)}
          placeholder="Comma-separated event types"
          required
        />
        <Button type="submit">Create subscription</Button>
      </form>
      {formError ? <ErrorState title="Subscription" message={formError} /> : null}

      <article className="space-y-3">
        <h2 className="text-2xl">Subscriptions</h2>
        {subscriptions.length === 0 ? (
          <EmptyState title="No subscriptions yet" description="Create a monitoring subscription to start receiving alerts." />
        ) : (
          <Table>
            <thead>
              <tr><th>Org number</th><th>Subject</th><th>Event types</th><th>Status</th><th>Created</th></tr>
            </thead>
            <tbody>
              {subscriptions.map((row) => (
                <tr key={row.id}>
                  <td className="font-mono text-xs">{row.organisationNumber ?? '—'}</td>
                  <td>{row.subjectType}</td>
                  <td>{row.eventTypes.join(', ')}</td>
                  <td>{row.status}</td>
                  <td>{new Date(row.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </article>

      <article className="space-y-3">
        <h2 className="text-2xl">Open alerts</h2>
        {alerts.length === 0 ? (
          <EmptyState title="No alerts" description="Alerts will appear when monitored entities trigger subscribed events." />
        ) : (
          <Table>
            <thead>
              <tr><th>Severity</th><th>Type</th><th>Title</th><th>Status</th><th>Created</th><th /></tr>
            </thead>
            <tbody>
              {alerts.map((row) => (
                <tr key={row.id}>
                  <td>{row.severity}</td>
                  <td>{row.alertType}</td>
                  <td>{row.title}</td>
                  <td>{row.isAcknowledged ? 'acknowledged' : row.status}</td>
                  <td>{new Date(row.createdAt).toLocaleString()}</td>
                  <td>
                    {!row.isAcknowledged ? (
                      <button className="underline underline-offset-4" onClick={() => void acknowledgeAlert(row.id)}>
                        Acknowledge
                      </button>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </article>
    </section>
  );
}

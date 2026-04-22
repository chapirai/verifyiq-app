'use client';

import { useSearchParams } from 'next/navigation';
import { FormEvent, Suspense, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { normalizeIdentitetsbeteckning } from '@/lib/org-number';
import type { MonitoringAlert, MonitoringGroupedFeedRow, MonitoringSubscription } from '@/types/monitoring';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { EmptyState, ErrorState, LoadingSkeleton } from '@/components/ui/StateBlocks';
import { Table } from '@/components/ui/Table';

function AlertsPageContent() {
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState('');
  const [subscriptions, setSubscriptions] = useState<MonitoringSubscription[]>([]);
  const [alerts, setAlerts] = useState<MonitoringAlert[]>([]);
  const [groupedFeed, setGroupedFeed] = useState<MonitoringGroupedFeedRow[]>([]);
  const [orgNumber, setOrgNumber] = useState('');
  const [eventTypes, setEventTypes] = useState('ownership.change,board.change,filings.change,signal.change');
  const [formError, setFormError] = useState('');
  const [detectionMsg, setDetectionMsg] = useState('');
  const [detectionLoading, setDetectionLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    setListError('');
    try {
      const [subRows, alertRows, groupedRows] = await Promise.all([
        api.listMonitoringSubscriptions(),
        api.listMonitoringAlerts(),
        api.listMonitoringGroupedFeed(100),
      ]);
      setSubscriptions(subRows);
      setAlerts(alertRows);
      setGroupedFeed(groupedRows);
    } catch (e) {
      setListError(e instanceof Error ? e.message : 'Could not load alerts');
      setSubscriptions([]);
      setAlerts([]);
      setGroupedFeed([]);
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

  const runDetection = async () => {
    setDetectionLoading(true);
    setDetectionMsg('');
    try {
      const res = await api.detectMonitoringChanges(24);
      setDetectionMsg(
        `Scanned ${res.scanned_subscriptions} subscriptions, created ${res.created_alerts} alerts (${res.triggered_event_types.join(', ') || 'none'}).`,
      );
      await load();
    } catch (e) {
      setDetectionMsg(e instanceof Error ? e.message : 'Detection failed');
    } finally {
      setDetectionLoading(false);
    }
  };

  return (
    <section className="space-y-6">
      <h1 className="font-display text-5xl">Alerts</h1>
      <p className="max-w-3xl text-sm text-muted-foreground">
        Subscribe to monitored organisations and track ownership, filing, and financial changes in one queue. Company workspace can prefill org via{' '}
        <span className="font-mono text-xs">?org=</span>.
      </p>
      <div className="flex flex-wrap items-center gap-2 border border-border-light p-3">
        <Button type="button" variant="secondary" onClick={() => void runDetection()} disabled={detectionLoading}>
          {detectionLoading ? 'Detecting…' : 'Run change detection now'}
        </Button>
        {detectionMsg ? <p className="text-xs text-muted-foreground">{detectionMsg}</p> : null}
      </div>

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
        <h2 className="text-2xl">Grouped feed</h2>
        {groupedFeed.length === 0 ? (
          <EmptyState title="No grouped feed entries" description="Grouped alert rollups appear after detection runs." />
        ) : (
          <Table>
            <thead>
              <tr><th>Org number</th><th>Alert type</th><th>Open</th><th>Total</th><th>Latest</th></tr>
            </thead>
            <tbody>
              {groupedFeed.map((row) => (
                <tr key={`${row.organisationNumber ?? 'unknown'}:${row.alertType}`}>
                  <td className="font-mono text-xs">{row.organisationNumber ?? '—'}</td>
                  <td>{row.alertType}</td>
                  <td>{row.openCount}</td>
                  <td>{row.alertCount}</td>
                  <td>{new Date(row.latestCreatedAt).toLocaleString()}</td>
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

export default function AlertsPage() {
  return (
    <Suspense fallback={<LoadingSkeleton lines={4} />}>
      <AlertsPageContent />
    </Suspense>
  );
}

import { DomainWorkspace } from '@/components/domain/domain-workspace';

export default function IntegrationStatusPage() {
  return (
    <DomainWorkspace
      eyebrow="Integration status"
      title="Provider and integration status"
      description="Observe integration uptime, token health, and provider reliability signals."
      createLabel="Track integration component"
      emptyLabel="No integration components match the current filters."
      initialItems={[
        { id: 'INT-1401', name: 'Bolagsverket API', owner: 'Platform', status: 'open', updatedAt: '2026-04-09', score: 88 },
        { id: 'INT-1402', name: 'Token cache health', owner: 'Platform', status: 'in_review', updatedAt: '2026-04-09', score: 76 },
        { id: 'INT-1403', name: 'Webhook retries', owner: 'Ops', status: 'blocked', updatedAt: '2026-04-08', score: 41 },
      ]}
    />
  );
}

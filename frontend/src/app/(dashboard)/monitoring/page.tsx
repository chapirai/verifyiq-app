import { DomainWorkspace } from '@/components/domain/domain-workspace';

export default function MonitoringPage() {
  return (
    <DomainWorkspace
      eyebrow="Monitoring"
      title="Ongoing monitoring"
      description="Review triggered alerts and maintain continuous risk oversight on active entities."
      createLabel="Add monitoring rule"
      emptyLabel="No active monitoring tasks match the current filters."
      initialItems={[
        { id: 'MON-4501', name: 'Ownership change signal', owner: 'Sofia', status: 'open', updatedAt: '2026-04-09', score: 70 },
        { id: 'MON-4502', name: 'Status downgrade check', owner: 'Karl', status: 'in_review', updatedAt: '2026-04-08', score: 61 },
        { id: 'MON-4503', name: 'Address anomaly watch', owner: 'Nils', status: 'done', updatedAt: '2026-04-07', score: 53 },
      ]}
    />
  );
}

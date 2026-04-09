import { DomainWorkspace } from '@/components/domain/domain-workspace';

export default function OwnershipPage() {
  return (
    <DomainWorkspace
      eyebrow="Ownership"
      title="Ownership structure"
      description="Inspect ownership trees, beneficial ownership indicators, and structural complexity."
      createLabel="Track ownership entity"
      emptyLabel="No ownership entities match the current filters."
      initialItems={[
        { id: 'OWN-7101', name: 'UBO review: Lumen Group', owner: 'Ellen', status: 'open', updatedAt: '2026-04-09', score: 77 },
        { id: 'OWN-7102', name: 'Holding chain audit', owner: 'David', status: 'blocked', updatedAt: '2026-04-08', score: 40 },
        { id: 'OWN-7103', name: 'Cross-border nominee scan', owner: 'Ari', status: 'in_review', updatedAt: '2026-04-08', score: 58 },
      ]}
    />
  );
}

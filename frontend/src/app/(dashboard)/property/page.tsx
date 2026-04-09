import { DomainWorkspace } from '@/components/domain/domain-workspace';

export default function PropertyPage() {
  return (
    <DomainWorkspace
      eyebrow="Property"
      title="Property enrichment"
      description="Consolidate property-linked enrichment and related ownership exposure signals."
      createLabel="Add property review task"
      emptyLabel="No property tasks match the current filters."
      initialItems={[
        { id: 'PRP-6201', name: 'Asset lien verification', owner: 'Marek', status: 'open', updatedAt: '2026-04-09', score: 65 },
        { id: 'PRP-6202', name: 'Title owner consistency', owner: 'Emma', status: 'in_review', updatedAt: '2026-04-08', score: 61 },
        { id: 'PRP-6203', name: 'Property valuation drift', owner: 'Tove', status: 'done', updatedAt: '2026-04-07', score: 43 },
      ]}
    />
  );
}

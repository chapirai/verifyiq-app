import { DomainWorkspace } from '@/components/domain/domain-workspace';

export default function PersonEnrichmentPage() {
  return (
    <DomainWorkspace
      eyebrow="Person enrichment"
      title="Individual enrichment checks"
      description="Run person-level enrichment workflows and aggregate responses in one interface."
      createLabel="Add person enrichment check"
      emptyLabel="No person enrichment tasks match the current filters."
      initialItems={[
        { id: 'PER-1101', name: 'Identity match confirmation', owner: 'Leo', status: 'open', updatedAt: '2026-04-09', score: 73 },
        { id: 'PER-1102', name: 'Adverse media review', owner: 'Nora', status: 'in_review', updatedAt: '2026-04-08', score: 60 },
        { id: 'PER-1103', name: 'PEP relation map', owner: 'Ava', status: 'done', updatedAt: '2026-04-07', score: 49 },
      ]}
    />
  );
}

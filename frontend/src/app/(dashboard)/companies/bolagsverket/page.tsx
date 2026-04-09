import { DomainWorkspace } from '@/components/domain/domain-workspace';

export default function BolagsverketPage() {
  return (
    <DomainWorkspace
      eyebrow="Bolagsverket"
      title="Bolagsverket integration"
      description="Operate Bolagsverket company and document enrichment from a consistent UI shell."
      createLabel="Add Bolagsverket task"
      emptyLabel="No Bolagsverket tasks match the current filters."
      initialItems={[
        { id: 'BV-6001', name: 'Document archive fetch', owner: 'Integration', status: 'open', updatedAt: '2026-04-09', score: 78 },
        { id: 'BV-6002', name: 'Company profile resync', owner: 'Integration', status: 'in_review', updatedAt: '2026-04-08', score: 62 },
        { id: 'BV-6003', name: 'Person endpoint test', owner: 'QA', status: 'done', updatedAt: '2026-04-07', score: 54 },
      ]}
    />
  );
}

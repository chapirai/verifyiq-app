import { DomainWorkspace } from '@/components/domain/domain-workspace';

export default function CompanyCasesPage() {
  return (
    <DomainWorkspace
      eyebrow="Company cases"
      title="Case management"
      description="Coordinate investigation workflows, ownership context, and final decision outcomes."
      createLabel="Open company case"
      emptyLabel="No company cases match the current filters."
      initialItems={[
        { id: 'CAS-9001', name: 'Case: Borealis Logistics', owner: 'Hugo', status: 'open', updatedAt: '2026-04-09', score: 71 },
        { id: 'CAS-9002', name: 'Case: Greenfield Imports', owner: 'Ida', status: 'in_review', updatedAt: '2026-04-08', score: 64 },
        { id: 'CAS-9003', name: 'Case: Aurora Tech AB', owner: 'Rita', status: 'done', updatedAt: '2026-04-06', score: 35 },
      ]}
    />
  );
}

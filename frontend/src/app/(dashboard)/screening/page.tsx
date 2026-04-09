import { DomainWorkspace } from '@/components/domain/domain-workspace';

export default function ScreeningPage() {
  return (
    <DomainWorkspace
      eyebrow="Screening"
      title="Sanctions and PEP screening"
      description="Track screening outcomes and route potential matches for analyst review."
      createLabel="Add screening alert"
      emptyLabel="No screening alerts match the current filters."
      initialItems={[
        { id: 'SCR-3001', name: 'Helios Trade AB', owner: 'Lina', status: 'open', updatedAt: '2026-04-09', score: 81 },
        { id: 'SCR-3002', name: 'Baltic Works AB', owner: 'Erik', status: 'in_review', updatedAt: '2026-04-09', score: 63 },
        { id: 'SCR-3003', name: 'North River Holding', owner: 'Marta', status: 'done', updatedAt: '2026-04-07', score: 29 },
      ]}
    />
  );
}

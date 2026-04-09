import { DomainWorkspace } from '@/components/domain/domain-workspace';

export default function RiskIndicatorsPage() {
  return (
    <DomainWorkspace
      eyebrow="Risk indicators"
      title="Risk signal library"
      description="Interpret configured risk flags and align them with policy and case workflows."
      createLabel="Add risk indicator"
      emptyLabel="No risk indicators match the current filters."
      initialItems={[
        { id: 'RSK-2101', name: 'Frequent director changes', owner: 'Linn', status: 'open', updatedAt: '2026-04-09', score: 83 },
        { id: 'RSK-2102', name: 'Sanctions exposure overlap', owner: 'Noah', status: 'in_review', updatedAt: '2026-04-08', score: 79 },
        { id: 'RSK-2103', name: 'Complex ownership depth', owner: 'Sara', status: 'done', updatedAt: '2026-04-07', score: 52 },
      ]}
    />
  );
}

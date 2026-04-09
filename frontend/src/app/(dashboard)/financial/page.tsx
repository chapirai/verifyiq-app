import { DomainWorkspace } from '@/components/domain/domain-workspace';

export default function FinancialPage() {
  return (
    <DomainWorkspace
      eyebrow="Financial"
      title="Financial insights"
      description="View financial indicators and trend summaries tied to verified company snapshots."
      createLabel="Add financial insight task"
      emptyLabel="No financial insight records match the current filters."
      initialItems={[
        { id: 'FIN-8101', name: 'Liquidity deterioration', owner: 'Oskar', status: 'open', updatedAt: '2026-04-09', score: 72 },
        { id: 'FIN-8102', name: 'Revenue volatility profile', owner: 'Julia', status: 'in_review', updatedAt: '2026-04-08', score: 66 },
        { id: 'FIN-8103', name: 'Late filing indicator', owner: 'Milo', status: 'done', updatedAt: '2026-04-07', score: 37 },
      ]}
    />
  );
}

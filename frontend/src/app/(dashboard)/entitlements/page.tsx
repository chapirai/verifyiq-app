import { DomainWorkspace } from '@/components/domain/domain-workspace';

export default function EntitlementsPage() {
  return (
    <DomainWorkspace
      eyebrow="Entitlements"
      title="Dataset entitlements"
      description="Manage tenant access rights to product modules, datasets, and usage boundaries."
      createLabel="Add entitlement rule"
      emptyLabel="No entitlement rules match the current filters."
      initialItems={[
        { id: 'ENT-2301', name: 'Dataset: company-core', owner: 'Admin', status: 'open', updatedAt: '2026-04-09', score: 84 },
        { id: 'ENT-2302', name: 'Feature: bulk-processing', owner: 'Admin', status: 'done', updatedAt: '2026-04-08', score: 95 },
        { id: 'ENT-2303', name: 'API quota override', owner: 'Ops', status: 'in_review', updatedAt: '2026-04-08', score: 67 },
      ]}
    />
  );
}

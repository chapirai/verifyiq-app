import { DomainWorkspace } from '@/components/domain/domain-workspace';

export default function OnboardingPage() {
  return (
    <DomainWorkspace
      eyebrow="Onboarding"
      title="Customer onboarding"
      description="Coordinate checks required to onboard new legal entities with consistent policy steps."
      createLabel="Add onboarding case"
      emptyLabel="No onboarding records match the current filters."
      initialItems={[
        { id: 'ONB-1201', name: 'Nordic Components AB', owner: 'Anna', status: 'open', updatedAt: '2026-04-09', score: 68 },
        { id: 'ONB-1202', name: 'Skandia Transit AB', owner: 'Jonas', status: 'in_review', updatedAt: '2026-04-08', score: 74 },
        { id: 'ONB-1203', name: 'Artemis Foods AB', owner: 'Maja', status: 'blocked', updatedAt: '2026-04-08', score: 42 },
      ]}
    />
  );
}

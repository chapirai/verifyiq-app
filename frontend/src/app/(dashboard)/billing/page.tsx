'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { SectionHeader } from '@/components/section-header';

export default function BillingPage() {
  const [plans, setPlans] = useState<Array<{ id: string; code: string; name: string; monthlyPriceCents: number; currency: string; isActive: boolean }>>([]);
  const [subscription, setSubscription] = useState<{ id: string; tenantId: string; planCode: string; status: string; currentPeriodStart: string | null; currentPeriodEnd: string | null; canceledAt: string | null } | null>(null);
  const [error, setError] = useState('');

  async function load() {
    try {
      const [nextPlans, nextSub] = await Promise.all([api.listPlans(), api.getSubscription()]);
      setPlans(nextPlans);
      setSubscription(nextSub);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load billing data');
    }
  }

  async function choosePlan(planCode: string) {
    try {
      const updated = await api.upsertSubscription({ planCode, status: 'active' });
      setSubscription(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update plan');
    }
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <section className="space-y-6">
      <SectionHeader
        eyebrow="Billing"
        title="Plan and Usage"
        description="Track subscription status and align usage controls with your active plan."
      />
      <div className="panel p-6">
        <p className="text-muted-foreground">Current plan: <span className="font-medium text-foreground">{subscription?.planCode ?? 'none'}</span></p>
        <p className="mt-1 text-muted-foreground">Status: <span className="font-medium text-foreground">{subscription?.status ?? 'not started'}</span></p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {plans.map((plan) => (
          <div key={plan.id} className="panel p-5">
            <h2 className="text-xl font-semibold">{plan.name}</h2>
            <p className="mt-1 text-muted-foreground">{plan.monthlyPriceCents > 0 ? `${(plan.monthlyPriceCents / 100).toFixed(0)} ${plan.currency}/mo` : 'Custom'}</p>
            <button onClick={() => choosePlan(plan.code)} className="primary-btn mt-4 text-sm">
              Select {plan.name}
            </button>
          </div>
        ))}
      </div>
      {error ? <p className="text-sm text-red-400">{error}</p> : null}
    </section>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

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
      <div>
        <p className="text-sm text-slate-400">Billing</p>
        <h1 className="text-3xl font-semibold">Plan and Usage</h1>
      </div>
      <div className="panel p-6">
        <p className="text-slate-300">Current plan: <span className="font-medium text-white">{subscription?.planCode ?? 'none'}</span></p>
        <p className="mt-1 text-slate-300">Status: <span className="font-medium text-white">{subscription?.status ?? 'not started'}</span></p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {plans.map((plan) => (
          <div key={plan.id} className="panel p-5">
            <h2 className="text-xl font-semibold">{plan.name}</h2>
            <p className="mt-1 text-slate-300">{plan.monthlyPriceCents > 0 ? `${(plan.monthlyPriceCents / 100).toFixed(0)} ${plan.currency}/mo` : 'Custom'}</p>
            <button onClick={() => choosePlan(plan.code)} className="mt-4 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium">
              Select {plan.name}
            </button>
          </div>
        ))}
      </div>
      {error ? <p className="text-sm text-red-400">{error}</p> : null}
    </section>
  );
}

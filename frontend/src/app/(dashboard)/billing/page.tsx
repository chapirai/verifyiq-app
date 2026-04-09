'use client';

import { useEffect, useMemo, useState } from 'react';
import { SectionHeader } from '@/components/section-header';
import { api } from '@/lib/api';

export default function BillingPage() {
  const [plans, setPlans] = useState<Array<{ code: string; name: string; monthlyPriceCents: number }>>([]);
  const [activePlan, setActivePlan] = useState<string | null>(null);
  const [busyPlanCode, setBusyPlanCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [planData, subscription] = await Promise.all([api.listPlans(), api.getSubscription()]);
        setPlans(planData.map((p) => ({ code: p.code, name: p.name, monthlyPriceCents: p.monthlyPriceCents })));
        setActivePlan(subscription?.planCode ?? null);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Unable to load billing.');
      }
    }
    void load();
  }, []);

  const sortedPlans = useMemo(
    () => [...plans].sort((a, b) => a.monthlyPriceCents - b.monthlyPriceCents),
    [plans],
  );

  async function handleSubscribe(planCode: string) {
    setBusyPlanCode(planCode);
    setError(null);
    try {
      const session = await api.createCheckoutSession({ planCode });
      await api.confirmPayment({ sessionId: session.sessionId, planCode });
      setActivePlan(planCode);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Subscription update failed.');
    } finally {
      setBusyPlanCode(null);
    }
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Billing"
        title="Plans and subscription"
        description="Pick a plan and run a mock checkout to update your tenant subscription."
      />
      {error ? <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
      <section className="grid gap-5 md:grid-cols-3">
        {sortedPlans.map((plan, index) => {
          const isActive = activePlan === plan.code;
          return (
            <article
              key={plan.code}
              className={`panel p-6 ${index === 1 ? 'border-accent shadow-accent' : ''} ${isActive ? 'ring-2 ring-accent/30' : ''}`}
            >
              <h3 className="text-xl font-semibold">{plan.name}</h3>
              <p className="mt-2 text-3xl font-semibold">€{(plan.monthlyPriceCents / 100).toFixed(0)}</p>
              <p className="text-sm text-muted-foreground">per month</p>
              <button
                className="primary-btn mt-5 w-full"
                disabled={busyPlanCode === plan.code || isActive}
                onClick={() => void handleSubscribe(plan.code)}
                type="button"
              >
                {isActive ? 'Current plan' : busyPlanCode === plan.code ? 'Processing...' : 'Choose plan'}
              </button>
            </article>
          );
        })}
      </section>
    </div>
  );
}

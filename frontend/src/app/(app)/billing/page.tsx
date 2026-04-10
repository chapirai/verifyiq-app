'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { BillingPlan } from '@/types/api';
import { Button } from '@/components/ui/Button';
import { ErrorState, LoadingSkeleton } from '@/components/ui/StateBlocks';

export default function BillingPage() {
  const [plans, setPlans] = useState<BillingPlan[]>([]);
  const [subscription, setSubscription] = useState<{ planCode?: string; status?: string } | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    Promise.all([api.getPlans(), api.getSubscription()])
      .then(([plansRes, subRes]) => {
        setPlans(plansRes.data);
        setSubscription((subRes as { data?: { planCode?: string; status?: string } | null }).data ?? null);
      })
      .catch((err: { message?: string }) => setError(err.message ?? 'Failed to load plans'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSkeleton lines={8} />;
  if (error) return <ErrorState title="Billing unavailable" message={error} />;

  return (
    <section className="space-y-6">
      <h1 className="font-display text-5xl">Billing</h1>
      <div className="border-2 border-foreground p-4">
        <p className="mono-label text-[10px]">Current Subscription</p>
        <p className="mt-1 text-sm">
          Plan: {subscription?.planCode ?? 'none'} / Status: {subscription?.status ?? 'not_started'}
        </p>
      </div>
      {message ? <p className="border-2 border-foreground p-4 text-sm">{message}</p> : null}
      <div className="grid gap-4 md:grid-cols-3">
        {plans.map((plan) => (
          <article key={plan.code} className="border-2 border-foreground p-6">
            <p className="mono-label text-[10px]">{plan.code}</p>
            <h2 className="font-display mt-2 text-3xl">{plan.name}</h2>
            <p className="mt-2 text-lg">
              {plan.monthlyPriceCents > 0 ? `${(plan.monthlyPriceCents / 100).toFixed(0)} ${plan.currency}/month` : 'Custom pricing'}
            </p>
            <Button
              className="mt-6 w-full"
              onClick={async () => {
                try {
                  const res = await api.createCheckoutSession(plan.code);
                  const sessionId = (res as { data?: { sessionId?: string } }).data?.sessionId ?? '';
                  setMessage(`Checkout session created: ${sessionId || 'ok'}`);
                  if (sessionId) {
                    const confirm = await api.confirmPayment(sessionId, plan.code);
                    const success = (confirm as { data?: { success?: boolean } }).data?.success;
                    setMessage(success ? `Payment confirmed for ${plan.name}` : 'Payment confirmation failed');
                  }
                } catch (err: unknown) {
                  setMessage(err instanceof Error ? err.message : 'Could not start checkout');
                }
              }}
            >
              Start checkout
            </Button>
          </article>
        ))}
      </div>
    </section>
  );
}

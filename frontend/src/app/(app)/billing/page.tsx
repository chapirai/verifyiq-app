'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { BillingPlan } from '@/types/api';
import { Button } from '@/components/ui/Button';
import { ErrorState, LoadingSkeleton } from '@/components/ui/StateBlocks';

type PlanPresentation = {
  name: string;
  pathLabel: string;
  cta: string;
  intent: 'self-serve' | 'api' | 'enterprise';
  featured?: boolean;
};

function planPresentation(plan: BillingPlan): PlanPresentation {
  const code = plan.code.toLowerCase();
  if (code === 'pro' || code.includes('enterprise')) {
    return {
      name: 'Enterprise',
      pathLabel: 'Enterprise',
      cta: 'Talk to sales',
      intent: 'enterprise',
    };
  }
  if (code === 'basic' || code.includes('growth') || code.includes('professional')) {
    return {
      name: 'Growth',
      pathLabel: 'API access',
      cta: 'Choose Growth',
      intent: 'api',
      featured: true,
    };
  }
  return {
    name: 'Starter',
    pathLabel: 'Self-serve',
    cta: 'Start self-serve',
    intent: 'self-serve',
  };
}

function subscriptionPathLabel(planCode?: string): string {
  if (!planCode) return 'None';
  const code = planCode.toLowerCase();
  if (code === 'pro' || code.includes('enterprise')) return 'Enterprise';
  if (code === 'basic' || code.includes('growth') || code.includes('professional')) return 'API access';
  return 'Self-serve';
}

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
      <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
        Keep billing aligned with your onboarding path: self-serve, API access, or enterprise.
      </p>
      <div className="border-2 border-foreground p-4">
        <p className="mono-label text-[10px]">Current Subscription</p>
        <p className="mt-1 text-sm">
          Plan code: {subscription?.planCode ?? 'none'} / Path: {subscriptionPathLabel(subscription?.planCode)} /
          Status: {subscription?.status ?? 'not_started'}
        </p>
      </div>
      {message ? <p className="border-2 border-foreground p-4 text-sm">{message}</p> : null}
      <div className="grid gap-4 md:grid-cols-3">
        {plans.map((plan) => (
          <article
            key={plan.code}
            className={`border-2 border-foreground p-6 ${planPresentation(plan).featured ? 'bg-foreground text-background' : ''}`}
          >
            <p className="mono-label text-[10px]">{plan.code}</p>
            <h2 className="font-display mt-2 text-3xl">{planPresentation(plan).name}</h2>
            <p className="mono-label mt-2 text-[10px] opacity-80">Path: {planPresentation(plan).pathLabel}</p>
            <p className="mt-2 text-lg">
              {plan.monthlyPriceCents === 0
                ? 'Free'
                : `${new Intl.NumberFormat('sv-SE', {
                    style: 'currency',
                    currency: plan.currency,
                    maximumFractionDigits: 0,
                  }).format(plan.monthlyPriceCents / 100)}/month`}
            </p>
            {planPresentation(plan).intent === 'enterprise' ? (
              <Button
                className={`mt-6 w-full ${planPresentation(plan).featured ? 'border-background text-background hover:bg-background hover:text-foreground' : ''}`}
                onClick={() => {
                  window.location.href = '/signup?intent=enterprise';
                }}
              >
                {planPresentation(plan).cta}
              </Button>
            ) : (
              <Button
                className={`mt-6 w-full ${planPresentation(plan).featured ? 'border-background text-background hover:bg-background hover:text-foreground' : ''}`}
                onClick={async () => {
                  try {
                    const res = await api.createCheckoutSession(plan.code);
                    const checkoutUrl = (res as { data?: { checkoutUrl?: string } }).data?.checkoutUrl ?? '';
                    if (checkoutUrl) {
                      window.location.href = checkoutUrl;
                      return;
                    }
                    setMessage('Checkout session created');
                  } catch (err: unknown) {
                    setMessage(err instanceof Error ? err.message : 'Could not start checkout');
                  }
                }}
              >
                {planPresentation(plan).cta}
              </Button>
            )}
            <Button
              className="mt-2 w-full"
              variant="secondary"
              onClick={async () => {
                try {
                  const portal = await api.createBillingPortalSession();
                  const url = (portal as { data?: { url?: string } }).data?.url ?? '';
                  if (url) {
                    window.location.href = url;
                    return;
                  }
                  setMessage('Billing portal unavailable');
                } catch (err: unknown) {
                  setMessage(err instanceof Error ? err.message : 'Could not open billing portal');
                }
              }}
            >
              Open billing portal
            </Button>
          </article>
        ))}
      </div>
    </section>
  );
}

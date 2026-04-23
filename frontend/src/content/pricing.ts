export type PublicPlan = {
  marketingName: 'Starter' | 'Growth' | 'Enterprise';
  planCode: 'free' | 'basic' | 'pro';
  intent: 'self-serve' | 'api' | 'enterprise';
  monthlyPriceCents: number | null;
  currency: 'SEK';
  cta: string;
  bullets: readonly string[];
  featured?: boolean;
};

export const publicPlans: readonly PublicPlan[] = [
  {
    marketingName: 'Starter',
    planCode: 'free',
    intent: 'self-serve',
    monthlyPriceCents: 0,
    currency: 'SEK',
    cta: 'Start self-serve',
    bullets: [
      'For analysts and small teams',
      'Company lookup, ownership, and financial context',
      'Decision notes and export-ready snapshots',
    ],
  },
  {
    marketingName: 'Growth',
    planCode: 'basic',
    intent: 'api',
    monthlyPriceCents: 4900,
    currency: 'SEK',
    cta: 'Choose Growth',
    featured: true,
    bullets: [
      'For risk and compliance operations',
      'Monitoring, alerts, and team workflows',
      'API access for internal systems',
    ],
  },
  {
    marketingName: 'Enterprise',
    planCode: 'pro',
    intent: 'enterprise',
    monthlyPriceCents: null,
    currency: 'SEK',
    cta: 'Talk to sales',
    bullets: [
      'For regulated and large-scale environments',
      'Bulk access, custom onboarding, and controls',
      'Commercial and security alignment',
    ],
  },
] as const;

export function formatSekMonthly(monthlyPriceCents: number | null): string {
  if (monthlyPriceCents == null) return 'Custom';
  if (monthlyPriceCents === 0) return 'Free';
  return new Intl.NumberFormat('sv-SE', {
    style: 'currency',
    currency: 'SEK',
    maximumFractionDigits: 0,
  }).format(monthlyPriceCents / 100);
}

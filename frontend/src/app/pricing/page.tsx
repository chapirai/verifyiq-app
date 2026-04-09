import Link from 'next/link';

const tiers = [
  { name: 'Starter', price: '€199/mo', description: 'Small teams and initial API usage.' },
  { name: 'Growth', price: '€699/mo', description: 'Scaling teams with higher usage limits.' },
  { name: 'Enterprise', price: 'Custom', description: 'Advanced controls, SSO, and contract billing.' },
];

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-background text-white">
      <section className="mx-auto max-w-6xl px-6 py-16">
        <p className="text-sm text-slate-400">Pricing</p>
        <h1 className="mt-2 text-4xl font-semibold">Plans for compliance and platform teams</h1>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {tiers.map((tier) => (
            <article key={tier.name} className="panel p-6">
              <h2 className="text-xl font-semibold">{tier.name}</h2>
              <p className="mt-2 text-3xl">{tier.price}</p>
              <p className="mt-3 text-sm text-slate-300">{tier.description}</p>
            </article>
          ))}
        </div>
        <div className="mt-8">
          <Link href="/signup" className="rounded-xl bg-indigo-600 px-6 py-3 font-medium hover:bg-indigo-500">
            Start free onboarding
          </Link>
        </div>
      </section>
    </main>
  );
}

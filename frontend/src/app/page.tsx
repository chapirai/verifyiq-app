import { Footer } from '@/components/sections/Footer';
import { Navbar } from '@/components/sections/Navbar';
import { Button } from '@/components/ui/Button';
import { Container } from '@/components/ui/Container';

export default function HomePage() {
  const capabilities = [
    'Company Discovery',
    'Ownership Intelligence',
    'Decision Signals',
    'On-Demand Enrichment',
    'Monitoring & Alerts',
    'API & Integration',
  ];
  const audiences = [
    'Private Equity',
    'Corporate M&A',
    'Financial Institutions',
    'Credit / Risk',
    'Compliance / KYC',
  ];
  const faqs = [
    {
      q: 'How does data access work?',
      a: 'VerifyIQ provides broad company coverage for discovery and triage, then lets teams request deeper records only when a target warrants it.',
    },
    {
      q: 'How does deep retrieval work?',
      a: 'Users trigger enrichment only for selected companies. The platform pulls and stores richer payloads on demand so you avoid unnecessary cost and latency.',
    },
    {
      q: 'How does ownership intelligence help?',
      a: 'VerifyIQ translates complex ownership structures into clear control visibility, making beneficial ownership and control risks easier to understand and compare.',
    },
    {
      q: 'Do you support integrations?',
      a: 'Yes. Teams can integrate via APIs and workflows to push signals, lists, and decision context into existing systems.',
    },
    {
      q: 'How does onboarding work?',
      a: 'Create access with work email, verify your inbox, set a secure password, and enter the platform. Tenant assignment is handled internally.',
    },
  ];

  return (
    <>
      <Navbar />
      <main id="main-content">
        <section className="site-divider py-20 md:py-28 lg:py-36">
          <Container className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr]">
            <div>
              <p className="mono-label text-xs">VerifyIQ by Nordic Data Company</p>
              <h1 className="display-heading mt-6 text-5xl md:text-7xl">Company intelligence for decisive action</h1>
              <p className="mt-6 max-w-3xl text-lg leading-relaxed text-muted-foreground">
                Discover companies, understand ownership and control, and access deeper intelligence only when it matters.
                VerifyIQ supports private equity, corporate M&A, financial institutions, and compliance teams with one
                workflow from sourcing to decision.
              </p>
              <div className="mt-10 flex flex-col gap-4 sm:flex-row">
                <Button href="/signup" variant="primary">Get access</Button>
                <Button href="/login" variant="secondary">See platform</Button>
              </div>
            </div>
            <div className="border-2 border-foreground bg-background p-6">
              <p className="mono-label text-xs">Core positioning</p>
              <ul className="mt-5 space-y-3 text-sm text-muted-foreground">
                <li>Sourcing intelligence platform for broad discovery</li>
                <li>Ownership intelligence platform for control transparency</li>
                <li>Decision support platform for faster prioritization</li>
              </ul>
            </div>
          </Container>
        </section>

        <section id="why-now" className="site-divider py-16 md:py-24">
          <Container>
            <p className="mono-label text-xs">Why this matters now</p>
            <p className="mt-6 max-w-4xl text-2xl leading-relaxed">
              As transparency requirements around verklig huvudman (UBO) increase and ownership structures become more complex,
              firms need faster, clearer decisions grounded in control reality, not surface-level snapshots.
            </p>
          </Container>
        </section>

        <section id="capabilities" className="site-divider py-16 md:py-24">
          <Container>
            <p className="mono-label text-xs">Core capabilities</p>
            <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {capabilities.map((capability) => (
                <article key={capability} className="border-2 border-foreground p-5">
                  <h3 className="font-display text-2xl">{capability}</h3>
                </article>
              ))}
            </div>
          </Container>
        </section>

        <section id="who-for" className="site-divider py-16 md:py-24">
          <Container>
            <p className="mono-label text-xs">Who it is for</p>
            <div className="mt-8 flex flex-wrap gap-3">
              {audiences.map((audience) => (
                <span key={audience} className="border-2 border-foreground px-4 py-2 text-sm">{audience}</span>
              ))}
            </div>
          </Container>
        </section>

        <section id="workflow" className="site-divider py-16 md:py-24">
          <Container>
            <p className="mono-label text-xs">Workflow</p>
            <h2 className="font-display mt-6 text-4xl md:text-6xl">Discover → Analyze → Enrich → Compare → Decide</h2>
          </Container>
        </section>

        <section id="faq" className="site-divider py-16 md:py-24">
          <Container>
            <p className="mono-label text-xs">FAQ</p>
            <div className="mt-8 space-y-4">
              {faqs.map((item) => (
                <article key={item.q} className="border-2 border-foreground p-5">
                  <h3 className="font-display text-2xl">{item.q}</h3>
                  <p className="mt-3 text-muted-foreground">{item.a}</p>
                </article>
              ))}
            </div>
          </Container>
        </section>
      </main>
      <Footer />
    </>
  );
}

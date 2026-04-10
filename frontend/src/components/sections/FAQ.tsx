'use client';

import { useState } from 'react';
import { Container } from '@/components/ui/Container';

const items = [
  {
    q: 'How does the free trial work?',
    a: 'Start with full access and evaluate VerifyIQ workflows before moving to a paid tier.',
  },
  {
    q: 'Can we change plans later?',
    a: 'Yes, plan changes can be made as your data and team requirements evolve.',
  },
  {
    q: 'Is our company data secure?',
    a: 'Yes. VerifyIQ is designed for controlled access and strict operational governance.',
  },
  {
    q: 'Do you support enterprise integrations?',
    a: 'Enterprise tiers include custom integration support and dedicated operational guidance.',
  },
];

export function FAQ() {
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  return (
    <section id="faq" className="site-divider py-24 md:py-32 lg:py-40">
      <Container>
        <p className="mono-label text-xs">FAQ</p>
        <h2 className="display-heading mt-6 text-5xl md:text-7xl">Frequently asked questions</h2>

        <div className="mt-16 border-2 border-foreground">
          {items.map((item, idx) => {
            const open = openIdx === idx;
            return (
              <article key={item.q} className="border-b-2 border-foreground last:border-b-0">
                <button
                  type="button"
                  onClick={() => setOpenIdx(open ? null : idx)}
                  className="focus-outline flex w-full items-center justify-between px-6 py-5 text-left"
                  aria-expanded={open}
                >
                  <span className="font-display text-3xl">{item.q}</span>
                  <span className="font-mono text-lg">{open ? '−' : '+'}</span>
                </button>
                {open ? <p className="px-6 pb-6 text-lg leading-relaxed text-muted-foreground">{item.a}</p> : null}
              </article>
            );
          })}
        </div>
      </Container>
    </section>
  );
}

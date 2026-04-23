import Link from 'next/link';
import { ReactNode } from 'react';
import { Container } from '@/components/ui/Container';

type AuthShellProps = {
  kicker: string;
  title: string;
  lead?: ReactNode;
  children?: ReactNode;
  /** e.g. footer row with back links */
  footer?: ReactNode;
};

/**
 * Public auth routes only — same monochrome / editorial language as the landing page
 * (no AppShell, no dashboard chrome).
 */
export function AuthShell({ kicker, title, lead, children, footer }: AuthShellProps) {
  return (
    <>
      <header className="border-b-2 border-foreground bg-background">
        <Container className="flex min-h-[72px] items-center justify-between py-3">
          <Link
            href="/"
            className="focus-outline flex min-h-11 items-center gap-3 text-foreground transition-none"
          >
            <span className="h-4 w-4 shrink-0 border-2 border-foreground bg-foreground" aria-hidden />
            <span className="mono-label text-[11px]">VerifyIQ</span>
          </Link>
          <Link
            href="/"
            className="focus-outline mono-label min-h-11 min-w-[44px] inline-flex items-center text-[11px] text-muted-foreground hover:text-foreground"
          >
            Home
          </Link>
        </Container>
      </header>
      <main id="main-content" className="site-divider min-h-[calc(100vh-73px)] py-16 md:py-24 lg:py-28">
        <Container className="!max-w-lg">
          <div
            className="relative border-2 border-foreground bg-background p-8 md:p-10"
            style={{
              backgroundImage: `
                linear-gradient(var(--background), var(--background)),
                linear-gradient(#0000000d 1px, transparent 1px),
                linear-gradient(90deg, #0000000d 1px, transparent 1px)
              `,
              backgroundSize: 'auto, 32px 32px, 32px 32px',
            }}
          >
            <div className="mb-4 flex items-center gap-3" aria-hidden>
              <div className="h-px w-12 bg-foreground" />
              <div className="h-2.5 w-2.5 border-2 border-foreground" />
            </div>
            <p className="mono-label text-xs text-muted-foreground">{kicker}</p>
            <h1 className="font-display mt-4 text-4xl leading-[0.95] tracking-tight text-foreground md:text-5xl">
              {title}
            </h1>
            {lead ? <div className="mt-4 text-base leading-relaxed text-muted-foreground md:text-lg">{lead}</div> : null}
            {children ?? null}
            {footer ? <div className="mt-8">{footer}</div> : null}
          </div>
        </Container>
      </main>
    </>
  );
}

import { Container } from '@/components/ui/Container';

export function Footer({ blurb }: { blurb?: string }) {
  return (
    <footer className="border-t-8 border-foreground bg-background py-16">
      <Container className="grid gap-10 md:grid-cols-[1.2fr_0.8fr] md:items-end">
        <div>
          <p className="font-display text-3xl leading-none tracking-tight text-foreground md:text-4xl">Nordic Data Company</p>
          <p className="mt-4 text-lg leading-relaxed text-muted-foreground">VerifyIQ</p>
          {blurb ? <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground">{blurb}</p> : null}
        </div>
        <div className="md:justify-self-end md:text-right">
          <p className="mono-label text-xs">Registry · financials · access</p>
          <p className="mt-5 text-sm leading-relaxed text-muted-foreground">
            © {new Date().getFullYear()} VerifyIQ. All rights reserved.
          </p>
        </div>
      </Container>
    </footer>
  );
}

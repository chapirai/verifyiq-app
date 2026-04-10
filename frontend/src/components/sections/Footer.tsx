import { Container } from '@/components/ui/Container';

export function Footer() {
  return (
    <footer className="site-divider py-16">
      <Container className="grid gap-6 md:grid-cols-2">
        <div>
          <p className="font-display text-4xl">Nordic Company Data</p>
          <p className="mt-3 text-lg text-muted-foreground">Product: VerifyIQ</p>
        </div>
        <div className="md:justify-self-end md:text-right">
          <p className="mono-label text-xs">Built for Company Intelligence</p>
          <p className="mt-4 text-sm text-muted-foreground">
            © {new Date().getFullYear()} VerifyIQ. All rights reserved.
          </p>
        </div>
      </Container>
    </footer>
  );
}

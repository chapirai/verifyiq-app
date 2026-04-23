import { Button } from '@/components/ui/Button';
import { Container } from '@/components/ui/Container';

export function Navbar() {
  return (
    <header className="site-divider border-b-2 border-t-0 bg-background">
      <Container className="grid min-h-[74px] grid-cols-[1fr_auto_1fr] items-center gap-4 py-3">
        <div className="flex min-h-11 items-center gap-3">
          <span className="h-4 w-4 shrink-0 border-2 border-foreground bg-foreground" aria-hidden />
          <p className="mono-label text-[11px] text-foreground">Nordic Data Company</p>
        </div>
        <nav className="hidden min-h-11 flex-wrap items-center justify-center gap-x-6 gap-y-2 lg:gap-x-8" aria-label="Page sections">
          <a
            className="focus-outline mono-label inline-flex min-h-11 min-w-0 items-center border-b-2 border-transparent px-0 py-2 text-[11px] text-muted-foreground hover:border-foreground hover:text-foreground"
            href="#product"
          >
            Product
          </a>
          <a
            className="focus-outline mono-label inline-flex min-h-11 min-w-0 items-center border-b-2 border-transparent px-0 py-2 text-[11px] text-muted-foreground hover:border-foreground hover:text-foreground"
            href="#capabilities"
          >
            Capabilities
          </a>
          <a
            className="focus-outline mono-label inline-flex min-h-11 min-w-0 items-center border-b-2 border-transparent px-0 py-2 text-[11px] text-muted-foreground hover:border-foreground hover:text-foreground"
            href="#access"
          >
            Access
          </a>
          <a
            className="focus-outline mono-label inline-flex min-h-11 min-w-0 items-center border-b-2 border-transparent px-0 py-2 text-[11px] text-muted-foreground hover:border-foreground hover:text-foreground"
            href="#workflow"
          >
            Workflow
          </a>
          <a
            className="focus-outline mono-label inline-flex min-h-11 min-w-0 items-center border-b-2 border-transparent px-0 py-2 text-[11px] text-muted-foreground hover:border-foreground hover:text-foreground"
            href="#faq"
          >
            FAQ
          </a>
          <a
            className="focus-outline mono-label inline-flex min-h-11 min-w-0 items-center border-b-2 border-transparent px-0 py-2 text-[11px] text-muted-foreground hover:border-foreground hover:text-foreground"
            href="#start"
          >
            Start
          </a>
        </nav>
        <div className="ml-auto flex min-h-11 items-center gap-1 sm:gap-2">
          <Button
            href="/login"
            variant="ghost"
            className="mono-label min-h-11 px-2 py-2 text-[11px] text-muted-foreground sm:px-3"
          >
            Log in
          </Button>
          <Button href="/signup" variant="primary" className="mono-label text-[11px]">
            Sign up
          </Button>
        </div>
      </Container>
    </header>
  );
}

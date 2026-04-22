import { Button } from '@/components/ui/Button';
import { Container } from '@/components/ui/Container';

export function Navbar() {
  return (
    <header className="site-divider border-b-2 border-t-0 bg-background">
      <Container className="grid h-[74px] grid-cols-[1fr_auto_1fr] items-center gap-4">
        <div className="flex items-center gap-3">
          <span className="h-4 w-4 border-2 border-foreground bg-foreground" />
          <p className="mono-label text-[11px] text-foreground">Nordic Data Company</p>
        </div>
        <nav className="hidden items-center gap-10 md:flex">
          <a className="focus-outline mono-label border border-transparent px-1 py-1 text-[11px] text-muted-foreground hover:text-foreground" href="#capabilities">
            Capabilities
          </a>
          <a className="focus-outline mono-label border border-transparent px-1 py-1 text-[11px] text-muted-foreground hover:text-foreground" href="#workflow">
            Workflow
          </a>
          <a className="focus-outline mono-label border border-transparent px-1 py-1 text-[11px] text-muted-foreground hover:text-foreground" href="#faq">
            FAQ
          </a>
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <Button href="/login" variant="ghost" className="mono-label text-[11px] text-muted-foreground">
            Log in
          </Button>
          <Button href="/signup" variant="primary" className="min-h-10 px-5 py-2 text-[11px]">
            Sign up
          </Button>
        </div>
      </Container>
    </header>
  );
}

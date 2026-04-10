import { Button } from '@/components/ui/Button';
import { Container } from '@/components/ui/Container';

export function Navbar() {
  return (
    <header className="site-divider border-b-2 border-t-0 bg-background">
      <Container className="grid h-16 grid-cols-[1fr_auto_1fr] items-center gap-4">
        <div className="flex items-center gap-3">
          <span className="h-4 w-4 border-2 border-foreground bg-foreground" />
          <p className="font-body text-sm text-foreground">Nordic Company Data</p>
        </div>
        <nav className="hidden items-center gap-8 md:flex">
          <a className="focus-outline border border-transparent px-1 py-1 text-xs text-muted-foreground hover:text-foreground" href="#features">
            Features
          </a>
          <a className="focus-outline border border-transparent px-1 py-1 text-xs text-muted-foreground hover:text-foreground" href="#pricing">
            Pricing
          </a>
          <a className="focus-outline border border-transparent px-1 py-1 text-xs text-muted-foreground hover:text-foreground" href="#faq">
            About
          </a>
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <Button href="#faq" variant="ghost" className="text-xs text-muted-foreground">
            Log in
          </Button>
          <Button href="#pricing" variant="primary" className="min-h-9 px-4 py-2 text-xs">
            Sign up
          </Button>
        </div>
      </Container>
    </header>
  );
}

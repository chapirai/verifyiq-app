import { Container } from '@/components/ui/Container';
import { Button } from '@/components/ui/Button';

export function Navbar() {
  return (
    <header className="sticky top-0 z-50 border-b border-[#E2E8F0] bg-[#FAFAFA]/80 backdrop-blur-md backdrop-saturate-150">
      <Container className="flex h-[65px] items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="h-4 w-4 rounded-full bg-[#0F172A]" />
          <span className="text-sm font-medium text-[#0F172A]">Nordic Company Data</span>
        </div>
        <nav className="hidden items-center gap-8 text-[11px] text-[#64748B] md:flex">
          <a href="#features">Features</a>
          <a href="#pricing">Pricing</a>
          <a href="#faq">About</a>
        </nav>
        <div className="flex items-center gap-2">
          <Button href="#faq" variant="secondary" className="h-8 rounded-[10px] border-0 px-3 text-[11px] shadow-none">
            Log in
          </Button>
          <Button href="#pricing" className="h-8 rounded-[10px] px-3 text-[11px]">
            Sign up
          </Button>
        </div>
      </Container>
    </header>
  );
}

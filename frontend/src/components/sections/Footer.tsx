import { Container } from '@/components/ui/Container';

export function Footer() {
  return (
    <footer className="border-t border-[#E2E8F0] py-16">
      <Container className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
        <div>
          <p className="text-sm font-semibold text-[#0F172A]">Nordic Company Data</p>
          <p className="text-sm text-[#64748B]">VerifyIQ platform for company intelligence workflows.</p>
        </div>
        <p className="text-sm text-[#64748B]">© {new Date().getFullYear()} VerifyIQ. All rights reserved.</p>
      </Container>
    </footer>
  );
}

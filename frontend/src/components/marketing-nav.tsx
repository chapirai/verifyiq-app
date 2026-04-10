import Link from 'next/link';

export function MarketingNav() {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-md backdrop-saturate-150">
      <div className="mx-auto flex h-[65px] w-full max-w-6xl items-center justify-between px-6 md:px-10">
      <Link href="/" className="flex items-center gap-3">
        <span
          className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-foreground"
          aria-hidden
        >
        </span>
        <div className="leading-tight">
          <p className="text-sm font-medium text-foreground">Nordic Company Data</p>
        </div>
      </Link>
      <nav className="hidden items-center gap-8 text-[11px] text-muted-foreground md:flex" aria-label="Marketing">
        <Link className="transition hover:text-foreground" href="/#product">
          Features
        </Link>
        <Link className="transition hover:text-foreground" href="/pricing">
          Pricing
        </Link>
        <Link className="transition hover:text-foreground" href="/#about">
          About
        </Link>
      </nav>
      <div className="flex items-center gap-2">
        <Link className="secondary-btn !min-h-8 rounded-[10px] border-0 bg-transparent px-3 text-[11px] shadow-none hover:bg-transparent" href="/login">
          Log in
        </Link>
        <Link className="primary-btn !min-h-8 rounded-[10px] px-3 text-[11px]" href="/signup">
          Sign up
        </Link>
      </div>
      </div>
    </header>
  );
}

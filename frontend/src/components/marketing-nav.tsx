import Link from 'next/link';

export function MarketingNav() {
  return (
    <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5 md:px-10">
      <Link href="/" className="flex items-center gap-3">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-foreground text-sm font-bold text-white"
          aria-hidden
        >
          N
        </span>
        <div className="leading-tight">
          <p className="text-sm font-semibold text-foreground">VerifyIQ</p>
          <p className="text-[11px] text-muted-foreground">Nordic Company Data</p>
        </div>
      </Link>
      <nav className="hidden items-center gap-8 text-sm text-muted-foreground md:flex" aria-label="Marketing">
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
        <Link className="secondary-btn !min-h-9 px-4 text-xs" href="/login">
          Log in
        </Link>
        <Link className="primary-btn !min-h-9 px-4 text-xs" href="/signup">
          Sign up
        </Link>
      </div>
    </header>
  );
}

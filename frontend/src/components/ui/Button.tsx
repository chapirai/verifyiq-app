import { ReactNode } from 'react';

type Variant = 'primary' | 'secondary';

interface ButtonProps {
  children: ReactNode;
  href?: string;
  variant?: Variant;
  className?: string;
}

const base =
  'inline-flex h-12 items-center justify-center rounded-xl px-7 text-base font-medium transition-all duration-200';
const styles: Record<Variant, string> = {
  primary:
    'bg-gradient-to-r from-[#0052FF] to-[#4D7CFF] text-white shadow-[0_1px_3px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04)] hover:-translate-y-0.5 hover:brightness-110 hover:shadow-[0_8px_24px_rgba(0,82,255,0.28)]',
  secondary:
    'border border-[#E2E8F0] bg-transparent text-[#0F172A] hover:border-[#CBD5E1] hover:bg-[#F8FAFC]',
};

export function Button({ children, href, variant = 'primary', className = '' }: ButtonProps) {
  const classes = `${base} ${styles[variant]} ${className}`;
  if (href) {
    return <a href={href} className={classes}>{children}</a>;
  }
  return <button className={classes} type="button">{children}</button>;
}

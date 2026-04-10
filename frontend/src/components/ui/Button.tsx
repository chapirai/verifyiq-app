import { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost';

interface ButtonProps {
  children: ReactNode;
  href?: string;
  variant?: Variant;
  className?: string;
  onClick?: ButtonHTMLAttributes<HTMLButtonElement>['onClick'];
  type?: ButtonHTMLAttributes<HTMLButtonElement>['type'];
  disabled?: boolean;
}

export function Button({ children, href, variant = 'primary', className = '', onClick, type = 'button', disabled }: ButtonProps) {
  const variantClass =
    variant === 'primary' ? 'btn-primary' : variant === 'secondary' ? 'btn-secondary' : 'bg-transparent border-0 px-0 py-0 underline underline-offset-4';
  const classes = `focus-outline ${variant === 'ghost' ? '' : 'btn-base'} ${variantClass} ${className}`;

  if (href) {
    return (
      <a href={href} className={classes}>
        {children}
      </a>
    );
  }

  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`${classes} disabled:cursor-not-allowed disabled:opacity-60`}>
      {children}
    </button>
  );
}

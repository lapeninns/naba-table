import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';

import { cn } from '@shared/lib/cn';

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-[var(--radius-md)] text-button ring-offset-background transition-[transform,box-shadow,background-color,color] duration-100 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98] button-press touch-manipulation',
  {
    variants: {
      variant: {
        default:
          'bg-[color:var(--srx-brand)] text-white shadow-sm hover:bg-[color:var(--srx-brand-soft)]',
        primary:
          'bg-[color:var(--color-primary)] text-[color:var(--color-on-primary)] hover:bg-[color:var(--color-primary)] active:bg-[color:var(--color-primary-pressed)]',
        destructive: 'bg-red-500 text-white shadow-sm hover:bg-red-600',
        outline:
          'border border-srx-border-strong bg-white/90 text-srx-ink-strong hover:bg-srx-surface-positive-alt',
        secondary: 'bg-srx-surface-positive text-srx-ink-strong hover:bg-srx-surface-positive-alt',
        ghost: 'text-srx-ink-muted hover:bg-srx-surface-positive-alt',
        link: 'text-srx-brand underline underline-offset-4 hover:text-srx-brand-soft',
      },
      size: {
        default: 'min-h-[44px] h-11 px-5 py-2.5',
        primary: 'min-h-[var(--button-height)] h-[var(--button-height)] px-6',
        sm: 'min-h-[44px] h-11 rounded-[var(--radius-sm)] px-4 py-2 text-[0.95rem]',
        lg: 'min-h-[48px] h-12 rounded-[var(--radius-lg)] px-7 py-3 text-[1.05rem]',
        icon: 'h-11 w-11',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'primary',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, type, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size }), className)}
        ref={ref}
        type={type ?? 'button'}
        {...props}
      />
    );
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };

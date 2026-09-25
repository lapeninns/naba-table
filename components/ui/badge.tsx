import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';

import { cn } from '@/lib/utils';

const badgeVariants = cva(
  // Badges/chips are pills (rounded-full) in label-sm (12px / 500).
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground shadow hover:bg-primary/80',
        'guest-chip':
          'border-transparent bg-[var(--pg-bg-muted)] text-[var(--pg-text)] rounded-[var(--pg-radius-pill)] px-3 py-1 min-h-8 text-[var(--pg-text-caption)] font-medium',
        'guest-chip-outline':
          'border-[color:var(--pg-border)] bg-transparent text-[var(--pg-text)] rounded-[var(--pg-radius-pill)] px-3 py-1 min-h-8 text-[var(--pg-text-caption)] font-medium',
        secondary:
          'border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80',
        destructive:
          'border-transparent bg-destructive text-destructive-foreground shadow hover:bg-destructive/80',
        outline: 'text-foreground',
        'status-confirmed': 'border-transparent bg-success/10 text-success-text',
        'status-pending': 'border-transparent bg-warning/10 text-warning-text',
        'status-completed': 'border-transparent bg-secondary text-secondary-foreground',
        'status-cancelled': 'border-transparent bg-destructive/10 text-destructive',
        metric: 'border-transparent bg-primary/10 text-primary',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };

import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';

import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground shadow hover:bg-primary/80',
        secondary:
          'border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80',
        destructive:
          'border-transparent bg-destructive text-destructive-foreground shadow hover:bg-destructive/80',
        outline: 'text-foreground',
        'status-confirmed':
          'border-transparent bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100',
        'status-pending':
          'border-transparent bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100',
        'status-completed':
          'border-transparent bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100',
        'status-cancelled':
          'border-transparent bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100',
        metric:
          'border-transparent bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
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

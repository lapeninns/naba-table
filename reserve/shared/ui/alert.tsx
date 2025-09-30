import * as React from 'react';

import { cn } from '@shared/lib/cn';

const alertVariants = {
  default: 'border border-srx-border-subtle bg-white/95 text-srx-ink-strong shadow-card',
  destructive: 'border border-red-200 bg-red-50 text-red-700 [&>svg]:text-red-600',
  info: 'border border-srx-border-subtle bg-srx-surface-info text-srx-ink-strong',
  success: 'border border-emerald-200 bg-emerald-50 text-emerald-700 [&>svg]:text-emerald-600',
  warning: 'border border-amber-200 bg-amber-50 text-amber-700 [&>svg]:text-amber-600',
} as const;

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: keyof typeof alertVariants;
}

const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  ({ className, variant = 'default', role = 'alert', ...props }, ref) => (
    <div
      ref={ref}
      role={role}
      className={cn(
        'relative flex w-full gap-3 rounded-[var(--radius-md)] px-4 py-3 text-sm',
        alertVariants[variant],
        className,
      )}
      {...props}
    />
  ),
);
Alert.displayName = 'Alert';

const AlertIcon = ({ children }: React.PropsWithChildren) => (
  <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center" aria-hidden>
    {children}
  </span>
);

const AlertTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p ref={ref} className={cn('font-semibold leading-none tracking-tight', className)} {...props} />
));
AlertTitle.displayName = 'AlertTitle';

const AlertDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn('text-sm text-srx-ink-soft [&_p]:leading-relaxed', className)}
    {...props}
  />
));
AlertDescription.displayName = 'AlertDescription';

export { Alert, AlertIcon, AlertTitle, AlertDescription };

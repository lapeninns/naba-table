import * as React from "react";

import { cn } from "@/lib/utils";

const ALERT_VARIANTS = {
  default: "bg-base-100 text-srx-ink-strong border border-[color:var(--color-border)]",
  destructive: "alert-error text-error-content",
  info: "alert-info",
  success: "alert-success",
  warning: "alert-warning",
} as const;

type AlertVariant = keyof typeof ALERT_VARIANTS;

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: AlertVariant;
}

const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  ({ className, variant = "default", role = "alert", ...props }, ref) => (
    <div
      ref={ref}
      role={role}
      className={cn(
        "alert shadow-sm gap-3 rounded-[var(--radius-md)] text-sm",
        ALERT_VARIANTS[variant],
        className,
      )}
      {...props}
    />
  ),
);
Alert.displayName = "Alert";

const AlertIcon = ({ children }: React.PropsWithChildren) => (
  <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center" aria-hidden>
    {children}
  </span>
);

const AlertTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn("font-semibold leading-none tracking-tight", className)} {...props} />
  ),
);
AlertTitle.displayName = "AlertTitle";

const AlertDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p ref={ref} className={cn("text-sm text-srx-ink-soft [&_p]:leading-relaxed", className)} {...props} />
));
AlertDescription.displayName = "AlertDescription";

export { Alert, AlertIcon, AlertTitle, AlertDescription };

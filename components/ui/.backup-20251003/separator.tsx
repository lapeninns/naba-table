import * as React from "react";

import { cn } from "@/lib/utils";

export interface SeparatorProps extends React.HTMLAttributes<HTMLDivElement> {
  decorative?: boolean;
}

const Separator = React.forwardRef<HTMLDivElement, SeparatorProps>(
  ({ className, decorative = true, role, ...props }, ref) => (
    <div
      ref={ref}
      role={decorative ? "presentation" : role ?? "separator"}
      aria-hidden={decorative ? true : undefined}
      className={cn("shrink-0 bg-[color:var(--color-border)]", "h-px w-full", className)}
      {...props}
    />
  ),
);
Separator.displayName = "Separator";

export { Separator };

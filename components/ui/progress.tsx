import * as React from "react";

import { cn } from "@/lib/utils";

export interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number;
  max?: number;
}

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value = 0, max = 100, children, ...props }, ref) => {
    const clamped = Math.min(Math.max(value, 0), max);
    const percentage = max === 0 ? 0 : (clamped / max) * 100;

    return (
      <div
        ref={ref}
        className={cn(
          "relative h-2 w-full overflow-hidden rounded-full bg-[color:var(--color-border)]/60",
          className,
        )}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={Math.round(percentage)}
        {...props}
      >
        <div
          className="h-full w-full origin-left rounded-full bg-[color:var(--color-primary)] transition-transform duration-fast ease-srx-standard"
          style={{ transform: `scaleX(${percentage / 100})` }}
        />
        {children}
      </div>
    );
  },
);
Progress.displayName = "Progress";

export { Progress };

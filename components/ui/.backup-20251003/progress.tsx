import * as React from "react";

import { cn } from "@/lib/utils";

export interface ProgressProps extends React.ProgressHTMLAttributes<HTMLProgressElement> {
  value?: number;
  max?: number;
}

const Progress = React.forwardRef<HTMLProgressElement, ProgressProps>(
  ({ className, value = 0, max = 100, ...props }, ref) => {
    const clamped = Math.min(Math.max(value, 0), max);

    return (
      <progress
        ref={ref}
        className={cn("progress progress-primary w-full", className)}
        value={clamped}
        max={max}
        {...props}
      />
    );
  },
);
Progress.displayName = "Progress";

export { Progress };

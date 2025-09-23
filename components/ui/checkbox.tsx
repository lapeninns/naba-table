import * as React from "react";

import { cn } from "@/lib/utils";

export interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(({ className, ...props }, ref) => {
  return (
    <input
      type="checkbox"
      ref={ref}
      className={cn(
        "relative h-5 w-5 min-h-[1.5rem] min-w-[1.5rem] shrink-0 rounded-md border border-srx-border-strong bg-white text-[color:var(--srx-brand)] transition-[border-color,box-shadow,background-color] duration-fast ease-srx-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-srx-brand focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
});
Checkbox.displayName = "Checkbox";

export { Checkbox };

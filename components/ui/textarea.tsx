import * as React from "react";

import { cn } from "@/lib/utils";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[96px] w-full rounded-lg border border-srx-border-subtle bg-white/80 px-4 py-2.5 text-base text-srx-ink-strong placeholder:text-srx-ink-soft transition-[border-color,box-shadow,background-color] duration-fast ease-srx-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-srx-brand focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Textarea.displayName = "Textarea";

export { Textarea };

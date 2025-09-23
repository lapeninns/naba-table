import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-xl text-sm font-semibold ring-offset-background transition-[transform,box-shadow,background-color,color] duration-fast ease-srx-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-srx-brand focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.985]",
  {
    variants: {
      variant: {
        default: "bg-[color:var(--srx-brand)] text-white shadow-sm hover:bg-[color:var(--srx-brand-soft)]",
        destructive: "bg-red-500 text-white shadow-sm hover:bg-red-600",
        outline:
          "border border-srx-border-strong bg-white/90 text-srx-ink-strong hover:bg-srx-surface-positive-alt",
        secondary: "bg-srx-surface-positive text-srx-ink-strong hover:bg-srx-surface-positive-alt",
        ghost: "text-srx-ink-muted hover:bg-srx-surface-positive-alt",
        link: "text-srx-brand underline underline-offset-4 hover:text-srx-brand-soft",
      },
      size: {
        default: "min-h-[44px] h-11 rounded-xl px-5 py-2.5 text-body",
        sm: "min-h-[40px] h-10 rounded-lg px-4 py-2 text-[0.95rem]",
        lg: "min-h-[48px] h-12 rounded-2xl px-7 py-3 text-[1.05rem]",
        icon: "h-10 w-10 rounded-xl",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
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
        type={type ?? "button"}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };

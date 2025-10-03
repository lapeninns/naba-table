import * as React from "react";

import { cn } from "@/lib/utils";

type ButtonVariant =
  | "primary"
  | "default"
  | "destructive"
  | "outline"
  | "secondary"
  | "ghost"
  | "link";

type ButtonSize = "primary" | "default" | "sm" | "lg" | "icon";

const BASE_BUTTON_CLASSES =
  "btn inline-flex items-center justify-center whitespace-nowrap font-semibold tracking-tight transition-transform duration-150 ease-out active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-primary)] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 touch-manipulation";

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: "btn-primary text-[color:var(--color-on-primary)]",
  default: "btn-primary text-base-100",
  destructive: "btn-error text-base-100",
  outline:
    "btn-outline border-[color:var(--color-border)] bg-base-100 text-srx-ink-strong hover:bg-base-200",
  secondary: "bg-srx-surface-positive text-srx-ink-strong hover:bg-srx-surface-positive-alt",
  ghost: "btn-ghost text-srx-ink-muted hover:bg-base-200",
  link: "btn-link text-srx-brand no-underline hover:text-srx-brand-soft",
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  primary: "min-h-[var(--button-height)] px-6",
  default: "min-h-[2.75rem] px-5",
  sm: "btn-sm",
  lg: "btn-lg",
  icon: "btn-square h-11 w-11",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export function buttonVariants({
  variant = "primary",
  size = "primary",
}: { variant?: ButtonVariant; size?: ButtonSize } = {}) {
  return cn(BASE_BUTTON_CLASSES, VARIANT_CLASSES[variant], SIZE_CLASSES[size]);
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "primary", type, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size }), className)}
      type={type ?? "button"}
      {...props}
    />
  ),
);
Button.displayName = "Button";

export { Button };

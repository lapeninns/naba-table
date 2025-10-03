import * as React from "react"

import { cn } from "@/lib/utils"

type BadgeVariant = "default" | "secondary" | "destructive" | "outline"

const BASE_BADGE_CLASSES =
  "badge inline-flex items-center gap-1 rounded-md px-2.5 py-0.5 text-xs font-semibold"

const VARIANT_MAP: Record<BadgeVariant, string> = {
  default: "badge-primary text-base-100",
  secondary: "badge-neutral text-base-100",
  destructive: "badge-error text-error-content",
  outline: "badge-outline text-srx-ink-strong",
}

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: BadgeVariant
}

function badgeVariants(variant: BadgeVariant = "default") {
  return cn(BASE_BADGE_CLASSES, VARIANT_MAP[variant])
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return <div className={cn(badgeVariants(variant), className)} {...props} />
}

export { Badge, badgeVariants }

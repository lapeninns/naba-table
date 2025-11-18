"use client";

import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  Circle,
  Clock,
  LogIn,
  Square,
  type LucideIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import type { OpsBookingStatus } from "@/types/ops";
import type { CSSProperties, ReactElement } from "react";

type BadgeSize = "sm" | "md" | "lg";

export type StatusBadgeConfig = {
  label: string;
  description: string;
  icon: LucideIcon;
  className: string;
  pulse?: boolean;
};

export const BOOKING_STATUS_CONFIG: Record<OpsBookingStatus, StatusBadgeConfig> = {
  pending: {
    label: "Pending",
    description: "Awaiting confirmation or allocation.",
    icon: Clock,
    className: "border-amber-200 bg-amber-50 text-amber-800",
  },
  pending_allocation: {
    label: "Pending allocation",
    description: "Needs table allocation.",
    icon: Square,
    className: "border-slate-200 bg-slate-100 text-slate-800",
  },
  confirmed: {
    label: "Confirmed",
    description: "Guest is confirmed to arrive.",
    icon: CheckCircle2,
    className: "border-sky-200 bg-sky-50 text-sky-700",
  },
  checked_in: {
    label: "Checked in",
    description: "Guest has arrived and is seated.",
    icon: LogIn,
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    pulse: true,
  },
  completed: {
    label: "Completed",
    description: "Visit is finished and closed out.",
    icon: Circle,
    className: "border-slate-200 bg-slate-100 text-slate-700",
  },
  cancelled: {
    label: "Cancelled",
    description: "Booking was cancelled.",
    icon: Ban,
    className: "border-slate-300 bg-slate-100 text-slate-700",
  },
  no_show: {
    label: "No show",
    description: "Guest did not arrive for the booking.",
    icon: AlertTriangle,
    className: "border-rose-200 bg-rose-50 text-rose-700",
  },
};

const SIZE_VARIANTS: Record<BadgeSize, string> = {
  sm: "h-6 px-2 text-[11px]",
  md: "h-7 px-2.5 text-xs",
  lg: "h-8 px-3 text-sm",
};

const ICON_SIZE: Record<BadgeSize, string> = {
  sm: "h-3 w-3",
  md: "h-3.5 w-3.5",
  lg: "h-4 w-4",
};

export type BookingStatusBadgeProps = {
  status: OpsBookingStatus;
  size?: BadgeSize;
  showIcon?: boolean;
  showTooltip?: boolean;
  className?: string;
  ariaLabel?: string;
};

function renderBadgeContent(
  status: OpsBookingStatus,
  size: BadgeSize,
  showIcon: boolean,
): { icon: ReactElement | null; label: string } {
  const config = BOOKING_STATUS_CONFIG[status];
  const Icon = config.icon;
  return {
    icon: showIcon ? <Icon aria-hidden className={cn(ICON_SIZE[size], "shrink-0")} /> : null,
    label: config.label,
  };
}

export function BookingStatusBadge({
  status,
  size = "md",
  showIcon = true,
  showTooltip = true,
  className,
  ariaLabel,
}: BookingStatusBadgeProps) {
  const config = BOOKING_STATUS_CONFIG[status] ?? BOOKING_STATUS_CONFIG.confirmed;
  const { icon, label } = renderBadgeContent(status, size, showIcon);

  const badge = (
    <Badge
      variant="outline"
      tabIndex={0}
      role="status"
      aria-label={ariaLabel ?? `${label} status`}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-semibold tracking-wide focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-ring",
        SIZE_VARIANTS[size],
        config.pulse ? "motion-safe:animate-pulse" : "",
        config.className,
        className,
      )}
    >
      {icon}
      <span>{label}</span>
    </Badge>
  );

  if (!showTooltip) {
    return badge;
  }

  return (
    <Tooltip delayDuration={100}>
      <TooltipTrigger asChild>{badge}</TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs text-xs leading-snug">
        {config.description}
      </TooltipContent>
    </Tooltip>
  );
}

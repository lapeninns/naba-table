'use client';

import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { getOpsBookingStatusUi } from '@/lib/ops/booking-status';
import { cn } from '@/lib/utils';

import type { OpsBookingStatus } from '@/types/ops';
import type { ReactElement } from 'react';

type BadgeSize = 'sm' | 'md' | 'lg';

const SIZE_VARIANTS: Record<BadgeSize, string> = {
  sm: 'h-6 px-2 text-[11px]',
  md: 'h-7 px-2.5 text-xs',
  lg: 'h-8 px-3 text-sm',
};

const ICON_SIZE: Record<BadgeSize, string> = {
  sm: 'h-3 w-3',
  md: 'h-3.5 w-3.5',
  lg: 'h-4 w-4',
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
  const ui = getOpsBookingStatusUi(status);
  const Icon = ui.icon;
  return {
    icon: showIcon ? <Icon aria-hidden className={cn(ICON_SIZE[size], 'shrink-0')} /> : null,
    label: ui.label,
  };
}

export function BookingStatusBadge({
  status,
  size = 'md',
  showIcon = true,
  showTooltip = true,
  className,
  ariaLabel,
}: BookingStatusBadgeProps) {
  const config = getOpsBookingStatusUi(status);
  const { icon, label } = renderBadgeContent(status, size, showIcon);

  const badge = (
    <Badge
      variant="outline"
      role="status"
      aria-label={ariaLabel ?? `${label} status`}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full font-semibold tracking-wide',
        SIZE_VARIANTS[size],
        config.pulse ? 'motion-safe:animate-pulse' : '',
        config.badgeClass,
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

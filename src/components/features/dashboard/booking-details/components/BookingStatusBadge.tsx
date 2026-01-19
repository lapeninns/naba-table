/**
 * BookingStatusBadge Component
 *
 * Single Responsibility: Display booking status with appropriate styling
 * Open/Closed: Uses getStatusConfig for extensibility
 */

'use client';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

import { getStatusConfig } from '../utils';

import type { OpsBookingStatus } from '@/types/ops';

export interface BookingStatusBadgeProps {
  status: OpsBookingStatus;
  className?: string;
}

export function BookingStatusBadge({ status, className }: BookingStatusBadgeProps) {
  const config = getStatusConfig(status);

  return (
    <Badge variant="outline" className={cn('px-3 py-1 text-xs font-semibold', config.color, config.bg, className)}>
      {config.label}
    </Badge>
  );
}

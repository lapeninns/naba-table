import React from 'react';

import { Badge } from '@/components/ui/badge';
import type { BadgeProps } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

import type { BookingStatus } from '@/hooks/useBookings';

type StatusChipConfig = {
  label: string;
  variant: BadgeProps['variant'];
  className: string;
  dotClassName: string;
};

const STATUS_CONFIG: Record<BookingStatus, StatusChipConfig> = {
  confirmed: {
    label: 'Confirmed',
    variant: 'secondary',
    className: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    dotClassName: 'before:bg-emerald-600',
  },
  checked_in: {
    label: 'Checked in',
    variant: 'secondary',
    className: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    dotClassName: 'before:bg-emerald-600',
  },
  pending: {
    label: 'Pending',
    variant: 'outline',
    className: 'border-amber-200 bg-amber-50 text-amber-800',
    dotClassName: 'before:bg-amber-500',
  },
  pending_allocation: {
    label: 'Pending allocation',
    variant: 'outline',
    className: 'border-sky-200 bg-sky-50 text-sky-700',
    dotClassName: 'before:bg-sky-500',
  },
  cancelled: {
    label: 'Cancelled',
    variant: 'destructive',
    className: 'border-rose-200 bg-rose-50 text-rose-700',
    dotClassName: 'before:bg-rose-600',
  },
  completed: {
    label: 'Completed',
    variant: 'outline',
    className: 'border-slate-200 bg-slate-100 text-slate-700',
    dotClassName: 'before:bg-slate-500',
  },
  no_show: {
    label: 'No show',
    variant: 'outline',
    className: 'border-slate-200 bg-slate-100 text-slate-700',
    dotClassName: 'before:bg-slate-500',
  },
};

export function StatusChip({ status }: { status: BookingStatus }) {
  const { label, variant, className, dotClassName } = STATUS_CONFIG[status];

  return (
    <Badge
      variant={variant}
      aria-label={`Booking status: ${label}`}
      className={cn(
        'relative flex items-center gap-2 px-3 py-1 text-xs font-medium capitalize',
        'before:block before:h-2 before:w-2 before:rounded-full before:content-[""]',
        className,
        dotClassName,
      )}
    >
      {label}
    </Badge>
  );
}

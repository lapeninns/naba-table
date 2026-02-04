'use client';

import {
  Calendar,
  ChevronDown,
  Clock,
  Sparkles,
  Users,
} from 'lucide-react';
import { memo } from 'react';

import { StatusBadge } from '@/components/features/dashboard/StatusBadge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

import type { BookingMeta, UrgencyBadge } from './opsBookingCardUtils';
import type { BookingDTO } from '@/hooks/useBookings';

export type OpsBookingCardHeaderProps = {
  booking: BookingDTO;
  meta: BookingMeta;
  urgency: UrgencyBadge | null;
  isOpen: boolean;
  disableActions: boolean;
  showCollapseToggle?: boolean;
};

export const OpsBookingCardHeader = memo(function OpsBookingCardHeader({
  booking,
  meta,
  urgency,
  isOpen,
  disableActions,
  showCollapseToggle = true,
}: OpsBookingCardHeaderProps) {
  return (
    <div className="p-3 pb-2 sm:p-4 sm:pb-4">
      <div className="mb-2 flex items-start justify-between gap-4 sm:mb-4">
        <div className="flex min-w-0 gap-3">
          <Avatar>
            <AvatarFallback
              className={cn(
                'text-sm font-bold',
                meta.isDone ? 'bg-slate-100' : 'bg-blue-50 text-blue-600',
              )}
            >
              {meta.initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p
                id={`guest-name-${booking.id}`}
                className={cn(
                  'break-words text-[15px] font-semibold leading-tight',
                  meta.isDone
                    ? 'text-muted-foreground line-through decoration-border/60'
                    : 'text-foreground',
                )}
                title={meta.customerLabel}
              >
                {meta.customerLabel}
              </p>
              {booking.loyaltyTier ? (
                <Sparkles className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
              ) : null}
            </div>
            <div className="mt-1 flex flex-col gap-1 text-xs font-medium text-slate-500 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-2 sm:gap-y-1.5 sm:text-sm">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 sm:contents">
                <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                  <Users className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  <span>{booking.partySize} Guests</span>
                </span>
                <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                  <Calendar className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  <span>{meta.dateLabel}</span>
                </span>
              </div>
              <div className="flex items-center sm:contents">
                <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-600">
                  <Clock className="h-3 w-3" aria-hidden />
                  {meta.timeRangeLabel}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <div className="flex items-center gap-2">
            <StatusBadge status={booking.status} />
            {showCollapseToggle ? (
              <CollapsibleTrigger asChild className="sm:hidden">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 rounded-full p-0 transition-colors duration-150 hover:bg-slate-100 motion-reduce:transition-none"
                  disabled={disableActions}
                >
                  <ChevronDown
                    className={cn(
                      'h-4 w-4 text-slate-400 transition-transform duration-150 ease-out motion-reduce:transition-none',
                      isOpen && 'rotate-180',
                    )}
                  />
                  <span className="sr-only">Toggle details</span>
                </Button>
              </CollapsibleTrigger>
            ) : null}
          </div>
          {urgency ? (
            <Badge
              variant={urgency.variant === 'destructive' ? 'destructive' : 'outline'}
              className={cn(
                'py-0.5 text-[9px] uppercase tracking-wider',
                urgency.variant === 'warning' && 'border-amber-200 bg-amber-50 text-amber-700',
              )}
            >
              <Clock className="mr-1 h-3 w-3" aria-hidden /> {urgency.label}
            </Badge>
          ) : null}
        </div>
      </div>
    </div>
  );
});

OpsBookingCardHeader.displayName = 'OpsBookingCardHeader';

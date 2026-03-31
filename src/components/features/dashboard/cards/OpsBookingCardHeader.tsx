'use client';

import {
  Calendar,
  ChevronDown,
  Clock,
  FileText,
  Users,
} from 'lucide-react';
import { memo } from 'react';

import { BookingStatusBadge } from '@/components/features/booking-state-machine';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

import type { OpsBookingCardHeaderViewModel } from './opsBookingCardUtils';
import type { OpsBookingStatus } from '@/types/ops';

export type OpsBookingCardHeaderProps = {
  header: OpsBookingCardHeaderViewModel;
  isOpen: boolean;
  showCollapseToggle?: boolean;
};

export const OpsBookingCardHeader = memo(function OpsBookingCardHeader({
  header,
  isOpen,
  showCollapseToggle = true,
}: OpsBookingCardHeaderProps) {
  const {
    bookingId,
    status,
    customerLabel,
    initials,
    partySizeLabel,
    dateLabel,
    timeRangeLabel,
    isDone,
    hasNotes,
    urgency,
  } = header;

  return (
    <div className="p-3 pb-2 sm:p-4 sm:pb-4">
      <div className="mb-2 flex items-start justify-between gap-4 sm:mb-4">
        <div className="flex min-w-0 gap-3">
          <Avatar>
            <AvatarFallback
              className={cn(
                'text-sm font-semibold',
                isDone ? 'bg-muted/50 text-muted-foreground' : 'bg-muted/60 text-foreground/80',
              )}
            >
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p
                id={`guest-name-${bookingId}`}
                className={cn(
                  'break-words text-[15px] font-semibold leading-tight',
                  isDone
                    ? 'text-muted-foreground line-through decoration-border/60'
                    : 'text-foreground',
                )}
                title={customerLabel}
              >
                {customerLabel}
              </p>
            </div>
            <div className="mt-1 flex flex-col gap-1 text-xs font-medium text-muted-foreground sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-2 sm:gap-y-1.5 sm:text-sm">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 sm:contents">
                <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                  <Users className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  <span>{partySizeLabel}</span>
                </span>
                <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                  <Calendar className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  <span>{dateLabel}</span>
                </span>
              </div>
              <div className="flex items-center sm:contents">
                <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded bg-muted/40 px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                  <Clock className="h-3 w-3" aria-hidden />
                  {timeRangeLabel}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <div className="flex items-center gap-2">
            <BookingStatusBadge
              status={status as OpsBookingStatus}
              size="sm"
              showTooltip={false}
            />
            {showCollapseToggle ? (
              <CollapsibleTrigger asChild className="sm:hidden">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-11 w-11 rounded-full p-0 transition-colors duration-150 hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none"
                  aria-expanded={isOpen}
                  aria-controls={`ops-booking-details-${bookingId}`}
                >
                  <ChevronDown
                    className={cn(
                      'h-4 w-4 text-muted-foreground transition-transform duration-150 ease-out motion-reduce:transition-none',
                      isOpen && 'rotate-180',
                    )}
                  />
                  <span className="sr-only">Toggle details</span>
                </Button>
              </CollapsibleTrigger>
            ) : null}
          </div>
          {showCollapseToggle && !isOpen && hasNotes ? (
            <Badge
              variant="secondary"
              className="sm:hidden"
            >
              <FileText className="mr-1 h-3 w-3" aria-hidden />
              Notes
              <span className="sr-only"> available. Expand details to read.</span>
            </Badge>
          ) : null}
          {urgency ? (
            <Badge
              variant={urgency.variant === 'destructive' ? 'destructive' : 'outline'}
              className={cn(
                'py-0.5 text-xs uppercase tracking-wider',
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

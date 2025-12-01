'use client';

import { Calendar as CalendarIcon, Clock, History, Keyboard, MoreHorizontal } from 'lucide-react';

import { BookingStatusBadge, StatusTransitionAnimator } from '@/components/features/booking-state-machine';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useBookingState } from '@/contexts/booking-state-machine';
import { cn } from '@/lib/utils';
import { formatDateReadable, formatTimeRange } from '@/lib/utils/datetime';
import { formatCountdown } from '@/lib/utils/relative-time';

import { COUNTDOWN_THRESHOLDS } from '../constants';

import type { BookingHeaderProps } from '../types';

/**
 * Booking header with status, date/time, and actions menu
 * Single Responsibility: Display booking header information and actions
 */
export function BookingHeader({
  booking,
  summary,
  effectiveStatus,
  minutesRemaining,
  timeStatus,
  checkedInRelativeTime,
  supportsTableAssignment,
  onOpenHistory,
  onOpenShortcuts,
}: BookingHeaderProps) {
  const bookingState = useBookingState(booking.id);

  const serviceDateReadable = formatDateReadable(summary.date, summary.timezone);
  const serviceTime = formatTimeRange(booking.startTime, booking.endTime, summary.timezone);

  const showCountdown =
    minutesRemaining !== null &&
    timeStatus !== 'past' &&
    minutesRemaining <= COUNTDOWN_THRESHOLDS.showCountdown;

  return (
    <div className="flex flex-col gap-4 border-b p-6">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-lg font-medium text-foreground">
            <CalendarIcon className="h-5 w-5 text-muted-foreground" />
            <span>{serviceDateReadable}</span>
            <span className="text-muted-foreground">·</span>
            <Clock className="h-5 w-5 text-muted-foreground" />
            <span>{serviceTime}</span>
          </div>
          <div className="flex items-center gap-2">
            {/* Countdown Timer */}
            {showCountdown ? (
              <Badge
                variant="outline"
                className={cn(
                  'font-medium',
                  timeStatus === 'imminent'
                    ? 'animate-pulse border-orange-500 bg-orange-100 text-orange-900'
                    : 'border-blue-500 bg-blue-100 text-blue-900'
                )}
              >
                Starts in {formatCountdown(minutesRemaining)}
              </Badge>
            ) : null}

            {checkedInRelativeTime && (
              <span className="text-sm text-muted-foreground">
                Checked in {checkedInRelativeTime}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <StatusTransitionAnimator
            status={bookingState.status}
            effectiveStatus={bookingState.effectiveStatus}
            isTransitioning={bookingState.isTransitioning}
            className="inline-flex rounded-full"
            overlayClassName="inline-flex"
          >
            <BookingStatusBadge status={effectiveStatus} className="h-8 px-3 text-sm" />
          </StatusTransitionAnimator>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
                <span className="sr-only">More options</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuItem onClick={onOpenHistory}>
                <History className="mr-2 h-4 w-4" />
                View history
              </DropdownMenuItem>
              {supportsTableAssignment && (
                <DropdownMenuItem onClick={onOpenShortcuts}>
                  <Keyboard className="mr-2 h-4 w-4" />
                  Keyboard shortcuts
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}

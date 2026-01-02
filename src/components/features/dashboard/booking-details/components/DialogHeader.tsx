'use client';

import { Calendar, Clock, Users, X } from 'lucide-react';

import { Button } from '@/components/ui/button';

import { ArrivalCountdown } from './ArrivalCountdown';
import { BookingStatusBadge } from './BookingStatusBadge';
import { ClickToCopy } from './ClickToCopy';
import { getGuestInitials } from '../utils';

import type { OpsBookingStatus, OpsTodayBooking } from '@/types/ops';

export interface DialogHeaderProps {
  booking: OpsTodayBooking | null;
  status: OpsBookingStatus;
  formattedDate: string;
  formattedStartTime: string;
  bookingDate: string | null;
  timezone: string;
  minutesRemaining: number | null;
  onClose: () => void;
}

export function DialogHeader({
  booking,
  status,
  formattedDate,
  formattedStartTime,
  bookingDate,
  timezone,
  minutesRemaining,
  onClose,
}: DialogHeaderProps) {
  return (
    <div className="grid grid-cols-[1fr_auto] gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-sm font-semibold shrink-0">
          {booking ? getGuestInitials(booking.customerName) : '--'}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-base font-semibold text-foreground truncate">
              {booking?.customerName ?? 'Booking details'}
            </span>
            <BookingStatusBadge status={status} />
          </div>
          <div className="flex sm:hidden items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
            <span>{formattedDate}</span>
            <span>·</span>
            <span>{formattedStartTime}</span>
            <span>·</span>
            <span>{booking?.partySize ?? '--'} covers</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="hidden sm:flex items-center gap-1.5">
          <div className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-purple-50 text-purple-700 text-xs font-medium">
            <Calendar className="h-3 w-3" />
            {formattedDate}
          </div>
          <div className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-slate-100 text-slate-700 text-xs font-medium">
            <Clock className="h-3 w-3" />
            {formattedStartTime}
          </div>
          <div className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-blue-50 text-blue-700 text-xs font-medium">
            <Users className="h-3 w-3" />
            {booking?.partySize ?? '--'}
          </div>
          {minutesRemaining !== null ? (
            <ArrivalCountdown status={status} startTime={booking?.startTime ?? null} date={bookingDate} timezone={timezone} />
          ) : null}
        </div>

        {booking?.reference || booking?.id ? (
          <ClickToCopy text={booking.reference ?? booking.id} label="Ref" compact />
        ) : null}

        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="h-8 w-8 rounded-full"
          aria-label="Close booking details"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

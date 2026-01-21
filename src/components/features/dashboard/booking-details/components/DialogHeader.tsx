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
    <div className="flex flex-col sm:flex-row gap-3 sm:items-start justify-between">
      <div className="flex items-start gap-3 min-w-0 flex-1">
        <div className="h-10 w-10 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-sm font-bold shrink-0 ring-1 ring-slate-200">
          {booking ? getGuestInitials(booking.customerName) : '--'}
        </div>

        <div className="min-w-0 flex-1 pt-0.5">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-[15px] font-semibold leading-tight text-foreground break-words">
              {booking?.customerName ?? 'Booking details'}
            </span>
            <BookingStatusBadge status={status} />
          </div>

          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium text-slate-500">
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-slate-400" />
              {formattedDate}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-slate-400" />
              {formattedStartTime}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 text-slate-400" />
              {booking?.partySize ?? '--'} covers
            </span>
            {minutesRemaining !== null && (
              <div className="ml-1">
                <ArrivalCountdown
                  status={status}
                  startTime={booking?.startTime ?? null}
                  date={bookingDate}
                  timezone={timezone}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 shrink-0 absolute top-3 right-3 sm:static sm:top-auto sm:right-auto">
        {booking?.reference || booking?.id ? (
          <div className="hidden sm:block">
            <ClickToCopy text={booking.reference ?? booking.id} label="Ref" compact />
          </div>
        ) : null}

        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="h-8 w-8 rounded-full hover:bg-slate-100 -mr-2 sm:mr-0"
          aria-label="Close booking details"
        >
          <X className="h-4 w-4 text-slate-500" />
        </Button>
      </div>
    </div>
  );
}

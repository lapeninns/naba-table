'use client';

import { Calendar, Check, Clock, Copy, Users, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { BookingStatusBadge } from '@/components/features/booking-state-machine';
import { Button } from '@/components/ui/button';

import { ArrivalCountdown } from './ArrivalCountdown';
import { ClickToCopy } from './ClickToCopy';
import { copyToClipboard, getGuestInitials } from '../utils';

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
  const [refCopied, setRefCopied] = useState(false);

  useEffect(() => {
    if (!refCopied) return;
    const t = window.setTimeout(() => setRefCopied(false), 1800);
    return () => window.clearTimeout(t);
  }, [refCopied]);

  const handleCopyRef = useCallback(async () => {
    const refText = booking?.reference ?? booking?.id ?? null;
    if (!refText) return;
    const ok = await copyToClipboard(refText);
    setRefCopied(ok);
  }, [booking?.id, booking?.reference]);

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex items-start gap-3 min-w-0 flex-1">
        <div className="h-10 w-10 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-sm font-bold shrink-0 ring-1 ring-slate-200">
          {booking ? getGuestInitials(booking.customerName) : '--'}
        </div>

        <div className="min-w-0 flex-1 pt-0.5">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-[15px] font-semibold leading-tight text-foreground break-words">
              {booking?.customerName ?? 'Booking details'}
            </span>
            <BookingStatusBadge status={status} size="sm" showTooltip={false} />
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

      <div className="flex items-center justify-end gap-2 shrink-0 self-start">
        {booking?.reference || booking?.id ? (
          <>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={handleCopyRef}
              className="h-8 w-8 rounded-full hover:bg-slate-100 sm:hidden"
              aria-label="Copy booking reference"
            >
              {refCopied ? (
                <Check className="h-4 w-4 text-emerald-600" aria-hidden />
              ) : (
                <Copy className="h-4 w-4 text-slate-500" aria-hidden />
              )}
            </Button>

            <div className="hidden sm:block">
              <ClickToCopy text={booking.reference ?? booking.id} label="Ref" compact />
            </div>
          </>
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

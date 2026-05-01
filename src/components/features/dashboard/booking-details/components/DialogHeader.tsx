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
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-bold text-muted-foreground ring-1 ring-border">
          {booking ? getGuestInitials(booking.customerName) : '--'}
        </div>

        <div className="min-w-0 flex-1 pt-0.5">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-[15px] font-semibold leading-tight text-foreground break-words">
              {booking?.customerName ?? 'Booking details'}
            </span>
            <BookingStatusBadge status={status} size="sm" showTooltip={false} />
          </div>

          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
              {formattedDate}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
              {formattedStartTime}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 text-muted-foreground" />
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

      <div className="flex shrink-0 items-center justify-end gap-2 self-start">
        {booking?.reference || booking?.id ? (
          <>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={handleCopyRef}
              className="h-8 w-8 rounded-full hover:bg-muted sm:hidden"
              aria-label="Copy booking reference"
            >
              {refCopied ? (
                <Check className="h-4 w-4 text-primary" aria-hidden />
              ) : (
                <Copy className="h-4 w-4 text-muted-foreground" aria-hidden />
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
          className="-mr-2 h-8 w-8 rounded-full hover:bg-muted sm:mr-0"
          aria-label="Close booking details"
        >
          <X className="h-4 w-4 text-muted-foreground" />
        </Button>
      </div>
    </div>
  );
}

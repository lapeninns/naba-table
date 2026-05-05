'use client';

import { Check, Clock, Copy, Hash, Users, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { BookingStatusBadge } from '@/components/features/booking-state-machine';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { ArrivalCountdown } from './ArrivalCountdown';
import { copyToClipboard } from '../utils';

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

  const isLate = status === 'confirmed' && minutesRemaining !== null && minutesRemaining < 0;
  const showCountdown =
    minutesRemaining !== null && !['completed', 'cancelled', 'no_show'].includes(status);

  const chipClass =
    'flex max-w-full min-w-0 items-center gap-1.5 rounded-lg border border-border/40 bg-background/50 px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground shadow-sm backdrop-blur-sm';

  return (
    <div className="flex min-w-0 flex-col gap-2.5 sm:gap-3">
      {/* Row 1: guest name + close — never forces horizontal overflow */}
      <div className="flex min-w-0 items-start justify-between gap-2 sm:items-center sm:gap-3">
        <h2
          className={cn(
            'min-w-0 flex-1 truncate text-base font-extrabold leading-tight tracking-tight sm:text-lg',
            isLate ? 'text-destructive' : 'text-foreground',
          )}
        >
          {booking?.customerName ?? 'Booking details'}
        </h2>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="h-8 w-8 shrink-0 rounded-xl text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
          aria-label="Close booking details"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Row 2: all meta — wraps at every breakpoint so md/lg/narrow dialog works */}
      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-2 sm:gap-x-2.5">
        <BookingStatusBadge status={status} size="sm" showTooltip={false} />

        <div className={cn(chipClass, 'shrink-0')}>
          <Clock className="h-3 w-3 shrink-0 text-primary" />
          <span className="tabular-nums">{formattedStartTime}</span>
        </div>

        <div className={cn(chipClass, 'shrink-0')}>
          <Users className="h-3 w-3 shrink-0 text-primary" />
          <span className="tabular-nums">{booking?.partySize ?? '--'}</span>
        </div>

        {booking?.reference ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopyRef}
            className={cn(
              'group h-auto max-w-full min-w-0 gap-1.5 rounded-lg border border-border/40 bg-background/50 px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground shadow-sm backdrop-blur-sm transition-colors hover:bg-muted/80 hover:text-foreground',
            )}
            aria-label={refCopied ? 'Reference copied' : 'Copy reference'}
          >
            <Hash className="h-3 w-3 shrink-0" />
            <span className="min-w-0 max-w-[min(100%,12rem)] truncate font-mono normal-case text-[10px] font-semibold tracking-normal sm:max-w-[14rem] md:max-w-[18rem]">
              {booking.reference}
            </span>
            {refCopied ? (
              <Check className="h-2.5 w-2.5 shrink-0 text-primary" />
            ) : (
              <Copy className="h-2.5 w-2.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-60" />
            )}
          </Button>
        ) : null}

        {showCountdown ? (
          <div className="min-w-0 shrink-0">
            <ArrivalCountdown
              status={status}
              startTime={booking?.startTime ?? null}
              date={bookingDate}
              timezone={timezone}
              compact
            />
          </div>
        ) : null}

        <div className={cn(chipClass, 'text-[10px] font-semibold normal-case tracking-normal text-muted-foreground/80 sm:text-[11px]')}>
          <span className="truncate">{formattedDate}</span>
        </div>
      </div>
    </div>
  );
}

export default DialogHeader;

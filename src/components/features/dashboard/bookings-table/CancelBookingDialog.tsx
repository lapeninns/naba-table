'use client';

import React, { useMemo } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Text } from '@/components/ui/typography';
import { useCancelBooking } from '@/hooks/useCancelBooking';

import {
  GUEST_ACCESS_LINK_ERROR_COPY,
  GuestNewLinkCta,
  isGuestAccessLinkErrorCode,
} from './GuestNewLinkCta';

import type { BookingDTO } from '@/hooks/useBookings';

function formatDateTime(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Unknown time';
  const datePart = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date);
  const timePart = new Intl.DateTimeFormat(undefined, { timeStyle: 'short' }).format(date);
  return `${datePart} at ${timePart}`;
}

const errorCopy: Record<string, string> = {
  CUTOFF_PASSED: 'This booking can no longer be cancelled online. Please contact the venue.',
  BOOKING_NOT_CANCELLABLE:
    'This booking can no longer be cancelled online. Please contact the venue.',
  PENDING_LOCKED: 'This booking is still pending review. Please contact the venue to cancel.',
  BOOKING_NOT_FOUND: 'We couldn’t find that booking.',
  FORBIDDEN: 'You don’t have permission to cancel this booking.',
  UNKNOWN: 'Something went wrong on our side. Please try again.',
  ...GUEST_ACCESS_LINK_ERROR_COPY,
};

export type CancelBookingDialogProps = {
  booking: BookingDTO | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function CancelBookingDialog({ booking, open, onOpenChange }: CancelBookingDialogProps) {
  const mutation = useCancelBooking();
  const errorMessage = useMemo(() => {
    const err = mutation.error;
    if (!err) return null;
    return (err.code && errorCopy[err.code]) || err.message;
  }, [mutation.error]);
  const showNewLinkCta = isGuestAccessLinkErrorCode(mutation.error?.code);
  const restaurantSlug = booking?.restaurants?.slug ?? booking?.restaurantSlug ?? null;

  const handleConfirm = async () => {
    if (!booking) return;
    try {
      await mutation.mutateAsync({ id: booking.id });
      onOpenChange(false);
    } catch {
      // Error surfaced via mutation error state.
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancel this booking?</DialogTitle>
          <DialogDescription>
            {booking
              ? `You’re about to cancel your reservation at ${booking.restaurantName} for ${formatDateTime(booking.startIso)}.`
              : 'Are you sure you want to cancel this booking?'}
          </DialogDescription>
        </DialogHeader>
        <Text variant="caption">
          This action cannot be undone. The venue will be notified and the table will be released to
          other guests.
        </Text>
        {errorMessage ? (
          <Text variant="caption" className="text-destructive" role="alert">
            {errorMessage}
          </Text>
        ) : null}
        {showNewLinkCta ? (
          <div>
            <GuestNewLinkCta restaurantSlug={restaurantSlug} />
          </div>
        ) : null}
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={mutation.isPending}
          >
            Keep booking
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleConfirm}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? 'Cancelling…' : 'Cancel booking'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

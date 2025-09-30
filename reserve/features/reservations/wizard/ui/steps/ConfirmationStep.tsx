'use client';

import { AlertTriangle, CheckCircle2, Clock3, Info, XCircle } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { Alert, AlertDescription, AlertIcon } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { bookingHelpers } from '@reserve/shared/utils/booking';
import { DEFAULT_VENUE } from '@shared/config/venue';

import type { State, StepAction } from '../../model/reducer';

const EVENT_DURATION_MINUTES = 90;

const toIcsTimestamp = (date: Date) => date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

const buildReservationWindow = (state: State) => {
  const booking = state.lastConfirmed;
  const date = booking?.booking_date ?? state.details.date ?? '';
  if (!date) return null;
  const time = booking?.start_time ?? bookingHelpers.normalizeTime(state.details.time);
  const normalizedTime = bookingHelpers.normalizeTime(time);
  const iso = normalizedTime ? `${date}T${normalizedTime}:00` : `${date}T00:00:00`;
  const start = new Date(iso);
  if (Number.isNaN(start.getTime())) return null;
  const end = new Date(start.getTime() + EVENT_DURATION_MINUTES * 60 * 1000);
  return { start, end };
};

export interface ConfirmationStepProps {
  state: State;
  onNewBooking: () => void;
  onClose: () => void;
  onActionsChange: (actions: StepAction[]) => void;
}

export function ConfirmationStep({
  state,
  onNewBooking,
  onClose,
  onActionsChange,
}: ConfirmationStepProps) {
  const booking = state.lastConfirmed;
  const details = state.details;
  const venue = useMemo(
    () => ({
      ...DEFAULT_VENUE,
      id: details.restaurantId || DEFAULT_VENUE.id,
      name: details.restaurantName || DEFAULT_VENUE.name,
      address: details.restaurantAddress || DEFAULT_VENUE.address,
      timezone: details.restaurantTimezone || DEFAULT_VENUE.timezone,
    }),
    [
      details.restaurantAddress,
      details.restaurantId,
      details.restaurantName,
      details.restaurantTimezone,
    ],
  );

  const [calendarLoading, setCalendarLoading] = useState(false);
  const [walletLoading, setWalletLoading] = useState(false);
  const [feedback, setFeedback] = useState<{
    variant: 'info' | 'success' | 'warning' | 'error';
    message: string;
  } | null>(null);

  const showFeedback = useCallback(
    (variant: 'info' | 'success' | 'warning' | 'error', message: string) => {
      setFeedback({ variant, message });
    },
    [],
  );

  const reference = booking?.reference ?? (state.waitlisted ? 'WAITLIST' : 'Pending');
  const guestName = booking?.customer_name ?? details.name;
  const summaryDate = details.date ? bookingHelpers.formatSummaryDate(details.date) : 'TBC';
  const summaryTime = details.time ? bookingHelpers.formatTime(details.time) : 'TBC';
  const partyText = `${details.party} ${details.party === 1 ? 'guest' : 'guests'}`;

  const isWaitlisted = state.waitlisted;
  const isAllocationPending = state.allocationPending && !isWaitlisted;

  const heading = isWaitlisted
    ? "You're on the waiting list"
    : isAllocationPending
      ? 'Manual allocation pending'
      : state.lastAction === 'update'
        ? 'Booking updated'
        : 'Booking confirmed';

  const description = isWaitlisted
    ? `We’ll notify ${details.email} if a table opens near ${summaryTime} on ${summaryDate}.`
    : isAllocationPending
      ? `Our host team will allocate the best table and follow up at ${details.email}.`
      : `A confirmation email has been sent to ${details.email}.`;

  const StatusIcon = isWaitlisted ? Info : isAllocationPending ? Clock3 : CheckCircle2;
  const statusIconClass = isWaitlisted
    ? 'text-amber-500'
    : isAllocationPending
      ? 'text-sky-500'
      : 'text-emerald-500';

  const reservationWindow = useMemo(() => buildReservationWindow(state), [state]);

  const handleAddToCalendar = useCallback(() => {
    if (!reservationWindow) {
      showFeedback(
        'warning',
        'Select a confirmed date and time before adding this to your calendar.',
      );
      return;
    }

    setCalendarLoading(true);
    try {
      const lines = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//SajiloReserveX//EN',
        'BEGIN:VEVENT',
        `UID:${reference}@sajiloreservex`,
        `DTSTAMP:${toIcsTimestamp(new Date())}`,
        `DTSTART:${toIcsTimestamp(reservationWindow.start)}`,
        `DTEND:${toIcsTimestamp(reservationWindow.end)}`,
        `SUMMARY:${venue.name} reservation`,
        `LOCATION:${venue.address}`,
        `DESCRIPTION:Reservation for ${guestName || 'guest'} (${partyText})`,
        'END:VEVENT',
        'END:VCALENDAR',
      ].join('\r\n');

      const blob = new Blob([lines], { type: 'text/calendar;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${venue.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-reservation.ics`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
      showFeedback(
        'success',
        'Calendar event downloaded. Check your downloads folder to import it.',
      );
    } finally {
      setCalendarLoading(false);
    }
  }, [guestName, partyText, reference, reservationWindow, showFeedback, venue.address, venue.name]);

  const handleAddToWallet = useCallback(async () => {
    if (!reservationWindow) {
      showFeedback('warning', 'Select a confirmed date and time before saving the reservation.');
      return;
    }

    const shareText = [
      `${venue.name} reservation`,
      `Reference: ${reference}`,
      `When: ${summaryDate} at ${summaryTime}`,
      `Guests: ${partyText}`,
      `Venue: ${venue.address}`,
    ].join('\n');

    setWalletLoading(true);
    try {
      if (navigator.share) {
        await navigator.share({ title: `${venue.name} reservation`, text: shareText });
        showFeedback(
          'success',
          'Sharing sheet opened. Follow the prompts to save your reservation.',
        );
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareText);
        showFeedback('info', 'Reservation details copied. Use your Wallet app to create a pass.');
      } else {
        showFeedback('info', shareText);
      }
    } catch (error) {
      console.error('Unable to share reservation', error);
      showFeedback('error', "We couldn't share the reservation details. Please try again.");
    } finally {
      setWalletLoading(false);
    }
  }, [
    partyText,
    reference,
    reservationWindow,
    showFeedback,
    summaryDate,
    summaryTime,
    venue.address,
    venue.name,
  ]);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  useEffect(() => {
    const actions: StepAction[] = [
      {
        id: 'confirmation-close',
        label: 'Close confirmation',
        ariaLabel: 'Close confirmation',
        variant: 'ghost',
        icon: 'X',
        onClick: handleClose,
      },
      {
        id: 'confirmation-calendar',
        label: 'Add reservation to calendar',
        ariaLabel: 'Add reservation to calendar',
        variant: 'outline',
        icon: 'Calendar',
        onClick: handleAddToCalendar,
        loading: calendarLoading,
      },
      {
        id: 'confirmation-wallet',
        label: 'Add reservation to wallet',
        ariaLabel: 'Add reservation to wallet',
        variant: 'outline',
        icon: 'Wallet',
        onClick: handleAddToWallet,
        loading: walletLoading,
      },
      {
        id: 'confirmation-new',
        label: 'Start a new booking',
        ariaLabel: 'Start a new booking',
        variant: 'default',
        icon: 'Plus',
        onClick: onNewBooking,
      },
    ];
    onActionsChange(actions);
  }, [
    calendarLoading,
    handleAddToCalendar,
    handleAddToWallet,
    handleClose,
    onActionsChange,
    onNewBooking,
    walletLoading,
  ]);

  const dismissFeedback = useCallback(() => setFeedback(null), []);

  const FeedbackIcon = useMemo(() => {
    if (!feedback) return null;
    switch (feedback.variant) {
      case 'success':
        return CheckCircle2;
      case 'warning':
        return AlertTriangle;
      case 'error':
        return XCircle;
      default:
        return Info;
    }
  }, [feedback]);

  return (
    <Card className="mx-auto w-full max-w-4xl lg:max-w-5xl">
      <CardHeader className="space-y-2">
        <div className="flex items-center gap-3">
          <StatusIcon className={`h-6 w-6 ${statusIconClass}`} aria-hidden />
          <CardTitle className="text-[clamp(1.75rem,1.45rem+0.6vw,2.2rem)] text-srx-ink-strong">
            {heading}
          </CardTitle>
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <p className="sr-only" aria-live="polite">
          {`Reference ${reference}. Reservation for ${partyText} at ${summaryTime} on ${summaryDate}.`}
        </p>
        {feedback ? (
          <Alert
            variant={
              feedback.variant === 'error'
                ? 'destructive'
                : feedback.variant === 'warning'
                  ? 'warning'
                  : feedback.variant === 'success'
                    ? 'success'
                    : 'info'
            }
            role={feedback.variant === 'error' ? 'alert' : 'status'}
            className="items-start gap-3"
          >
            <AlertIcon>
              {FeedbackIcon ? <FeedbackIcon className="h-4 w-4" aria-hidden /> : null}
            </AlertIcon>
            <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <AlertDescription>{feedback.message}</AlertDescription>
              <Button
                variant="ghost"
                size="sm"
                onClick={dismissFeedback}
                className="self-end sm:self-auto"
              >
                Dismiss
              </Button>
            </div>
          </Alert>
        ) : null}
        <div className="rounded-xl border border-srx-border-subtle bg-white/95 p-5 shadow-sm">
          <dl className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-helper uppercase tracking-[0.18em] text-srx-ink-soft">
                Reference
              </dt>
              <dd className="text-body-sm font-semibold text-srx-ink-strong">{reference}</dd>
            </div>
            <div>
              <dt className="text-helper uppercase tracking-[0.18em] text-srx-ink-soft">Guest</dt>
              <dd className="text-body-sm font-semibold text-srx-ink-strong">{guestName}</dd>
            </div>
            <div>
              <dt className="text-helper uppercase tracking-[0.18em] text-srx-ink-soft">When</dt>
              <dd className="text-body-sm font-medium text-srx-ink-strong">
                {summaryDate} at {summaryTime}
              </dd>
            </div>
            <div>
              <dt className="text-helper uppercase tracking-[0.18em] text-srx-ink-soft">Guests</dt>
              <dd className="text-body-sm font-medium text-srx-ink-strong">{partyText}</dd>
            </div>
          </dl>
        </div>
      </CardContent>
    </Card>
  );
}

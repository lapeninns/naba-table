'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { CancelBookingDialog } from '@/components/dashboard/CancelBookingDialog';
import { EditBookingDialog } from '@/components/dashboard/EditBookingDialog';
import { StatusChip } from '@/components/dashboard/StatusChip';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button, buttonVariants } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { track } from '@/lib/analytics';
import { emit } from '@/lib/analytics/emit';
import { downloadCalendarEvent, shareReservationDetails, type ShareResult } from '@/lib/reservations/share';
import { cn } from '@/lib/utils';
import { useReservation } from '@features/reservations/wizard/api/useReservation';
import { DEFAULT_VENUE } from '@shared/config/venue';

import { ReservationHistory } from './ReservationHistory';

import type { BookingDTO } from '@/hooks/useBookings';
import type { Reservation } from '@entities/reservation/reservation.schema';

export type ReservationVenue = {
  name: string;
  address: string;
  timezone: string;
};

const sanitizeJsonLd = (value: string | null | undefined) => {
  if (!value) {
    return null;
  }
  return value.replace(/</g, '\\u003c');
};

const formatDate = (iso: string | null | undefined) => {
  if (!iso) return '—';
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return '—';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'full',
  }).format(parsed);
};

const formatTimeRange = (startIso: string | null | undefined, endIso: string | null | undefined) => {
  if (!startIso) return '—';
  const start = new Date(startIso);
  if (Number.isNaN(start.getTime())) return '—';
  const timeFormatter = new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: 'numeric',
  });
  const startLabel = timeFormatter.format(start);
  if (!endIso) {
    return startLabel;
  }
  const end = new Date(endIso);
  if (Number.isNaN(end.getTime())) {
    return startLabel;
  }
  return `${startLabel} – ${timeFormatter.format(end)}`;
};

const buildBookingDto = (reservation: Reservation | undefined, restaurantName: string | null): BookingDTO | null => {
  if (!reservation) return null;
  return {
    id: reservation.id,
    restaurantName: restaurantName ?? 'Reservation',
    partySize: reservation.partySize,
    startIso: reservation.startAt,
    endIso: reservation.endAt ?? reservation.startAt,
    status: reservation.status as BookingDTO['status'],
    notes: reservation.notes ?? null,
  };
};

const buildReservationJsonLd = (reservation: Reservation, venue: ReservationVenue) => ({
  '@context': 'https://schema.org',
  '@type': 'Reservation',
  reservationNumber: reservation.reference ?? reservation.id,
  reservationStatus: reservation.status,
  reservationFor: {
    '@type': 'FoodEstablishment',
    name: venue.name,
    address: venue.address,
  },
  partySize: reservation.partySize,
  startTime: reservation.startAt ? new Date(reservation.startAt).toISOString() : undefined,
});

export type ReservationDetailClientProps = {
  reservationId: string;
  restaurantName: string | null;
  structuredData?: string | null;
  venue?: ReservationVenue | null;
};

export function ReservationDetailClient({
  reservationId,
  restaurantName,
  structuredData,
  venue: providedVenue,
}: ReservationDetailClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isCancelOpen, setIsCancelOpen] = useState(false);
  const viewTrackedRef = useRef(false);
  const isOnline = useOnlineStatus();
  const lastOnlineAtRef = useRef<number>(Date.now());
  const offlineTrackedRef = useRef(false);
  const [shareFeedback, setShareFeedback] = useState<ShareResult | null>(null);
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [shareLoading, setShareLoading] = useState(false);
  const calendarButtonRef = useRef<HTMLButtonElement | null>(null);
  const shareButtonRef = useRef<HTMLButtonElement | null>(null);
  const shareAlertVariant = shareFeedback
    ? shareFeedback.variant === 'error'
      ? 'destructive'
      : shareFeedback.variant === 'warning'
        ? 'warning'
        : shareFeedback.variant === 'info'
          ? 'info'
          : 'success'
    : 'info';

  const { data: reservation, error, isError, isLoading, refetch, isFetching } = useReservation(reservationId);
  const testUiEnabled = process.env.NEXT_PUBLIC_ENABLE_TEST_UI === 'true';

  const bookingDto = useMemo(() => buildBookingDto(reservation, restaurantName), [reservation, restaurantName]);

  // Calculate venue info before any early returns
  const venue = useMemo<ReservationVenue>(() => {
    if (providedVenue) {
      return {
        name: providedVenue.name ?? DEFAULT_VENUE.name,
        address: providedVenue.address ?? DEFAULT_VENUE.address,
        timezone: providedVenue.timezone ?? DEFAULT_VENUE.timezone,
      };
    }
    return {
      name: restaurantName ?? reservation?.restaurantName ?? DEFAULT_VENUE.name,
      address: DEFAULT_VENUE.address,
      timezone: DEFAULT_VENUE.timezone,
    };
  }, [providedVenue, reservation?.restaurantName, restaurantName]);

  // Calculate share payload before any early returns
  const sharePayload = useMemo(() => {
    if (!reservation) return null;
    return {
      reservationId,
      reference: reservation.reference ?? null,
      guestName: reservation.customerName,
      partySize: reservation.partySize,
      startAt: reservation.startAt,
      endAt: reservation.endAt ?? undefined,
      venueName: venue.name,
      venueAddress: venue.address,
      venueTimezone: venue.timezone,
    };
  }, [reservation, reservationId, venue.address, venue.name, venue.timezone]);

  // Calculate JSON-LD before any early returns
  const reservationJsonLdString = useMemo(() => {
    const provided = typeof structuredData === 'string' && structuredData.length > 0 ? structuredData : null;
    const sanitizedProvided = sanitizeJsonLd(provided);
    if (sanitizedProvided) {
      return sanitizedProvided;
    }

    if (!reservation) {
      return null;
    }

    return sanitizeJsonLd(JSON.stringify(buildReservationJsonLd(reservation, venue)));
  }, [reservation, structuredData, venue]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    if (isOnline) {
      lastOnlineAtRef.current = Date.now();
      offlineTrackedRef.current = false;
      return;
    }

    if (offlineTrackedRef.current) {
      return;
    }

    const wasOnlineForMs = Date.now() - lastOnlineAtRef.current;
    const payload = {
      path: window.location?.pathname ?? '/reserve',
      wasOnlineForMs: Number.isFinite(wasOnlineForMs) ? wasOnlineForMs : undefined,
    };
    track('network_offline', payload);
    void emit('network_offline', payload);
    offlineTrackedRef.current = true;
  }, [isOnline]);

  useEffect(() => {
    if (!shareFeedback) {
      if (feedbackTimerRef.current) {
        clearTimeout(feedbackTimerRef.current);
        feedbackTimerRef.current = null;
      }
      return;
    }

    feedbackTimerRef.current = setTimeout(() => {
      setShareFeedback(null);
      feedbackTimerRef.current = null;
    }, 6000);

    return () => {
      if (feedbackTimerRef.current) {
        clearTimeout(feedbackTimerRef.current);
        feedbackTimerRef.current = null;
      }
    };
  }, [shareFeedback]);

  useEffect(() => {
    if (!reservation || viewTrackedRef.current) return;
    viewTrackedRef.current = true;
    void emit('reservation_detail_viewed', {
      reservationId,
      status: reservation.status,
    });
  }, [reservation, reservationId]);

  useEffect(() => {
    const actionParam = searchParams?.get('action');
    if (!actionParam) {
      return;
    }

    if (actionParam === 'calendar' && calendarButtonRef.current) {
      calendarButtonRef.current.focus();
      calendarButtonRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setShareFeedback({ variant: 'info', message: 'Tap the button below to download your calendar event.' });
    } else if (actionParam === 'wallet' && shareButtonRef.current) {
      shareButtonRef.current.focus();
      shareButtonRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setShareFeedback({ variant: 'info', message: 'Tap the button below to share your reservation details.' });
    }
  }, [searchParams]);

  const handleEdit = useCallback(() => {
    if (!reservation) return;
    void emit('reservation_detail_edit_clicked', { reservationId });
    setIsEditOpen(true);
  }, [reservation, reservationId]);

  const handleCancel = useCallback(() => {
    if (!reservation) return;
    void emit('reservation_detail_cancel_clicked', { reservationId });
    setIsCancelOpen(true);
  }, [reservation, reservationId]);

  const handleRebook = useCallback(() => {
    if (!reservation) return;
    void emit('reservation_detail_rebook_clicked', {
      reservationId,
      party: reservation.partySize,
    });
    router.push(`/?source=rebook&reservationId=${reservation.id}`);
  }, [reservation, reservationId, router]);

  const closeEditDialog = useCallback((open: boolean) => {
    setIsEditOpen(open);
  }, []);

  const closeCancelDialog = useCallback((open: boolean) => {
    setIsCancelOpen(open);
  }, []);

  const actionDisabled = reservation?.status === 'cancelled';

  if (isLoading && !reservation) {
    return (
      <section className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-12" aria-busy>
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-16 w-full" />
      </section>
    );
  }

  if (isError && !reservation) {
    return (
      <section className="mx-auto w-full max-w-3xl space-y-6 px-4 py-12">
        <Alert variant="destructive">
          <div className="space-y-2">
            <AlertTitle>Unable to load reservation</AlertTitle>
            <AlertDescription>
              {error?.message ?? 'Something went wrong while fetching the reservation details.'}
            </AlertDescription>
          </div>
          <div className="ml-auto flex flex-wrap gap-3">
            <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
              Retry
            </Button>
            <Link href="/" className={buttonVariants({ variant: 'primary' })}>
              Back to booking
            </Link>
          </div>
        </Alert>
      </section>
    );
  }

  if (!reservation) {
    return null;
  }

  const reservationDate = formatDate(reservation.startAt);
  const reservationTime = formatTimeRange(reservation.startAt, reservation.endAt);

  const warnings: Array<{ id: string; title: string; description: string; variant: 'warning' | 'info' }> = [];

  if (reservation.status === 'pending_allocation') {
    warnings.push({
      id: 'allocation',
      title: 'We are finding you a table',
      description:
        'Thanks for your patience—our team is confirming a table for your party. We will email you as soon as the booking is allocated.',
      variant: 'warning',
    });
  } else if (reservation.status === 'pending') {
    warnings.push({
      id: 'pending',
      title: 'Reservation awaiting confirmation',
      description:
        'This reservation is awaiting confirmation. Our team will update you shortly; feel free to reach out if your plans change.',
      variant: 'info',
    });
  }

  const metadataConflict = reservation.metadata?.conflict?.reason;
  if (metadataConflict) {
    warnings.push({
      id: 'conflict',
      title: 'Schedule conflict detected',
      description:
        reservation.metadata?.conflict?.reason ?? 'A conflict was detected for this reservation. Please review the details and adjust.',
      variant: 'warning',
    });
  }

  const metadataRescheduled = reservation.metadata?.rescheduledFrom;
  if (metadataRescheduled) {
    const previousDate = formatDate(metadataRescheduled);
    warnings.push({
      id: 'rescheduled',
      title: 'Reservation rescheduled',
      description: `This reservation was moved from ${previousDate}. Double-check the new time before you arrive.`,
      variant: 'info',
    });
  }

  return (
    <>
      {reservationJsonLdString ? (
        <script
          type="application/ld+json"
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: reservationJsonLdString }}
        />
      ) : null}
      <section className="mx-auto w-full max-w-4xl space-y-8 px-4 py-12">
        {!isOnline ? (
          <Alert variant="warning" role="status" aria-live="polite">
            <div>
              <AlertTitle>No internet connection</AlertTitle>
              <AlertDescription>
                You&apos;re offline. Sharing actions are disabled until you reconnect.
              </AlertDescription>
            </div>
          </Alert>
        ) : null}

        {shareFeedback ? (
          <Alert variant={shareAlertVariant} role="status" aria-live="polite">
            <AlertDescription>{shareFeedback.message}</AlertDescription>
          </Alert>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-2">
            <Link href="/my-bookings" className="text-sm text-primary underline-offset-4 hover:underline">
              ← Back to dashboard
            </Link>
            <h1 className="text-3xl font-semibold text-foreground">Reservation details</h1>
            <p className="text-muted-foreground">
              {reservation.reference ? `Reference ${reservation.reference}` : 'Manage your upcoming visit.'}
            </p>
          </div>
          <StatusChip status={reservation.status as BookingDTO['status']} />
        </div>

      {warnings.map((warning) => (
        <Alert key={warning.id} variant={warning.variant}>
          <div>
            <AlertTitle>{warning.title}</AlertTitle>
            <AlertDescription>{warning.description}</AlertDescription>
          </div>
        </Alert>
      ))}

      <div className="rounded-[var(--radius-lg)] border border-border bg-card shadow-sm">
        <div className="flex flex-col gap-4 border-b border-border/80 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <h2 className="text-xl font-semibold text-foreground">
              {restaurantName ?? 'Your reservation'}
            </h2>
            <p className="text-sm text-muted-foreground">{reservationDate}</p>
            <p className="text-sm text-muted-foreground">
              {reservationTime} · party of {reservation.partySize}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="primary" onClick={handleRebook} disabled={isFetching}>
              Rebook
            </Button>
            <Button variant="outline" onClick={handleEdit} disabled={actionDisabled}>
              Edit
            </Button>
            <Button variant="destructive" onClick={handleCancel} disabled={actionDisabled}>
              Cancel
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                if (!sharePayload) {
                  setShareFeedback({ variant: 'warning', message: 'Reservation details not ready yet.' });
                  return;
                }
                void emit('reservation_detail_calendar_clicked', { reservationId });
                setCalendarLoading(true);
                const result = downloadCalendarEvent(sharePayload);
                setCalendarLoading(false);
                setShareFeedback(result);
              }}
              disabled={!sharePayload || calendarLoading}
              ref={calendarButtonRef}
            >
              {calendarLoading ? 'Preparing…' : 'Add to calendar'}
            </Button>
            <Button
              variant="outline"
              onClick={async () => {
                if (!sharePayload) {
                  setShareFeedback({ variant: 'warning', message: 'Reservation details not ready yet.' });
                  return;
                }
                void emit('reservation_detail_share_clicked', { reservationId });
                setShareLoading(true);
                const result = await shareReservationDetails(sharePayload);
                setShareLoading(false);
                setShareFeedback(result);
              }}
              disabled={!isOnline || !sharePayload || shareLoading}
              ref={shareButtonRef}
            >
              {shareLoading ? 'Sharing…' : 'Share details'}
            </Button>
            {testUiEnabled ? (
              <a
                href={`/api/test/reservations/${reservation.id}/confirmation`}
                download
                className={cn(
                  'inline-flex items-center justify-center gap-2',
                  'min-h-[44px] h-11 px-5 py-2.5',
                  'rounded-[var(--radius-md)] text-button',
                  'border border-srx-border-strong bg-white/90 text-srx-ink-strong hover:bg-srx-surface-positive-alt',
                  'transition-[transform,box-shadow,background-color,color] duration-100 ease-out',
                  'active:scale-[0.98]',
                )}
              >
                Download confirmation
              </a>
            ) : null}
          </div>
        </div>

        <div className="grid gap-6 p-6 md:grid-cols-2">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-muted-foreground">Guest name</h3>
            <p className="text-base text-foreground">{reservation.customerName}</p>
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-muted-foreground">Contact</h3>
            <p className="text-base text-foreground">{reservation.customerEmail}</p>
            <p className="text-base text-muted-foreground">{reservation.customerPhone}</p>
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-muted-foreground">Seating preference</h3>
            <p className="text-base text-foreground">{reservation.seatingPreference}</p>
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-muted-foreground">Booking type</h3>
            <p className="text-base text-foreground">{reservation.bookingType}</p>
          </div>
          <div className="space-y-1 md:col-span-2">
            <h3 className="text-sm font-semibold text-muted-foreground">Notes</h3>
            <p className="text-base text-foreground">
              {reservation.notes?.trim() ? reservation.notes : 'No special notes added.'}
            </p>
          </div>
        </div>
      </div>

      <ReservationHistory reservationId={reservationId} />

      {bookingDto ? (
        <>
          <EditBookingDialog booking={bookingDto} open={isEditOpen} onOpenChange={closeEditDialog} />
          <CancelBookingDialog booking={bookingDto} open={isCancelOpen} onOpenChange={closeCancelDialog} />
        </>
      ) : null}
      </section>
    </>
  );
}

export default ReservationDetailClient;

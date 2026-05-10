'use client';

import {
  AlertCircle,
  Calendar,
  CalendarPlus,
  CheckCircle2,
  Clock,
  Download,
  Info,
  Mail,
  MessageSquare,
  Phone,
  Share2,
  Sparkles,
  User,
  Users,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  BookingDetailShell,
  BookingSummaryCard,
  DetailStatCard,
  InfoPanel,
  InlineAlert,
  ManageBookingPanel,
  SummaryActions,
  ActionButtonRow,
  SecondaryButton,
  GhostButton,
} from '@/components/features/booking/ui/BookingComponents';
import { GuestError } from '@/components/guest/ui';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { emit } from '@/lib/analytics/emit';
import {
  getPendingSelfServeGraceMinutes,
  isPendingSelfServeLocked,
} from '@/lib/bookings/pendingLock';
import {
  downloadCalendarEvent,
  shareReservationDetails,
  type ShareResult,
} from '@/lib/reservations/share';
import { useReservation } from '@features/reservations/wizard/api/useReservation';
import {
  formatReservationDateFromDate,
  formatReservationDateShortFromDate,
  formatReservationTimeFromDate,
} from '@reserve/shared/formatting/booking';
import {
  getBookingDateTimeMillis,
  parseBookingDateTime,
} from '@reserve/shared/formatting/bookingDateTime';
import { DEFAULT_VENUE } from '@shared/config/venue';

import type { BookingDTO } from '@/hooks/useBookings';
import type { Reservation } from '@entities/reservation/reservation.schema';

const CancelBookingDialog = dynamic(
  () => import('@/components/dashboard/CancelBookingDialog').then((m) => m.CancelBookingDialog),
  {
    loading: () => <div className="h-10" />, // lightweight placeholder
  },
);

const EditBookingDialog = dynamic(
  () => import('@/components/dashboard/EditBookingDialog').then((m) => m.EditBookingDialog),
  {
    loading: () => <div className="h-10" />,
  },
);

export type ReservationVenue = {
  name: string;
  address: string;
  timezone: string;
  slug?: string | null;
};

type ReservationDisplay = {
  shortDate: string;
  fullDate: string;
  time: string;
};

const FALLBACK_DISPLAY: ReservationDisplay = {
  shortDate: '—',
  fullDate: '—',
  time: '—',
};

const feedbackTone = (variant: ShareResult['variant']) => {
  if (variant === 'error') return 'danger';
  return variant;
};

const calendarStatusFromReservation = (status: string): 'confirmed' | 'cancelled' | 'pending' => {
  if (status === 'cancelled') return 'cancelled';
  if (status === 'pending' || status === 'pending_allocation') return 'pending';
  return 'confirmed';
};

function buildReservationDisplay(
  startIso: string | null | undefined,
  timezone: string | null | undefined,
): ReservationDisplay {
  if (!startIso) {
    return FALLBACK_DISPLAY;
  }

  const parsed = parseBookingDateTime(startIso, timezone)?.toJSDate();
  if (!parsed) {
    return FALLBACK_DISPLAY;
  }

  const formattingOptions = timezone ? { timezone } : undefined;
  const shortDate = formatReservationDateShortFromDate(parsed, formattingOptions) || '—';
  const fullDate = formatReservationDateFromDate(parsed, formattingOptions) || '—';
  const time = formatReservationTimeFromDate(parsed, formattingOptions) || '—';

  return { shortDate, fullDate, time };
}

const buildBookingDto = (
  reservation: Reservation | undefined,
  restaurantName: string | null,
  venue: ReservationVenue,
): BookingDTO | null => {
  if (!reservation) return null;
  return {
    id: reservation.id,
    restaurantId: reservation.restaurantId,
    restaurantName: restaurantName ?? 'Reservation',
    restaurantSlug: reservation.restaurantSlug ?? venue.slug ?? DEFAULT_VENUE.slug,
    restaurantTimezone: venue.timezone,
    partySize: reservation.partySize,
    startIso: reservation.startAt,
    endIso: reservation.endAt ?? reservation.startAt,
    status: reservation.status as BookingDTO['status'],
    notes: reservation.notes ?? null,
  };
};

export type ReservationDetailClientProps = {
  reservationId: string;
  restaurantName: string | null;
  initialNow: number;
  _structuredData?: string | null;
  venue?: ReservationVenue | null;
  canManage?: boolean;
};

export function ReservationDetailClient({
  reservationId,
  restaurantName,
  initialNow,
  _structuredData,
  venue: providedVenue,
  canManage = false,
}: ReservationDetailClientProps) {
  const router = useRouter();
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isCancelOpen, setIsCancelOpen] = useState(false);
  const viewTrackedRef = useRef(false);
  const isOnline = useOnlineStatus();
  const [shareFeedback, setShareFeedback] = useState<ShareResult | null>(null);
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [clockNow, setClockNow] = useState(initialNow);
  const pendingGraceMinutes = useMemo(() => getPendingSelfServeGraceMinutes(), []);
  const pastGraceMs = useMemo(() => {
    const raw = process.env.NEXT_PUBLIC_BOOKING_PAST_TIME_GRACE_MINUTES;
    const parsed = raw ? Number(raw) : Number.NaN;
    const minutes = Number.isFinite(parsed) ? parsed : 5;
    return Math.max(0, minutes) * 60_000;
  }, []);

  const {
    data: reservation,
    error,
    isError,
    isLoading,
    refetch,
    isFetching,
  } = useReservation(reservationId);

  const venue = useMemo<ReservationVenue>(() => {
    if (providedVenue) {
      return {
        name: providedVenue.name ?? DEFAULT_VENUE.name,
        address: providedVenue.address ?? DEFAULT_VENUE.address,
        timezone: providedVenue.timezone ?? DEFAULT_VENUE.timezone,
        slug: providedVenue.slug ?? DEFAULT_VENUE.slug,
      };
    }
    return {
      name: restaurantName ?? reservation?.restaurantName ?? DEFAULT_VENUE.name,
      address: DEFAULT_VENUE.address,
      timezone: reservation?.restaurantTimezone ?? DEFAULT_VENUE.timezone,
      slug: reservation?.restaurantSlug ?? DEFAULT_VENUE.slug,
    };
  }, [
    providedVenue,
    reservation?.restaurantName,
    reservation?.restaurantSlug,
    reservation?.restaurantTimezone,
    restaurantName,
  ]);

  const bookingDto = useMemo(
    () => buildBookingDto(reservation, restaurantName, venue),
    [reservation, restaurantName, venue],
  );

  const sharePayload = useMemo(() => {
    if (!reservation) return null;
    return {
      reservationId,
      reference: reservation.reference ?? null,
      guestName: reservation.customerName,
      guestEmail: reservation.customerEmail,
      partySize: reservation.partySize,
      startAt: reservation.startAt,
      endAt: reservation.endAt ?? undefined,
      venueName: venue.name,
      venueAddress: venue.address,
      venueTimezone: venue.timezone,
      status: calendarStatusFromReservation(reservation.status),
      notes: reservation.notes,
      manageUrl:
        typeof window === 'undefined'
          ? null
          : `${window.location.origin}/bookings/${reservationId}`,
    };
  }, [reservation, reservationId, venue]);

  const isPastReservation = useMemo(() => {
    if (!reservation?.startAt) return false;
    const startMs = getBookingDateTimeMillis(
      reservation.startAt,
      reservation.restaurantTimezone ?? venue.timezone,
    );
    if (startMs === null) return false;
    return startMs < clockNow - pastGraceMs;
  }, [clockNow, pastGraceMs, reservation, venue.timezone]);

  const pendingLock = useMemo(() => {
    if (!reservation || reservation.status !== 'pending') {
      return { locked: false, lockTimestamp: null as number | null };
    }
    const locked = isPendingSelfServeLocked(reservation.status, reservation.createdAt, clockNow);
    const createdMs = reservation.createdAt ? Date.parse(reservation.createdAt) : Number.NaN;
    const lockTimestamp = Number.isFinite(createdMs)
      ? createdMs + pendingGraceMinutes * 60_000
      : null;
    return { locked, lockTimestamp };
  }, [reservation, pendingGraceMinutes, clockNow]);

  const reservationDisplay = useMemo(
    () => buildReservationDisplay(reservation?.startAt, venue.timezone),
    [reservation?.startAt, venue.timezone],
  );

  useEffect(() => {
    if (!shareFeedback) {
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
      return;
    }
    feedbackTimerRef.current = setTimeout(() => {
      setShareFeedback(null);
    }, 6000);
    return () => {
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    };
  }, [shareFeedback]);

  useEffect(() => {
    if (!reservation || viewTrackedRef.current) return;
    viewTrackedRef.current = true;
    void emit('reservation_detail_viewed', { reservationId, status: reservation.status });
  }, [reservation, reservationId]);

  useEffect(() => {
    if (!reservation || reservation.status !== 'pending' || pendingLock.locked) return;
    const interval = window.setInterval(() => setClockNow(Date.now()), 15_000);
    return () => window.clearInterval(interval);
  }, [reservation, pendingLock.locked]);

  useEffect(() => {
    setClockNow(Date.now());
  }, []);

  const handleEdit = useCallback(() => {
    if (!reservation || pendingLock.locked || !canManage || isPastReservation) return;
    void emit('reservation_detail_edit_clicked', { reservationId });
    setIsEditOpen(true);
  }, [canManage, isPastReservation, pendingLock.locked, reservation, reservationId]);

  const handleCancel = useCallback(() => {
    if (!reservation || pendingLock.locked || !canManage || isPastReservation) return;
    void emit('reservation_detail_cancel_clicked', { reservationId });
    setIsCancelOpen(true);
  }, [canManage, isPastReservation, pendingLock.locked, reservation, reservationId]);

  const handleRebook = useCallback(() => {
    if (!reservation) return;
    void emit('reservation_detail_rebook_clicked', { reservationId, party: reservation.partySize });
    const slug = [reservation.restaurantSlug, venue.slug]
      .map((value) => value?.trim())
      .find((value) => value && value.toLowerCase() !== 'default');
    const path = slug ? `/restaurants/${slug}/book` : '/restaurants';
    router.push(`${path}?source=rebook&reservationId=${reservation.id}`);
  }, [reservation, reservationId, router, venue.slug]);

  const handleShare = useCallback(() => {
    if (!sharePayload) return;
    void emit('reservation_detail_share_clicked', { reservationId });
    void shareReservationDetails(sharePayload)
      .then((result) => setShareFeedback(result))
      .catch(() =>
        setShareFeedback({
          variant: 'error',
          message: "We couldn't share the reservation details. Please try again.",
        }),
      );
  }, [sharePayload, reservationId]);

  const handleDownload = useCallback(() => {
    if (!reservation) {
      setShareFeedback({ variant: 'warning', message: 'Reservation details not ready yet.' });
      return;
    }
    const link = document.createElement('a');
    link.href = `/api/reservations/${reservation.id}/confirmation`;
    link.download = `reservation-${reservation.reference ?? reservation.id}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [reservation]);

  const handleAddToCalendar = useCallback(() => {
    if (!sharePayload) {
      setShareFeedback({ variant: 'warning', message: 'Reservation details not ready yet.' });
      return;
    }
    void emit('reservation_detail_add_calendar_clicked', { reservationId });
    const result = downloadCalendarEvent(sharePayload);
    setShareFeedback(result);
  }, [sharePayload, reservationId]);

  const closeEditDialog = useCallback((open: boolean) => setIsEditOpen(open), []);
  const closeCancelDialog = useCallback((open: boolean) => setIsCancelOpen(open), []);

  const actionDisabled = reservation
    ? reservation.status === 'cancelled' || pendingLock.locked || isPastReservation || !canManage
    : true;

  // Loading State
  if (isLoading && !reservation) {
    return (
      <section className="pg-surface min-h-[100dvh] py-8 pb-20 sm:py-10">
        <div className="mx-auto w-full max-w-5xl space-y-6 sm:space-y-8 px-4 sm:px-6">
          {/* Summary card skeleton */}
          <div className="pg-card pg-appear space-y-6 p-6 sm:p-8">
            <div className="flex items-center gap-3">
              <Skeleton className="size-11 rounded-full" />
              <Skeleton className="h-6 w-24 rounded-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-10 w-2/3" />
              <Skeleton className="h-5 w-96 max-w-full" />
            </div>
            <Skeleton className="h-4 w-32" />
          </div>
          {/* Stat cards skeleton */}
          <div className="grid gap-4 sm:grid-cols-3">
            <Skeleton className="h-28 rounded-2xl" />
            <Skeleton className="h-28 rounded-2xl" />
            <Skeleton className="h-28 rounded-2xl" />
          </div>
          {/* Info panel skeleton */}
          <Skeleton className="h-48 rounded-2xl" />
        </div>
      </section>
    );
  }

  // Error State
  if (isError && !reservation) {
    return (
      <div className="pg-surface flex min-h-[60vh] items-center justify-center">
        <GuestError
          description={error?.message ?? 'We encountered an error loading your reservation.'}
          onRetry={() => refetch()}
          redirectHref="/guest/dashboard"
          redirectLabel="Return to dashboard"
        />
      </div>
    );
  }

  if (!reservation) return null;

  const getStatusConfig = (status: string) => {
    const configs: Record<
      string,
      {
        label: string;
        tone: 'success' | 'warning' | 'danger' | 'info' | 'default';
        icon: React.ElementType;
      }
    > = {
      confirmed: { label: 'Confirmed', tone: 'success', icon: CheckCircle2 },
      cancelled: { label: 'Cancelled', tone: 'danger', icon: AlertCircle },
      completed: { label: 'Completed', tone: 'default', icon: CheckCircle2 },
      pending: { label: 'Pending Confirmation', tone: 'warning', icon: Clock },
      pending_allocation: { label: 'Confirming Table', tone: 'warning', icon: Clock },
      checked_in: { label: 'Checked In', tone: 'info', icon: Sparkles },
    };
    return configs[status] ?? { label: status, tone: 'default', icon: Info };
  };

  const statusConfig = getStatusConfig(reservation.status);
  const StatusIcon = statusConfig.icon;

  return (
    <BookingDetailShell>
      <BookingSummaryCard
        title={restaurantName ?? venue.name ?? 'Your Reservation'}
        description="Update, share, or download your booking in one place."
        reference={reservation.reference ?? reservation.id.slice(0, 8).toUpperCase()}
        status={{ icon: StatusIcon, label: statusConfig.label, tone: statusConfig.tone }}
        offlineNotice={
          !isOnline ? (
            <InlineAlert tone="warning">You’re offline — some actions may be limited.</InlineAlert>
          ) : null
        }
        actions={
          <SummaryActions>
            <SecondaryButton onClick={handleDownload}>
              <Download className="mr-2 size-4" /> PDF
            </SecondaryButton>
            <SecondaryButton onClick={handleShare}>
              <Share2 className="mr-2 size-4" /> Share
            </SecondaryButton>
            <SecondaryButton onClick={handleAddToCalendar}>
              <CalendarPlus className="mr-2 size-4" /> Add to calendar
            </SecondaryButton>
          </SummaryActions>
        }
      />
      {shareFeedback ? (
        <div role="status" aria-live="polite">
          <InlineAlert tone={feedbackTone(shareFeedback.variant)}>
            {shareFeedback.message}
          </InlineAlert>
        </div>
      ) : null}

      <div className="grid gap-8 xl:grid-cols-[1fr_320px]">
        <div className="space-y-8">
          <div className="grid gap-4 sm:grid-cols-3">
            <DetailStatCard
              icon={Calendar}
              label="Date"
              value={reservationDisplay.shortDate}
              subtext={reservationDisplay.fullDate}
            />
            <DetailStatCard
              icon={Clock}
              label="Time"
              value={reservationDisplay.time}
              subtext="Local time"
            />
            <DetailStatCard
              icon={Users}
              label="Party Size"
              value={`${reservation.partySize}`}
              subtext={reservation.partySize === 1 ? 'Guest' : 'Guests'}
            />
          </div>

          <InfoPanel
            title="Guest Information"
            rows={[
              { icon: User, label: 'Primary Guest', value: reservation.customerName },
              { icon: Mail, label: 'Email', value: reservation.customerEmail },
              { icon: Phone, label: 'Phone', value: reservation.customerPhone },
            ]}
          />

          {reservation.notes ? (
            <InfoPanel
              title="Preferences"
              rows={[{ icon: MessageSquare, label: 'Special Requests', value: reservation.notes }]}
            />
          ) : null}

          <ActionButtonRow>
            <SecondaryButton onClick={handleDownload}>
              <Download className="mr-2 size-4" /> PDF
            </SecondaryButton>
            <SecondaryButton onClick={handleShare}>
              <Share2 className="mr-2 size-4" /> Share
            </SecondaryButton>
            <SecondaryButton onClick={handleAddToCalendar}>
              <CalendarPlus className="mr-2 size-4" /> Add to calendar
            </SecondaryButton>
          </ActionButtonRow>
        </div>

        <div className="space-y-6">
          <ManageBookingPanel
            title="Manage booking"
            actions={
              <div className="space-y-3">
                <Button
                  className="min-h-[48px] w-full rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
                  size="lg"
                  onClick={handleEdit}
                  disabled={actionDisabled}
                >
                  Modify Details
                </Button>
                <Button
                  variant="outline"
                  className="w-full rounded-full border-border min-h-[44px]"
                  size="lg"
                  onClick={handleCancel}
                  disabled={actionDisabled}
                >
                  Cancel Booking
                </Button>
                <GhostButton onClick={handleRebook} disabled={!canManage || isFetching}>
                  Book Again
                </GhostButton>
              </div>
            }
          />

          {!canManage && (
            <InlineAlert tone="info">
              <div className="flex flex-col gap-1">
                <p className="font-semibold">Sign in to modify this reservation.</p>
                <Link
                  href={`/auth/signin?redirectedFrom=/guest/bookings/${reservationId}`}
                  className="font-semibold text-primary underline"
                >
                  Sign In →
                </Link>
              </div>
            </InlineAlert>
          )}
        </div>
      </div>

      {bookingDto && (
        <>
          <EditBookingDialog
            booking={bookingDto}
            open={isEditOpen}
            onOpenChange={closeEditDialog}
            restaurantSlug={venue.slug ?? bookingDto.restaurantSlug ?? null}
            restaurantTimezone={venue.timezone ?? bookingDto.restaurantTimezone ?? null}
          />
          <CancelBookingDialog
            booking={bookingDto}
            open={isCancelOpen}
            onOpenChange={closeCancelDialog}
          />
        </>
      )}
    </BookingDetailShell>
  );
}
export default ReservationDetailClient;

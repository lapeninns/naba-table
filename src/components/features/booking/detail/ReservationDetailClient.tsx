'use client';

import {
  AlertCircle,
  Calendar,
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
  Utensils,
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
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { emit } from '@/lib/analytics/emit';
import {
  getPendingSelfServeGraceMinutes,
  isPendingSelfServeLocked,
} from '@/lib/bookings/pendingLock';
import { shareReservationDetails, type ShareResult } from '@/lib/reservations/share';
import { useReservation } from '@features/reservations/wizard/api/useReservation';
import {
  formatReservationDateFromDate,
  formatReservationDateShortFromDate,
  formatReservationTimeFromDate,
} from '@reserve/shared/formatting/booking';
import { getBookingDateTimeMillis, parseBookingDateTime } from '@reserve/shared/formatting/bookingDateTime';
import { DEFAULT_VENUE } from '@shared/config/venue';

import { ReservationHistory } from './ReservationHistory';

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
      partySize: reservation.partySize,
      startAt: reservation.startAt,
      endAt: reservation.endAt ?? undefined,
      venueName: venue.name,
      venueAddress: venue.address,
      venueTimezone: venue.timezone,
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
    void shareReservationDetails(sharePayload);
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

  const closeEditDialog = useCallback((open: boolean) => setIsEditOpen(open), []);
  const closeCancelDialog = useCallback((open: boolean) => setIsCancelOpen(open), []);

  const actionDisabled = reservation
    ? reservation.status === 'cancelled' || pendingLock.locked || isPastReservation || !canManage
    : true;

  // Loading State
  if (isLoading && !reservation) {
    return (
      <section className="min-h-screen bg-surface-warm py-8 sm:py-10 pb-20">
        <div className="mx-auto w-full max-w-5xl space-y-6 sm:space-y-8 px-4 sm:px-6">
          {/* Summary card skeleton */}
          <div className="rounded-2xl border border-border bg-background p-6 sm:p-8 space-y-6 animate-fade-in-up">
            <div className="flex items-center gap-3">
              <Skeleton className="h-11 w-11 rounded-full" />
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
      <div className="flex min-h-[60vh] items-center justify-center bg-surface-warm">
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
              <Download className="mr-2 h-4 w-4" /> PDF
            </SecondaryButton>
            <SecondaryButton onClick={handleShare}>
              <Share2 className="mr-2 h-4 w-4" /> Share
            </SecondaryButton>
          </SummaryActions>
        }
      />

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

          <InfoPanel
            title="Preferences"
            rows={[
              {
                icon: Utensils,
                label: 'Seating',
                value: reservation.seatingPreference || 'Standard',
              },
              ...(reservation.notes
                ? [{ icon: MessageSquare, label: 'Special Requests', value: reservation.notes }]
                : []),
            ]}
          />

          <ActionButtonRow>
            <SecondaryButton onClick={handleDownload}>
              <Download className="mr-2 h-4 w-4" /> PDF
            </SecondaryButton>
            <SecondaryButton onClick={handleShare}>
              <Share2 className="mr-2 h-4 w-4" /> Share
            </SecondaryButton>
          </ActionButtonRow>
        </div>

        <div className="space-y-6">
          <ManageBookingPanel
            title="Manage booking"
            actions={
              <div className="space-y-3">
                <Button
                  className="w-full rounded-full bg-primary hover:bg-primary/90 text-white min-h-[48px]"
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

      {canManage && (
        <Card className="bg-surface-elevated p-4">
          <ReservationHistory reservationId={reservationId} timezone={venue.timezone} />
        </Card>
      )}

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

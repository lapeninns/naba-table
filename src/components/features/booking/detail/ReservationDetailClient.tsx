'use client';

import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  Clock,
  Download,
  Info,
  Mail,
  MessageSquare,
  Phone,
  QrCode,
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

import { GuestErrorState } from '@/components/guest/shared/GuestErrorState';
import { GuestCard, GuestSection, GuestStatus } from '@/components/guest/ui';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { emit } from '@/lib/analytics/emit';
import { getPendingSelfServeGraceMinutes, isPendingSelfServeLocked } from '@/lib/bookings/pendingLock';
import { shareReservationDetails, type ShareResult } from '@/lib/reservations/share';
import { cn } from '@/lib/utils';
import { useReservation } from '@features/reservations/wizard/api/useReservation';
import { DEFAULT_VENUE } from '@shared/config/venue';

import { ReservationHistory } from './ReservationHistory';

import type { BookingDTO } from '@/hooks/useBookings';
import type { Reservation } from '@entities/reservation/reservation.schema';

const CancelBookingDialog = dynamic(() => import('@/components/dashboard/CancelBookingDialog').then((m) => m.CancelBookingDialog), {
  loading: () => <div className="h-10" />, // lightweight placeholder
});

const EditBookingDialog = dynamic(() => import('@/components/dashboard/EditBookingDialog').then((m) => m.EditBookingDialog), {
  loading: () => <div className="h-10" />,
});

const QRCodeDialogLazy = dynamic(() => import('./QRCodeDialogLazy'), {
  loading: () => (
    <div className="flex flex-col items-center justify-center py-8">
      <div className="h-32 w-32 rounded-2xl bg-slate-100" />
    </div>
  ),
  ssr: false,
});

export type ReservationVenue = {
  name: string;
  address: string;
  timezone: string;
  slug?: string | null;
};

const formatDate = (iso: string | null | undefined) => {
  if (!iso) return '—';
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return '—';
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(parsed);
};

const formatDateShort = (iso: string | null | undefined) => {
  if (!iso) return '—';
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return '—';
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(parsed);
};

const formatTimeRange = (startIso: string | null | undefined) => {
  if (!startIso) return '—';
  const start = new Date(startIso);
  if (Number.isNaN(start.getTime())) return '—';
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: 'numeric',
  }).format(start);
};

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
  _structuredData?: string | null;
  venue?: ReservationVenue | null;
  token?: string | null;
  canManage?: boolean;
};

export function ReservationDetailClient({
  reservationId,
  restaurantName,
  _structuredData,
  venue: providedVenue,
  token = null,
  canManage = false,
}: ReservationDetailClientProps) {
  const router = useRouter();
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isCancelOpen, setIsCancelOpen] = useState(false);
  const viewTrackedRef = useRef(false);
  const isOnline = useOnlineStatus();
  const [shareFeedback, setShareFeedback] = useState<ShareResult | null>(null);
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [clockNow, setClockNow] = useState(() => Date.now());
  const pendingGraceMinutes = useMemo(() => getPendingSelfServeGraceMinutes(), []);
  const pastGraceMs = useMemo(() => {
    const raw = process.env.NEXT_PUBLIC_BOOKING_PAST_TIME_GRACE_MINUTES;
    const parsed = raw ? Number(raw) : Number.NaN;
    const minutes = Number.isFinite(parsed) ? parsed : 5;
    return Math.max(0, minutes) * 60_000;
  }, []);

  const { data: reservation, error, isError, isLoading, refetch, isFetching } = useReservation(reservationId, token ?? undefined);

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
  }, [providedVenue, reservation?.restaurantName, reservation?.restaurantSlug, reservation?.restaurantTimezone, restaurantName]);

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
    const startMs = Date.parse(reservation.startAt);
    if (!Number.isFinite(startMs)) return false;
    return startMs < Date.now() - pastGraceMs;
  }, [pastGraceMs, reservation?.startAt]);

  const pendingLock = useMemo(() => {
    if (!reservation || reservation.status !== 'pending') {
      return { locked: false, lockTimestamp: null as number | null };
    }
    const locked = isPendingSelfServeLocked(reservation.status, reservation.createdAt, clockNow);
    const createdMs = reservation.createdAt ? Date.parse(reservation.createdAt) : Number.NaN;
    const lockTimestamp = Number.isFinite(createdMs) ? createdMs + pendingGraceMinutes * 60_000 : null;
    return { locked, lockTimestamp };
  }, [reservation, pendingGraceMinutes, clockNow]);

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
      <div className="min-h-screen pb-20">
        <Skeleton className="h-6 w-32 mb-8" />
        <Skeleton className="h-12 w-2/3 mb-4" />
        <Skeleton className="h-6 w-48 mb-10" />
        <div className="grid gap-4 sm:grid-cols-3 mb-10">
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
        </div>
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  // Error State
  if (isError && !reservation) {
    return (
      <GuestErrorState
        description={error?.message ?? 'We encountered an error loading your reservation.'}
        onRetry={() => refetch()}
        redirectHref="/guest/dashboard"
        redirectLabel="Return to dashboard"
      />
    );
  }

  if (!reservation) return null;

  const reservationDate = formatDateShort(reservation.startAt);
  const reservationDateFull = formatDate(reservation.startAt);
  const reservationTime = formatTimeRange(reservation.startAt);

  const getStatusConfig = (status: string) => {
    const configs: Record<string, { label: string; bg: string; text: string; icon: React.ElementType }> = {
      confirmed: { label: 'Confirmed', bg: 'bg-emerald-100', text: 'text-emerald-700', icon: CheckCircle2 },
      cancelled: { label: 'Cancelled', bg: 'bg-red-100', text: 'text-red-700', icon: AlertCircle },
      completed: { label: 'Completed', bg: 'bg-slate-100', text: 'text-slate-700', icon: CheckCircle2 },
      pending: { label: 'Pending Confirmation', bg: 'bg-amber-100', text: 'text-amber-800', icon: Clock },
      pending_allocation: { label: 'Confirming Table', bg: 'bg-amber-100', text: 'text-amber-800', icon: Clock },
      checked_in: { label: 'Checked In', bg: 'bg-blue-100', text: 'text-blue-700', icon: Sparkles },
    };
    return configs[status] ?? { label: status, bg: 'bg-slate-100', text: 'text-slate-700', icon: Info };
  };

  const statusConfig = getStatusConfig(reservation.status);
  const StatusIcon = statusConfig.icon;

  return (
    <div className="min-h-screen pb-20">
      <GuestSection
        title={restaurantName ?? venue.name ?? 'Your Reservation'}
        description={
          <>
            Confirmation{' '}
            <span className="font-mono font-semibold text-slate-700">
              {reservation.reference ?? reservation.id.slice(0, 8).toUpperCase()}
            </span>
          </>
        }
        actions={
          <div className="hidden md:flex items-center gap-3">
            <Button variant="outline" className="rounded-full" onClick={handleDownload}>
              <Download className="mr-2 h-4 w-4" />
              PDF
            </Button>
            <Button variant="outline" className="rounded-full" onClick={handleShare}>
              <Share2 className="mr-2 h-4 w-4" />
              Share
            </Button>
          </div>
        }
        className="bg-white"
      >
        <Badge className={cn("rounded-full px-4 py-1.5 text-sm font-semibold border-0", statusConfig.bg, statusConfig.text)}>
          <StatusIcon className="mr-1.5 h-4 w-4" />
          {statusConfig.label}
        </Badge>
        <div className="mt-4">
          <Link
            href="/guest/dashboard"
            className="inline-flex items-center text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors"
          >
            <ChevronLeft className="mr-1 h-4 w-4" />
            Back to Dashboard
          </Link>
        </div>
        {!isOnline && (
          <GuestStatus
            className="mt-6"
            title="You’re offline"
            description="Some features may be limited."
            tone="warning"
            icon={Info}
          />
        )}
      </GuestSection>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_320px]">
        <div className="space-y-8">
          <div className="grid gap-4 sm:grid-cols-3">
            <DetailCard icon={Calendar} label="Date" value={reservationDate} subtext={reservationDateFull} />
            <DetailCard icon={Clock} label="Time" value={reservationTime} subtext="Local time" />
            <DetailCard icon={Users} label="Party Size" value={`${reservation.partySize}`} subtext={reservation.partySize === 1 ? 'Guest' : 'Guests'} />
          </div>

          <GuestCard className="overflow-hidden border-slate-100 shadow-sm">
            <div className="border-b border-slate-50 bg-gradient-to-r from-slate-50 to-white px-6 py-4">
              <h3 className="font-semibold text-slate-900">Guest Information</h3>
            </div>
            <div className="divide-y divide-slate-50">
              <InfoRow icon={User} label="Primary Guest" value={reservation.customerName} />
              <InfoRow icon={Mail} label="Email" value={reservation.customerEmail} />
              <InfoRow icon={Phone} label="Phone" value={reservation.customerPhone} />
            </div>
          </GuestCard>

          <GuestCard className="overflow-hidden border-slate-100 shadow-sm">
            <div className="border-b border-slate-50 bg-gradient-to-r from-slate-50 to-white px-6 py-4">
              <h3 className="font-semibold text-slate-900">Preferences</h3>
            </div>
            <div className="divide-y divide-slate-50">
              <InfoRow icon={Utensils} label="Seating" value={reservation.seatingPreference || 'Standard'} />
              {reservation.notes && (
                <InfoRow icon={MessageSquare} label="Special Requests" value={reservation.notes} />
              )}
            </div>
          </GuestCard>

          <div className="flex gap-3 md:hidden">
            <Button variant="outline" className="flex-1 rounded-full" onClick={handleDownload}>
              <Download className="mr-2 h-4 w-4" />
              PDF
            </Button>
            <Button variant="outline" className="flex-1 rounded-full" onClick={handleShare}>
              <Share2 className="mr-2 h-4 w-4" />
              Share
            </Button>
          </div>
        </div>

        <div className="space-y-6">
          <GuestCard className="shadow-lg">
            <div className="p-6 text-center">
              <QRCodeDialogLazy reservation={reservation}>
                <button className="group mx-auto block rounded-2xl border border-slate-100 bg-white p-4 shadow-sm transition-all hover:shadow-md hover:scale-105">
                  <QrCode className="h-28 w-28 text-slate-900" />
                </button>
              </QRCodeDialogLazy>
              <div className="mt-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Check-in Code</p>
                <p className="mt-1 font-mono text-xl font-bold text-slate-900">
                  {reservation.id.slice(0, 8).toUpperCase()}
                </p>
              </div>
            </div>
          </GuestCard>

          <GuestCard className="shadow-lg">
            <div className="p-6 space-y-4">
              <h3 className="font-semibold text-slate-900">Manage Booking</h3>
              <Button
                className="w-full rounded-full bg-slate-900 hover:bg-slate-800"
                size="lg"
                onClick={handleEdit}
                disabled={actionDisabled}
              >
                Modify Details
              </Button>
              <Button
                variant="outline"
                className="w-full rounded-full border-slate-200"
                size="lg"
                onClick={handleCancel}
                disabled={actionDisabled}
              >
                Cancel Booking
              </Button>
              <Separator />
              <Button
                variant="ghost"
                className="w-full rounded-xl text-slate-500 hover:text-slate-900"
                onClick={handleRebook}
                disabled={!canManage || isFetching}
              >
                Book Again
              </Button>
            </div>
          </GuestCard>

          {!canManage && (
            <GuestStatus
              tone="info"
              title="Sign in to modify this reservation."
              actions={
                <Link
                  href={`/auth/signin?redirectedFrom=/guest/bookings/${reservationId}`}
                  className="font-semibold text-blue-700 hover:underline"
                >
                  Sign In →
                </Link>
              }
            />
          )}
        </div>
      </div>

      {canManage && (
        <div className="mt-16">
          <ReservationHistory reservationId={reservationId} />
        </div>
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
          <CancelBookingDialog booking={bookingDto} open={isCancelOpen} onOpenChange={closeCancelDialog} />
        </>
      )}
    </div>
  );
}

/* ============================================================================
   SUPPORTING COMPONENTS
   ============================================================================ */

function DetailCard({
  icon: Icon,
  label,
  value,
  subtext
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  subtext: string;
}) {
  return (
    <GuestCard className="border-slate-100 shadow-sm">
      <div className="p-5">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-50 to-blue-100 text-blue-600">
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</p>
            <p className="mt-1 text-xl font-bold text-slate-900">{value}</p>
            <p className="text-sm text-slate-500">{subtext}</p>
          </div>
        </div>
      </div>
    </GuestCard>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-4 px-6 py-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-slate-500">
        <Icon className="h-5 w-5" />
      </div>
      <div className="overflow-hidden">
        <p className="text-sm text-slate-500">{label}</p>
        <p className="font-medium text-slate-900 truncate">{value}</p>
      </div>
    </div>
  );
}

export default ReservationDetailClient;

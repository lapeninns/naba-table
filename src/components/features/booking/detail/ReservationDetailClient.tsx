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
  MapPin,
  MessageSquare,
  Phone,
  Share2,
  User,
  Users,
  Utensils,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { CancelBookingDialog } from '@/components/dashboard/CancelBookingDialog';
import { EditBookingDialog } from '@/components/dashboard/EditBookingDialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import config from '@/config';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { track } from '@/lib/analytics';
import { emit } from '@/lib/analytics/emit';
import { getPendingSelfServeGraceMinutes, isPendingSelfServeLocked } from '@/lib/bookings/pendingLock';
import { downloadCalendarEvent, shareReservationDetails, type ShareResult } from '@/lib/reservations/share';
import { useReservation } from '@features/reservations/wizard/api/useReservation';
import { DEFAULT_VENUE } from '@shared/config/venue';
import { DEFAULT_RESTAURANT_SLUG } from '@shared/config/venue';

import { ReservationHistory } from './ReservationHistory';


import type { BookingDTO } from '@/hooks/useBookings';
import type { Reservation } from '@entities/reservation/reservation.schema';

export type ReservationVenue = {
  name: string;
  address: string;
  timezone: string;
  slug?: string | null;
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
  token?: string | null;
  canManage?: boolean;
};

export function ReservationDetailClient({
  reservationId,
  restaurantName,
  structuredData,
  venue: providedVenue,
  token = null,
  canManage = false,
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
  const [downloadLoading, setDownloadLoading] = useState(false);
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
  const pendingGraceMinutes = useMemo(() => getPendingSelfServeGraceMinutes(), []);
  const supportEmail = config.email?.supportEmail ?? 'support@example.com';
  const [clockNow, setClockNow] = useState(() => Date.now());
  const pastGraceMs = useMemo(() => {
    const raw = process.env.NEXT_PUBLIC_BOOKING_PAST_TIME_GRACE_MINUTES;
    const parsed = raw ? Number(raw) : Number.NaN;
    const minutes = Number.isFinite(parsed) ? parsed : 5;
    return Math.max(0, minutes) * 60_000;
  }, []);

  const { data: reservation, error, isError, isLoading, refetch, isFetching } = useReservation(reservationId, token ?? undefined);

  // Calculate venue info before any early returns
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

  const isPastReservation = useMemo(() => {
    if (!reservation?.startAt) return false;
    const startMs = Date.parse(reservation.startAt);
    if (!Number.isFinite(startMs)) return false;
    return startMs < Date.now() - pastGraceMs;
  }, [pastGraceMs, reservation?.startAt]);

  const handleDownloadConfirmation = useCallback(() => {
    if (typeof window === 'undefined') {
      return;
    }

    if (!reservation) {
      setShareFeedback({ variant: 'warning', message: 'Reservation details not ready yet.' });
      return;
    }

    const targetId = reservation.id ?? reservationId;
    setDownloadLoading(true);
    try {
      const link = document.createElement('a');
      link.href = `/api/reservations/${targetId}/confirmation`;
      link.download = `reservation-${reservation.reference ?? targetId}.pdf`;
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('[reservation-detail] download failed', error);
      setShareFeedback({
        variant: 'error',
        message: "We couldn't download the confirmation. Please try again.",
      });
    } finally {
      setDownloadLoading(false);
    }
  }, [reservation, reservationId]);

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

  const pendingSupportHref = useMemo(() => {
    const target = supportEmail;
    if (!reservation) {
      return `mailto:${target}`;
    }
    const subject = `Reservation change request (${reservation.reference ?? reservation.id})`;
    const details = [
      'Hi team,',
      '',
      'I need help updating or cancelling this pending reservation while it is under review.',
      `Reservation ID: ${reservation.id}`,
      reservation.reference ? `Reference: ${reservation.reference}` : null,
      `Name: ${reservation.customerName}`,
      reservation.startAt ? `Start: ${formatDate(reservation.startAt)} at ${formatTimeRange(reservation.startAt, reservation.endAt ?? reservation.startAt)}` : null,
    ].filter(Boolean);
    return `mailto:${target}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(details.join('\n'))}`;
  }, [reservation, supportEmail]);

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
    if (!reservation || reservation.status !== 'pending' || pendingLock.locked) {
      return;
    }

    const interval = window.setInterval(() => {
      setClockNow(Date.now());
    }, 15_000);

    return () => {
      window.clearInterval(interval);
    };
  }, [reservation, pendingLock.locked]);

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
    void emit('reservation_detail_rebook_clicked', {
      reservationId,
      party: reservation.partySize,
    });
    const slug = [reservation.restaurantSlug, venue.slug, DEFAULT_RESTAURANT_SLUG]
      .map((value) => value?.trim())
      .find((value) => value && value.toLowerCase() !== 'default');
    const path = slug ? `/restaurants/${slug}/book` : '/restaurants';
    router.push(`${path}?source=rebook&reservationId=${reservation.id}`);
  }, [reservation, reservationId, router, venue.slug]);

  const closeEditDialog = useCallback((open: boolean) => {
    setIsEditOpen(open);
  }, []);

  const closeCancelDialog = useCallback((open: boolean) => {
    setIsCancelOpen(open);
  }, []);

  const actionDisabled = reservation
    ? reservation.status === 'cancelled' || pendingLock.locked || isPastReservation || !canManage
    : true;

  if (isLoading && !reservation) {
    return (
      <section className="mx-auto flex w-full max-w-[80vw] flex-col gap-6 px-4 py-12" aria-busy>
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-16 w-full" />
      </section>
    );
  }

  if (isError && !reservation) {
    return (
      <section className="mx-auto w-full max-w-[80vw] space-y-6 px-4 py-12">
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
            <Link href="/guest/dashboard" className={buttonVariants({ variant: 'default' })}>
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

  if (isPastReservation) {
    warnings.push({
      id: 'past',
      title: 'This reservation has already passed',
      description: 'Edits and cancellations are disabled for past reservations. You can rebook to create a new reservation.',
      variant: 'info',
    });
  }

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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
      case 'seated':
      case 'completed':
        return 'default'; // usually black/primary
      case 'cancelled':
      case 'no_show':
        return 'destructive';
      case 'pending':
      case 'pending_allocation':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  return (
    <>
      {reservationJsonLdString ? (
        <script
          type="application/ld+json"
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: reservationJsonLdString }}
        />
      ) : null}

      <div className="min-h-[80vh] flex items-center justify-center p-4 md:p-8 animate-in fade-in duration-500">
        <div className="w-full max-w-[80vw] space-y-6">

          {/* Navigation */}
          <Link
            href="/guest/dashboard"
            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
          >
            ← Back to dashboard
          </Link>

          {/* Offline Alert */}
          {!isOnline && (
            <Alert variant="warning" className="animate-in slide-in-from-top-2">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>No internet connection</AlertTitle>
              <AlertDescription>
                You&apos;re offline. Sharing actions are disabled until you reconnect.
              </AlertDescription>
            </Alert>
          )}

          {/* Feedback Alert */}
          {shareFeedback && (
            <Alert variant={shareAlertVariant} className="animate-in slide-in-from-top-2">
              {shareFeedback.variant === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <Info className="h-4 w-4" />}
              <AlertDescription>{shareFeedback.message}</AlertDescription>
            </Alert>
          )}

          {/* Warnings */}
          {warnings.map((warning) => (
            <Alert key={warning.id} variant={warning.variant} className="animate-in slide-in-from-top-2">
              <Info className="h-4 w-4" />
              <AlertTitle>{warning.title}</AlertTitle>
              <AlertDescription>{warning.description}</AlertDescription>
            </Alert>
          ))}

          {/* Pending Lock Alert */}
          {pendingLock.locked && (
            <Alert variant="info" className="animate-in slide-in-from-top-2">
              <Info className="h-4 w-4" />
              <div className="space-y-2">
                <div>
                  <AlertTitle>Your request is pending review</AlertTitle>
                  <AlertDescription>
                    We temporarily pause self-serve edits while the restaurant reviews pending bookings.
                    You can request a change below or wait until the booking is confirmed (typically within about {pendingGraceMinutes} minutes).
                  </AlertDescription>
                </div>
                <Button asChild variant="outline" size="sm">
                  <a href={pendingSupportHref} target="_blank" rel="noopener noreferrer">
                    Request a change
                  </a>
                </Button>
              </div>
            </Alert>
          )}

          {/* Main Card */}
          <Card className="border-border/50 shadow-xl overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary/50 to-primary" />

            <CardHeader className="text-center pb-8 pt-10 bg-muted/10 space-y-4">
              <div className="flex justify-center">
                <Badge variant={getStatusColor(reservation.status)} className="px-3 py-1 text-sm uppercase tracking-wider">
                  {reservation.status.replace('_', ' ')}
                </Badge>
              </div>

              <div className="space-y-2">
                <CardTitle className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">
                  {restaurantName ?? 'Your Reservation'}
                </CardTitle>
                <p className="text-muted-foreground text-sm uppercase tracking-widest">
                  Reference: {reservation.reference ?? reservation.id.slice(0, 8)}
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-4 text-sm md:text-base font-medium text-foreground/80 mt-4">
                <div className="flex items-center gap-2 bg-background/50 px-3 py-1.5 rounded-full border border-border/50">
                  <Calendar className="h-4 w-4 text-primary" />
                  {reservationDate}
                </div>
                <div className="flex items-center gap-2 bg-background/50 px-3 py-1.5 rounded-full border border-border/50">
                  <Clock className="h-4 w-4 text-primary" />
                  {reservationTime}
                </div>
                <div className="flex items-center gap-2 bg-background/50 px-3 py-1.5 rounded-full border border-border/50">
                  <Users className="h-4 w-4 text-primary" />
                  {reservation.partySize} Guests
                </div>
              </div>
            </CardHeader>

            <Separator />

            <CardContent className="p-6 md:p-10 space-y-8">
              {/* Guest Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                    <User className="h-4 w-4" /> Guest Details
                  </h3>
                  <div className="space-y-3 pl-1">
                    <div className="flex items-start gap-3">
                      <div className="bg-primary/10 p-2 rounded-full mt-0.5">
                        <User className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{reservation.customerName}</p>
                        <p className="text-sm text-muted-foreground">Primary Guest</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="bg-primary/10 p-2 rounded-full mt-0.5">
                        <Mail className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium break-all">{reservation.customerEmail}</p>
                        <p className="text-sm text-muted-foreground">Email Address</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="bg-primary/10 p-2 rounded-full mt-0.5">
                        <Phone className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{reservation.customerPhone}</p>
                        <p className="text-sm text-muted-foreground">Phone Number</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                    <Utensils className="h-4 w-4" /> Preferences & Notes
                  </h3>
                  <div className="space-y-3 pl-1">
                    <div className="flex items-start gap-3">
                      <div className="bg-primary/10 p-2 rounded-full mt-0.5">
                        <MapPin className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{reservation.seatingPreference}</p>
                        <p className="text-sm text-muted-foreground">Seating Preference</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="bg-primary/10 p-2 rounded-full mt-0.5">
                        <MessageSquare className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">
                          {reservation.notes?.trim() ? reservation.notes : 'No special notes'}
                        </p>
                        <p className="text-sm text-muted-foreground">Special Requests</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>

            <Separator />

            <CardFooter className="flex flex-col gap-4 p-6 md:p-8 bg-muted/5">
              <div className="flex flex-wrap items-center justify-center gap-3 w-full">
                <Button
                  variant="default"
                  size="lg"
                  onClick={handleRebook}
                  disabled={!canManage || isFetching}
                  className="w-full sm:w-auto min-w-[140px]"
                >
                  <CalendarPlus className="mr-2 h-4 w-4" /> Rebook
                </Button>

                <Button
                  variant="outline"
                  size="lg"
                  onClick={handleEdit}
                  disabled={actionDisabled}
                  className="w-full sm:w-auto min-w-[140px]"
                >
                  Edit Booking
                </Button>

                <Button
                  variant="destructive"
                  size="lg"
                  onClick={handleCancel}
                  disabled={actionDisabled}
                  className="w-full sm:w-auto min-w-[140px]"
                >
                  Cancel
                </Button>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-3 w-full pt-4 border-t border-border/50">
                <Button
                  variant="ghost"
                  size="sm"
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
                  className="text-muted-foreground hover:text-foreground"
                >
                  {calendarLoading ? 'Preparing…' : <><CalendarPlus className="mr-2 h-4 w-4" /> Add to Calendar</>}
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
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
                  className="text-muted-foreground hover:text-foreground"
                >
                  {shareLoading ? 'Sharing…' : <><Share2 className="mr-2 h-4 w-4" /> Share</>}
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDownloadConfirmation}
                  disabled={downloadLoading || !reservation}
                  className="text-muted-foreground hover:text-foreground"
                >
                  {downloadLoading ? 'Preparing…' : <><Download className="mr-2 h-4 w-4" /> Download PDF</>}
                </Button>
              </div>
            </CardFooter>
          </Card>

          {!canManage && (
            <Alert variant="info" className="bg-muted/50 border-dashed">
              <Info className="h-4 w-4" />
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 w-full">
                <div>
                  <AlertTitle>Viewing as guest</AlertTitle>
                  <AlertDescription>
                    Sign in to edit or cancel this booking.
                  </AlertDescription>
                </div>
                <Link href={`/auth/signin?redirectedFrom=/bookings/${reservationId}`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                  Sign in
                </Link>
              </div>
            </Alert>
          )}

          {canManage && <ReservationHistory reservationId={reservationId} />}

          {bookingDto ? (
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
          ) : null}
        </div>
      </div>
    </>
  );
}

export default ReservationDetailClient;

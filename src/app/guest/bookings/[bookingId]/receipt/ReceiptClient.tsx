'use client';

import {
  Calendar,
  CalendarPlus,
  Clock,
  Download,
  Mail,
  ReceiptText,
  Share2,
  User,
  Users,
} from 'lucide-react';
import { useCallback, useMemo } from 'react';

import {
  GuestContent,
  GuestDetailList,
  GuestError,
  GuestHero,
  GuestInsetCard,
  GuestMetricCard,
  GuestPageFrame,
  GuestPanel,
  GuestPrimaryButton,
  GuestReferenceStrip,
  GuestSecondaryButton,
  GuestStatus,
} from '@/components/guest/ui';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { emit } from '@/lib/analytics/emit';
import { shareReservationDetails } from '@/lib/reservations/share';
import { useReservation } from '@features/reservations/wizard/api/useReservation';
import {
  formatReservationDateFromDate,
  formatReservationTimeFromDate,
} from '@reserve/shared/formatting/booking';
import { parseBookingDateTime } from '@reserve/shared/formatting/bookingDateTime';
import { DEFAULT_VENUE } from '@shared/config/venue';

const formatDateFull = (iso: string | null | undefined, timezone?: string | null) => {
  if (!iso) return 'Date pending';
  const parsed = parseBookingDateTime(iso, timezone)?.toJSDate();
  if (!parsed) return 'Date pending';
  return (
    formatReservationDateFromDate(parsed, { timezone: timezone ?? undefined }) || 'Date pending'
  );
};

const formatTime = (iso: string | null | undefined, timezone?: string | null) => {
  if (!iso) return 'Time pending';
  const parsed = parseBookingDateTime(iso, timezone)?.toJSDate();
  if (!parsed) return 'Time pending';
  return (
    formatReservationTimeFromDate(parsed, { timezone: timezone ?? undefined }) || 'Time pending'
  );
};

type ReceiptClientProps = {
  reservationId: string;
  hasSession: boolean;
  prefetchedStatus: string | null;
};

export function ReceiptClient({ reservationId, hasSession }: ReceiptClientProps) {
  const { data: reservation, isLoading, isError } = useReservation(reservationId);

  const venue = useMemo(() => {
    if (!reservation) return DEFAULT_VENUE;
    return {
      name: reservation.restaurantName ?? DEFAULT_VENUE.name,
      timezone: reservation.restaurantTimezone ?? DEFAULT_VENUE.timezone,
      slug: reservation.restaurantSlug ?? DEFAULT_VENUE.slug,
    };
  }, [reservation]);

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
      venueAddress: '',
      venueTimezone: venue.timezone,
    };
  }, [reservation, reservationId, venue]);

  const handleShare = useCallback(() => {
    if (!sharePayload) return;
    void emit('receipt_share_clicked', { reservationId });
    void shareReservationDetails(sharePayload);
  }, [sharePayload, reservationId]);

  const handleDownload = useCallback(() => {
    if (!reservation) return;
    void emit('receipt_download_clicked', { reservationId });
    const link = document.createElement('a');
    link.href = `/api/reservations/${reservation.id}/confirmation`;
    link.download = `reservation-${reservation.reference ?? reservation.id}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [reservation, reservationId]);

  const handleAddToCalendar = useCallback(() => {
    if (!reservation) return;
    void emit('receipt_add_calendar_clicked', { reservationId });
    const startDate = parseBookingDateTime(reservation.startAt, venue.timezone)?.toJSDate();
    if (!startDate) return;
    const endDate =
      parseBookingDateTime(reservation.endAt ?? null, venue.timezone)?.toJSDate() ??
      new Date(startDate.getTime() + 90 * 60000);
    const formatGCalDate = (date: Date) => date.toISOString().replace(/-|:|\.\d{3}/g, '');
    const url = new URL('https://www.google.com/calendar/render');
    url.searchParams.set('action', 'TEMPLATE');
    url.searchParams.set('text', `Reservation at ${venue.name}`);
    url.searchParams.set('dates', `${formatGCalDate(startDate)}/${formatGCalDate(endDate)}`);
    url.searchParams.set(
      'details',
      `Party of ${reservation.partySize}. Ref: ${reservation.reference ?? reservation.id.slice(0, 8).toUpperCase()}`,
    );
    window.open(url.toString(), '_blank', 'noopener');
  }, [reservation, reservationId, venue.name, venue.timezone]);

  const statusTone = useMemo(() => {
    if (!reservation) return { label: 'Loading', tone: 'info' as const };
    if (['confirmed', 'completed', 'checked_in'].includes(reservation.status)) {
      return { label: 'Confirmed', tone: 'success' as const };
    }
    if (['pending', 'pending_allocation'].includes(reservation.status)) {
      return { label: 'Pending confirmation', tone: 'warning' as const };
    }
    if (reservation.status === 'cancelled') return { label: 'Cancelled', tone: 'danger' as const };
    return { label: reservation.status, tone: 'info' as const };
  }, [reservation]);

  if (isLoading && !reservation) return <ReceiptLoadingState />;

  if (isError || !reservation) {
    return (
      <GuestPageFrame>
        <GuestContent narrow>
          <GuestError
            title="Receipt unavailable"
            description="We couldn't load your receipt. Please try the link again."
            redirectHref="/guest/bookings"
            redirectLabel="View my bookings"
          />
        </GuestContent>
      </GuestPageFrame>
    );
  }

  const reference = reservation.reference ?? reservation.id.slice(0, 8).toUpperCase();
  const dateLabel = formatDateFull(reservation.startAt, venue.timezone);
  const timeLabel = formatTime(reservation.startAt, venue.timezone);

  return (
    <GuestPageFrame>
      <GuestHero
        eyebrow="Booking receipt"
        title={venue.name}
        description={
          reservation.status === 'cancelled'
            ? 'This reservation has been cancelled. Keep this receipt for your records.'
            : 'Your confirmation, arrival details, and shareable reference are ready.'
        }
        actions={
          <>
            <Button
              type="button"
              size="guest-lg"
              variant="guest-primary"
              className="pg-action pg-focus-ring pg-touch"
              onClick={handleDownload}
            >
              <Download className="h-4 w-4" aria-hidden />
              Download PDF
            </Button>
            <Button
              type="button"
              size="guest-lg"
              variant="guest-outline"
              className="pg-action pg-focus-ring pg-touch"
              onClick={handleShare}
            >
              <Share2 className="h-4 w-4" aria-hidden />
              Share
            </Button>
          </>
        }
        aside={
          <div className="grid grid-cols-2 gap-3">
            <GuestMetricCard icon={Calendar} label="Date" value={dateLabel} />
            <GuestMetricCard icon={Clock} label="Time" value={timeLabel} detail={venue.timezone} />
            <GuestMetricCard icon={Users} label="Party" value={reservation.partySize} />
            <GuestMetricCard icon={ReceiptText} label="Status" value={statusTone.label} />
          </div>
        }
        compact
      />

      <GuestContent>
        <GuestReferenceStrip label="Reservation reference" value={reference}>
          <Button
            type="button"
            variant="guest-outline"
            size="guest-sm"
            className="pg-action pg-focus-ring pg-touch"
            onClick={handleAddToCalendar}
          >
            <CalendarPlus className="h-4 w-4" aria-hidden />
            Add calendar
          </Button>
        </GuestReferenceStrip>

        <div className="grid gap-6 lg:grid-cols-[7fr_5fr] lg:gap-8">
          <GuestPanel className="space-y-5 p-5 sm:p-6">
            <div className="space-y-2">
              <p className="pg-kicker">Arrival summary</p>
              <h2 className="pg-section-title">Show this at check-in</h2>
              <p className="pg-body">
                Restaurants can use the reference above to find your booking quickly. Keep the
                receipt open or download a PDF for offline access.
              </p>
            </div>
            <GuestStatus
              title={statusTone.label}
              description={
                reservation.status === 'cancelled'
                  ? 'No further action is needed for this cancelled reservation.'
                  : 'Your reservation details are synced with the restaurant.'
              }
              tone={statusTone.tone}
            />
            <div className="grid gap-3 sm:grid-cols-3">
              <MiniReceiptCard icon={Calendar} label="Date" value={dateLabel} />
              <MiniReceiptCard icon={Clock} label="Time" value={timeLabel} />
              <MiniReceiptCard
                icon={Users}
                label="Guests"
                value={`${reservation.partySize} ${reservation.partySize === 1 ? 'guest' : 'guests'}`}
              />
            </div>
          </GuestPanel>

          <GuestDetailList
            title="Guest details"
            items={[
              { icon: User, label: 'Primary guest', value: reservation.customerName },
              ...(reservation.customerEmail
                ? [{ icon: Mail, label: 'Email', value: reservation.customerEmail }]
                : []),
            ]}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Button
            type="button"
            variant="guest-outline"
            size="guest-sm"
            className="pg-action pg-focus-ring pg-touch"
            onClick={handleAddToCalendar}
          >
            <CalendarPlus className="h-4 w-4" aria-hidden />
            Calendar
          </Button>
          <Button
            type="button"
            variant="guest-outline"
            size="guest-sm"
            className="pg-action pg-focus-ring pg-touch"
            onClick={handleDownload}
          >
            <Download className="h-4 w-4" aria-hidden />
            PDF
          </Button>
          <Button
            type="button"
            variant="guest-outline"
            size="guest-sm"
            className="pg-action pg-focus-ring pg-touch"
            onClick={handleShare}
          >
            <Share2 className="h-4 w-4" aria-hidden />
            Share
          </Button>
        </div>

        {!hasSession ? (
          <GuestPanel className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-foreground">Want faster access next time?</p>
              <p className="pg-caption">
                Sign in to keep receipts and manage bookings in one place.
              </p>
            </div>
            <GuestSecondaryButton
              href={`/auth/signin?redirectedFrom=/guest/bookings/${reservationId}`}
            >
              Sign in
            </GuestSecondaryButton>
          </GuestPanel>
        ) : (
          <div className="flex flex-col gap-3 sm:flex-row">
            <GuestPrimaryButton href={`/guest/bookings/${reservationId}`}>
              Manage booking
            </GuestPrimaryButton>
            <GuestSecondaryButton href="/guest/bookings">Back to bookings</GuestSecondaryButton>
          </div>
        )}
      </GuestContent>
    </GuestPageFrame>
  );
}

function ReceiptLoadingState() {
  return (
    <GuestPageFrame>
      <section className="pg-hero-band pg-section-tight">
        <div className="pg-container grid gap-8 lg:grid-cols-[7fr_5fr]">
          <div className="space-y-4">
            <Skeleton className="h-5 w-40 rounded-full" />
            <Skeleton className="h-12 w-full max-w-xl rounded-xl" />
            <Skeleton className="h-5 w-full max-w-2xl rounded-lg" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[0, 1, 2, 3].map((item) => (
              <Skeleton key={item} className="h-28 rounded-[var(--pg-radius-md)]" />
            ))}
          </div>
        </div>
      </section>
      <GuestContent>
        <Skeleton className="h-16 rounded-[var(--pg-radius-md)]" />
        <Skeleton className="h-72 rounded-[var(--pg-radius-md)]" />
      </GuestContent>
    </GuestPageFrame>
  );
}

function MiniReceiptCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Calendar;
  label: string;
  value: string;
}) {
  return <GuestInsetCard icon={Icon} label={label} value={value} />;
}

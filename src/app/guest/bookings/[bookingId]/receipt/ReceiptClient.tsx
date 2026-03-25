'use client';

import { Calendar, CalendarPlus, Clock, Download, Mail, Share2, Users } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useMemo } from 'react';

import {
  ActionButtonRow,
  BookingDetailShell,
  BookingSummaryCard,
  DetailStatCard,
  InlineAlert,
  InfoPanel,
  SecondaryButton,
  SummaryActions,
} from '@/components/features/booking/ui/BookingComponents';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { emit } from '@/lib/analytics/emit';
import { shareReservationDetails } from '@/lib/reservations/share';
import { useReservation } from '@features/reservations/wizard/api/useReservation';
import { DEFAULT_VENUE } from '@shared/config/venue';

import type { Reservation } from '@entities/reservation/reservation.schema';

const formatDateFull = (iso: string | null | undefined) => {
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

const formatTime = (iso: string | null | undefined) => {
  if (!iso) return '—';
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return '—';
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: 'numeric',
  }).format(parsed);
};

type ReceiptClientProps = {
  reservationId: string;
  hasSession: boolean;
  prefetchedStatus: string | null;
  token?: string | null;
  initialReservation?: Reservation | null;
};

export function ReceiptClient({
  reservationId,
  hasSession,
  token = null,
  initialReservation = null,
}: ReceiptClientProps) {
  const {
    data: queriedReservation,
    isLoading: queryIsLoading,
    isError: queryIsError,
  } = useReservation(reservationId, {
    token,
    enabled: !initialReservation,
  });
  const reservation = initialReservation ?? queriedReservation;
  const isLoading = !initialReservation && queryIsLoading;
  const isError = !initialReservation && queryIsError;

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
    const startDate = new Date(reservation.startAt);
    const endDate = reservation.endAt
      ? new Date(reservation.endAt)
      : new Date(startDate.getTime() + 90 * 60000);
    const formatGCalDate = (d: Date) => d.toISOString().replace(/-|:|\.\d{3}/g, '');
    const url = new URL('https://www.google.com/calendar/render');
    url.searchParams.set('action', 'TEMPLATE');
    url.searchParams.set('text', `Reservation at ${venue.name}`);
    url.searchParams.set('dates', `${formatGCalDate(startDate)}/${formatGCalDate(endDate)}`);
    url.searchParams.set(
      'details',
      `Party of ${reservation.partySize}. Ref: ${reservation.reference ?? reservation.id.slice(0, 8).toUpperCase()}`,
    );
    window.open(url.toString(), '_blank', 'noopener');
  }, [reservation, reservationId, venue.name]);

  const statusTone = useMemo(() => {
    if (!reservation) return { label: 'Loading', tone: 'info' as const };
    if (['confirmed', 'completed', 'checked_in'].includes(reservation.status))
      return { label: 'Confirmed', tone: 'success' as const };
    if (['pending', 'pending_allocation'].includes(reservation.status))
      return { label: 'Pending Confirmation', tone: 'warning' as const };
    if (reservation.status === 'cancelled') return { label: 'Cancelled', tone: 'danger' as const };
    return { label: reservation.status, tone: 'default' as const };
  }, [reservation]);

  const receiptMessaging = useMemo(() => {
    if (!reservation) {
      return {
        summary: 'Save this receipt for easier check-in when you arrive.',
        email: 'A confirmation email has been sent to your inbox.',
      };
    }

    if (['pending', 'pending_allocation'].includes(reservation.status)) {
      return {
        summary:
          'Your request has been received. We’ll confirm the reservation as soon as the venue reviews it.',
        email: 'We’ll email you as soon as the venue confirms or updates this reservation.',
      };
    }

    if (reservation.status === 'cancelled') {
      return {
        summary: 'This reservation has been cancelled.',
        email: 'Need another table? You can start a fresh booking whenever you’re ready.',
      };
    }

    return {
      summary: 'Save this receipt for easier check-in when you arrive.',
      email: 'A confirmation email has been sent to your inbox.',
    };
  }, [reservation]);

  if (isLoading && !reservation) {
    return (
      <BookingDetailShell>
        <div className="space-y-6">
          <Skeleton className="h-12 w-64" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </BookingDetailShell>
    );
  }

  if (isError || !reservation) {
    return (
      <BookingDetailShell>
        <InlineAlert tone="danger">
          We couldn&apos;t load your receipt. Please try the link again.
        </InlineAlert>
        <div className="pt-4">
          <Button asChild className="rounded-full btn-tactile focus-ring touch-feedback">
            <Link href="/guest/bookings">View my bookings</Link>
          </Button>
        </div>
      </BookingDetailShell>
    );
  }

  const statCards = (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-6 lg:gap-8">
      <DetailStatCard icon={Calendar} label="Date" value={formatDateFull(reservation.startAt)} />
      <DetailStatCard
        icon={Clock}
        label="Time"
        value={formatTime(reservation.startAt)}
        subtext={venue.timezone}
      />
      <DetailStatCard
        icon={Users}
        label="Party"
        value={`${reservation.partySize}`}
        subtext={reservation.partySize === 1 ? 'Guest' : 'Guests'}
      />
    </div>
  );

  const guestInfo = (
    <InfoPanel
      title="Guest"
      rows={[
        { icon: Mail, label: 'Primary guest', value: reservation.customerName },
        ...(reservation.customerEmail
          ? [{ icon: Mail, label: 'Email', value: reservation.customerEmail }]
          : []),
      ]}
    />
  );

  return (
    <BookingDetailShell>
      <BookingSummaryCard
        title={venue.name}
        description={receiptMessaging.summary}
        reference={reservation.reference ?? reservation.id.slice(0, 8).toUpperCase()}
        status={{ icon: Calendar, label: statusTone.label, tone: statusTone.tone }}
        actions={
          <SummaryActions>
            <SecondaryButton onClick={handleAddToCalendar}>
              <CalendarPlus className="mr-2 h-4 w-4" />
              Calendar
            </SecondaryButton>
            <SecondaryButton onClick={handleDownload}>
              <Download className="mr-2 h-4 w-4" />
              PDF
            </SecondaryButton>
            <SecondaryButton onClick={handleShare}>
              <Share2 className="mr-2 h-4 w-4" />
              Share
            </SecondaryButton>
          </SummaryActions>
        }
      />

      {statCards}
      {guestInfo}

      <ActionButtonRow>
        <SecondaryButton onClick={handleAddToCalendar}>
          <CalendarPlus className="mr-2 h-4 w-4" />
          Calendar
        </SecondaryButton>
        <SecondaryButton onClick={handleDownload}>
          <Download className="mr-2 h-4 w-4" />
          PDF
        </SecondaryButton>
        <SecondaryButton onClick={handleShare}>
          <Share2 className="mr-2 h-4 w-4" />
          Share
        </SecondaryButton>
      </ActionButtonRow>

      <InlineAlert tone="info">
        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4" />
          <p className="text-[length:var(--font-size-sm)]">
            {receiptMessaging.email}
          </p>
        </div>
      </InlineAlert>

      {!hasSession ? (
        <InlineAlert tone="info">
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-semibold">Sign in to manage bookings faster.</span>
            <Link
              href={`/auth/signin?redirectedFrom=/guest/bookings/${reservationId}`}
              className="font-semibold text-blue-700 underline focus-ring touch-feedback"
            >
              Sign in →
            </Link>
          </div>
        </InlineAlert>
      ) : null}
    </BookingDetailShell>
  );
}

'use client';

import { useQueryClient } from '@tanstack/react-query';
import { Calendar, ChevronRight, Clock, ReceiptText, User, Users } from 'lucide-react';
import { DateTime } from 'luxon';
import Link from 'next/link';
import { useMemo } from 'react';

import {
  GuestContent,
  GuestError,
  GuestInsetCard,
  GuestPageFrame,
  GuestPanel,
  GuestPrimaryButton,
  GuestSecondaryButton,
} from '@/components/guest/ui';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useGuestBookings, useGuestProfile, useGuestSession } from '@/guest/hooks';
import { getGreeting } from '@/guest/lib/formatters';
import { StatusRegion } from '@/guest/routes/shared/StatusRegion';
import { queryKeys } from '@/lib/query/keys';
import { cn } from '@/lib/utils';
import {
  formatReservationDateFromDate,
  formatReservationTimeFromDate,
} from '@reserve/shared/formatting/booking';
import {
  getBookingDateTimeMillis,
  parseBookingDateTime,
  resolveBookingTimezone,
} from '@reserve/shared/formatting/bookingDateTime';

import { deriveBookingState } from './booking-derivations';

import type { BookingDTO } from '@/guest/services/ports';
import type { LucideIcon } from 'lucide-react';

export function GuestDashboardClient() {
  const queryClient = useQueryClient();
  const { data, isLoading, isError } = useGuestBookings();
  const { data: profile } = useGuestProfile();
  const { user } = useGuestSession();

  const derived = useMemo(() => deriveBookingState(data?.items ?? []), [data?.items]);
  const primaryBooking = derived.liveBooking ?? derived.nextBooking ?? null;

  const upcomingList = useMemo(() => {
    const items = data?.items ?? [];
    const now = Date.now();
    const primaryId = primaryBooking?.id;

    return items
      .filter((booking) => {
        if (booking.id === primaryId) return false;
        if (['cancelled', 'no_show', 'completed'].includes(booking.status)) return false;
        const start = getBookingDateTimeMillis(booking.startIso, booking.restaurantTimezone);
        return start !== null && start >= now;
      })
      .sort(
        (a, b) =>
          (getBookingDateTimeMillis(a.startIso, a.restaurantTimezone) ?? 0) -
          (getBookingDateTimeMillis(b.startIso, b.restaurantTimezone) ?? 0),
      );
  }, [data?.items, primaryBooking?.id]);

  const heroName = useMemo(() => {
    const metadata = (user?.user_metadata ?? null) as Record<string, unknown> | null;
    const fullName =
      typeof metadata?.['full_name'] === 'string' ? (metadata['full_name'] as string) : null;
    return fullName || profile?.name || user?.email?.split('@')[0] || 'Guest';
  }, [user, profile?.name]);

  const firstName = heroName.split(' ')[0] || 'Guest';

  if (isError) {
    return (
      <StatusRegion focus live="assertive">
        <div className="flex min-h-[60vh] items-center justify-center px-4">
          <GuestError
            description="We couldn't fetch your reservations. Please try again."
            onRetry={() => {
              queryClient.invalidateQueries({ queryKey: queryKeys.bookings.all });
              queryClient.invalidateQueries({ queryKey: queryKeys.profile.self() });
            }}
          />
        </div>
      </StatusRegion>
    );
  }

  return (
    <GuestPageFrame className="pb-12 sm:pb-16">
      <GuestContent className="space-y-6 py-7 sm:space-y-7 sm:py-9 lg:py-10">
        <header className="grid gap-4 border-b border-border/70 pb-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <div className="min-w-0 space-y-2">
            <p className="pg-kicker">
              {getGreeting()}, {firstName}
            </p>
            <h1 className="font-[var(--pg-font-display)] text-3xl font-bold leading-tight text-foreground sm:text-4xl">
              Your bookings
            </h1>
            <p className="pg-body max-w-[58ch]">
              Manage upcoming reservations, open receipts, and update the profile details used for
              future bookings.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <GuestPrimaryButton href="/restaurants">Book a table</GuestPrimaryButton>
            <GuestSecondaryButton href="/guest/bookings">All bookings</GuestSecondaryButton>
          </div>
        </header>

        <section className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-1">
              <p className="pg-kicker">Next action</p>
              <h2 className="pg-card-title">Current reservation</h2>
            </div>
            <Button
              asChild
              variant="guest-ghost"
              size="guest-sm"
              className="pg-action pg-focus-ring pg-touch w-fit"
            >
              <Link href="/guest/bookings">
                View booking history
                <ChevronRight className="size-4" aria-hidden />
              </Link>
            </Button>
          </div>
          <FeaturedBooking booking={primaryBooking} isLoading={isLoading} />
        </section>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(18rem,5fr)] lg:items-start">
          <section className="space-y-3">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="space-y-1">
                <p className="pg-kicker">Upcoming</p>
                <h2 className="pg-card-title">More reservations</h2>
              </div>
              {upcomingList.length > 0 ? (
                <Badge variant="guest-chip" className="pg-chip">
                  {upcomingList.length} upcoming
                </Badge>
              ) : null}
            </div>

            {isLoading ? (
              <UpcomingSkeletonGrid />
            ) : upcomingList.length === 0 ? (
              <GuestPanel className="p-5">
                <p className="text-sm font-semibold text-foreground">
                  No other upcoming reservations
                </p>
                <p className="pg-caption mt-1">
                  New bookings will appear here after your current reservation.
                </p>
              </GuestPanel>
            ) : (
              <div className="grid gap-3">
                {upcomingList.slice(0, 4).map((booking) => (
                  <UpcomingBookingCard key={booking.id} booking={booking} />
                ))}
              </div>
            )}
          </section>

          <aside className="space-y-3 lg:sticky lg:top-24">
            <GuestPanel className="p-5">
              <div className="space-y-1">
                <p className="pg-kicker">Account</p>
                <h2 className="pg-card-title">Quick links</h2>
                <p className="pg-caption">
                  Profile details and receipts stay available when you need them.
                </p>
              </div>
              <div className="mt-4 grid gap-2">
                <AccountLink
                  icon={User}
                  href="/guest/profile"
                  title="Profile"
                  description="Contact details and preferences"
                />
                <AccountLink
                  icon={ReceiptText}
                  href="/guest/bookings?tab=history"
                  title="Receipts"
                  description="Past bookings and receipt pages"
                />
              </div>
            </GuestPanel>
          </aside>
        </div>
      </GuestContent>
    </GuestPageFrame>
  );
}

function FeaturedBooking({
  booking,
  isLoading,
}: {
  booking: BookingDTO | null;
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <GuestPanel className="overflow-hidden">
        <div className="grid lg:grid-cols-[minmax(0,1fr)_17rem]">
          <div className="space-y-5 p-5 sm:p-6">
            <div className="flex flex-wrap items-center gap-2">
              <Skeleton className="h-8 w-28 rounded-full" />
              <Skeleton className="h-8 w-24 rounded-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-8 w-full max-w-72 rounded-xl" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-full max-w-[32rem]" />
                <Skeleton className="h-4 w-full max-w-[22rem]" />
                <Skeleton className="h-4 w-full max-w-[18rem] sm:hidden" />
                <Skeleton className="h-4 w-full max-w-[14rem] sm:hidden" />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <MiniDetailSkeleton />
              <MiniDetailSkeleton />
              <MiniDetailSkeleton />
            </div>
          </div>
          <div className="flex flex-col justify-between gap-4 border-t border-border bg-muted/30 p-5 lg:border-l lg:border-t-0">
            <div className="rounded-[var(--pg-radius-lg)] border border-border/80 bg-background p-4 shadow-[var(--pg-shadow-xs)]">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="mt-2 h-6 w-32" />
            </div>
            <Skeleton className="h-11 w-full rounded-full sm:h-12" />
          </div>
        </div>
      </GuestPanel>
    );
  }

  if (!booking) {
    return (
      <GuestPanel className="p-5 sm:p-6">
        <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
          <div className="min-w-0 space-y-2">
            <Badge variant="guest-chip" className="pg-chip">
              No active booking
            </Badge>
            <h3 className="pg-card-title">No upcoming bookings</h3>
            <p className="pg-body max-w-[54ch] text-sm">
              Book a table and your reservation details, reference, and receipt access will appear
              here.
            </p>
          </div>
          <GuestPrimaryButton href="/restaurants" className="w-full sm:w-auto">
            Find a table
          </GuestPrimaryButton>
        </div>
      </GuestPanel>
    );
  }

  const bookingDateTime = parseBookingDateTime(booking.startIso, booking.restaurantTimezone);
  const bookingDate = bookingDateTime?.toJSDate() ?? null;
  const isToday = bookingDateTime
    ? bookingDateTime.hasSame(
        DateTime.now().setZone(resolveBookingTimezone(booking.restaurantTimezone)),
        'day',
      )
    : false;
  const dateLabel = bookingDate
    ? formatReservationDateFromDate(bookingDate, {
        timezone: booking.restaurantTimezone ?? undefined,
      })
    : 'Date pending';
  const timeLabel = bookingDate
    ? formatReservationTimeFromDate(bookingDate, {
        timezone: booking.restaurantTimezone ?? undefined,
      })
    : 'Time pending';

  return (
    <GuestPanel className="overflow-hidden">
      <div className="grid lg:grid-cols-[minmax(0,1fr)_17rem]">
        <div className="space-y-5 p-5 sm:p-6">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="guest-chip" className="pg-chip">
              {isToday ? 'Happening today' : 'Next booking'}
            </Badge>
            <Badge variant="guest-chip-outline" className="pg-chip">
              {formatBookingStatus(booking.status)}
            </Badge>
          </div>
          <div className="space-y-2">
            <h3 className="pg-card-title text-2xl">{booking.restaurantName}</h3>
            <p className="pg-body max-w-[54ch] text-sm">
              Manage this reservation, check the arrival details, or open the receipt after your
              visit.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <MiniDetail icon={Calendar} label="Date" value={dateLabel} />
            <MiniDetail icon={Clock} label="Time" value={timeLabel} />
            <MiniDetail icon={Users} label="Party" value={`${booking.partySize} guests`} />
          </div>
        </div>
        <div className="flex flex-col justify-between gap-4 border-t border-border bg-muted/30 p-5 lg:border-l lg:border-t-0">
          <div className="rounded-[var(--pg-radius-lg)] border border-border/80 bg-background p-4 shadow-[var(--pg-shadow-xs)]">
            <p className="font-[var(--pg-font-mono)] text-xs uppercase tracking-[0.22em] text-muted-foreground">
              Reference
            </p>
            <p className="mt-1 break-all font-[var(--pg-font-mono)] text-lg font-semibold tracking-[0.14em] text-foreground">
              {booking.id.slice(0, 8).toUpperCase()}
            </p>
          </div>
          <Button
            asChild
            size="guest-lg"
            variant="guest-primary"
            className="pg-action pg-focus-ring pg-touch"
          >
            <Link href={`/guest/bookings/${booking.id}`}>Manage booking</Link>
          </Button>
        </div>
      </div>
    </GuestPanel>
  );
}

function MiniDetailSkeleton() {
  return (
    <div className="rounded-[var(--pg-radius-md)] border border-border/70 bg-background/80 p-4 shadow-[var(--pg-shadow-xs)]">
      <Skeleton className="mb-3 size-4 rounded-full" />
      <Skeleton className="h-3 w-14" />
      <Skeleton className="mt-2 h-5 w-full max-w-40" />
    </div>
  );
}

function UpcomingSkeletonGrid() {
  return (
    <div className="grid gap-3">
      {[0, 1, 2].map((item) => (
        <GuestPanel key={item} className="p-4">
          <div className="flex items-center gap-4">
            <Skeleton className="size-14 rounded-2xl" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          </div>
        </GuestPanel>
      ))}
    </div>
  );
}

function UpcomingBookingCard({ booking }: { booking: BookingDTO }) {
  const bookingDateTime = parseBookingDateTime(booking.startIso, booking.restaurantTimezone);
  const timeLabel = bookingDateTime
    ? formatReservationTimeFromDate(bookingDateTime.toJSDate(), {
        timezone: booking.restaurantTimezone ?? undefined,
      })
    : 'Time pending';

  return (
    <Link
      href={`/guest/bookings/${booking.id}`}
      className="pg-focus-ring block rounded-[var(--pg-radius-md)]"
    >
      <GuestPanel interactive className="pg-touch group flex items-center gap-3 p-4">
        <div className="flex size-14 shrink-0 flex-col items-center justify-center rounded-[var(--pg-radius-md)] border border-border/80 bg-background text-primary shadow-[var(--pg-shadow-xs)]">
          <span className="text-xs font-bold uppercase">
            {bookingDateTime?.setLocale('en').toFormat('MMM') ?? 'TBC'}
          </span>
          <span className="text-2xl font-bold leading-none">
            {bookingDateTime?.toFormat('d') ?? '--'}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground sm:text-base">
            {booking.restaurantName}
          </p>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
            <Clock className="size-3.5" aria-hidden />
            <span>{timeLabel}</span>
            <span aria-hidden>·</span>
            <span>{booking.partySize} guests</span>
          </p>
        </div>
        <ChevronRight
          className="size-5 text-muted-foreground transition group-hover:text-foreground"
          aria-hidden
        />
      </GuestPanel>
    </Link>
  );
}

function MiniDetail({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <GuestInsetCard
      icon={Icon}
      label={label}
      value={<span className={cn(label !== 'Date' && 'block truncate')}>{value}</span>}
    />
  );
}

function AccountLink({
  icon: Icon,
  href,
  title,
  description,
}: {
  icon: LucideIcon;
  href: string;
  title: string;
  description: string;
}) {
  return (
    <Link href={href} className="pg-focus-ring block rounded-[var(--pg-radius-md)]">
      <div className="pg-touch flex items-center gap-3 rounded-[var(--pg-radius-md)] border border-border/70 bg-background/80 p-3 transition hover:border-primary/25 hover:bg-background">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Icon className="size-4" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-foreground">{title}</span>
          <span className="pg-caption block">{description}</span>
        </span>
        <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
      </div>
    </Link>
  );
}

function formatBookingStatus(status: BookingDTO['status']): string {
  return status
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

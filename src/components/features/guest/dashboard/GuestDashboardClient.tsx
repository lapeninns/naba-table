'use client';

import { useQueryClient } from '@tanstack/react-query';
import { Calendar, Clock, Heart, MapPin, User, ChevronRight, Sparkles } from 'lucide-react';
import { DateTime } from 'luxon';
import Link from 'next/link';
import { useMemo } from 'react';

import {
  GuestError,
  GuestHero,
  GuestMetricCard,
  GuestPrimaryButton,
  GuestSecondaryButton,
} from '@/components/guest/ui';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
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

export function GuestDashboardClient() {
  const queryClient = useQueryClient();
  const { data, isLoading, isError } = useGuestBookings();
  const { data: profile } = useGuestProfile();
  const { user } = useGuestSession();

  const derived = useMemo(() => deriveBookingState(data?.items ?? []), [data?.items]);

  const upcomingList = useMemo(() => {
    const items = data?.items ?? [];
    const now = new Date();
    const primaryId = derived.liveBooking?.id ?? derived.nextBooking?.id;

    return items
      .filter((b) => {
        if (b.id === primaryId) return false;
        const start = getBookingDateTimeMillis(b.startIso, b.restaurantTimezone);
        if (start === null) return false;
        if (['cancelled', 'no_show', 'completed'].includes(b.status)) return false;
        return start >= now.getTime();
      })
      .sort(
        (a, b) =>
          (getBookingDateTimeMillis(a.startIso, a.restaurantTimezone) ?? 0) -
          (getBookingDateTimeMillis(b.startIso, b.restaurantTimezone) ?? 0),
      );
  }, [data?.items, derived.liveBooking, derived.nextBooking]);

  const primaryBooking = derived.liveBooking ?? derived.nextBooking ?? null;

  const heroName = useMemo(() => {
    const metadata = (user?.user_metadata ?? null) as Record<string, unknown> | null;
    const fullName =
      typeof metadata?.['full_name'] === 'string' ? (metadata['full_name'] as string) : null;
    return fullName || profile?.name || user?.email?.split('@')[0] || 'Guest';
  }, [user, profile?.name]);

  const greeting = getGreeting();

  const stats = useMemo(
    () => ({
      upcoming: upcomingList.length,
      favorites: derived.favorites.length,
    }),
    [upcomingList.length, derived.favorites.length],
  );

  if (isError) {
    return (
      <StatusRegion focus live="assertive" className="min-h-[100dvh] pb-20">
        <div className="flex min-h-[60vh] items-center justify-center">
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
    <div className="pg-surface min-h-[100dvh] pb-20">
      <GuestHero
        eyebrow="Guest dashboard"
        title={`${greeting}, ${heroName.split(' ')[0]}`}
        description="Manage your upcoming tables, receipts, and favourites in one calm workspace."
        actions={
          <>
            <GuestPrimaryButton href="/restaurants">Book a table</GuestPrimaryButton>
            <GuestSecondaryButton href="/guest/bookings">My bookings</GuestSecondaryButton>
            <Button
              asChild
              size="lg"
              variant="ghost"
              className="pg-action pg-focus-ring pg-touch min-h-[48px] rounded-full text-primary hover:text-primary"
            >
              <Link href="/guest/profile">Profile</Link>
            </Button>
          </>
        }
        aside={
          <div className="grid w-full max-w-md grid-cols-2 gap-3">
            <GuestMetricCard icon={Calendar} label="Upcoming" value={stats.upcoming} />
            <GuestMetricCard icon={Heart} label="Favourites" value={stats.favorites} />
          </div>
        }
        compact
      />

      {/* Main content */}
      <div className="mx-auto grid w-full max-w-6xl gap-6 sm:gap-8 py-6 sm:py-8 lg:py-10 lg:grid-cols-[1.6fr_1fr] px-4 sm:px-6">
        <div className="pg-stagger space-y-6 sm:space-y-8">
          {/* Next booking / empty state */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="pg-card-title">Next up</h2>
              <Link
                href="/guest/bookings"
                className="pg-focus-ring pg-touch -mr-1 flex items-center gap-1 rounded-sm p-1 text-sm font-semibold text-primary hover:text-primary"
              >
                View all <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
            <FeaturedBooking booking={primaryBooking} isLoading={isLoading} />
          </section>

          {/* Upcoming list */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="pg-card-title">Upcoming</h2>
              {upcomingList.length > 0 ? (
                <Badge variant="metric" className="rounded-full">
                  {upcomingList.length} reservation(s)
                </Badge>
              ) : null}
            </div>
            {upcomingList.length === 0 ? (
              <Card className="pg-card p-6">
                <p className="text-base font-semibold text-foreground">No upcoming reservations</p>
                <p className="pg-caption mt-1">Book a table now and it will appear here.</p>
                <div className="mt-4">
                  <Button
                    asChild
                    className="pg-action pg-focus-ring pg-touch min-h-[44px] rounded-full"
                  >
                    <Link href="/restaurants">Find a table</Link>
                  </Button>
                </div>
              </Card>
            ) : (
              <div className="pg-stagger grid gap-4 md:grid-cols-2">
                {upcomingList.slice(0, 4).map((booking) => (
                  <UpcomingBookingCard key={booking.id} booking={booking} />
                ))}
              </div>
            )}
          </section>
        </div>

        <div className="space-y-4 sm:space-y-6">
          {derived.favorites.length > 0 && (
            <Card className="p-4 sm:p-5 space-y-2.5 sm:space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-foreground">Favorites</p>
                <Badge className="rounded-full bg-primary/5 text-primary text-xs">Top picks</Badge>
              </div>
              <ul className="space-y-2.5 sm:space-y-3">
                {derived.favorites.slice(0, 5).map((fav) => (
                  <li
                    key={fav.name}
                    className="flex items-center justify-between text-xs sm:text-sm text-foreground/80"
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <Heart
                        className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary flex-shrink-0"
                        aria-hidden
                      />
                      <span className="truncate">{fav.name}</span>
                    </span>
                    <span className="pg-caption ml-2 flex-shrink-0">{fav.count}x</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {/* Profile quick access */}
          <Card className="p-4 sm:p-5 bg-muted">
            <div className="flex items-center gap-3">
              <div className="pg-card flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full sm:h-10 sm:w-10">
                <User className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">Your profile</p>
                <p className="pg-caption truncate">Preferences and contact details</p>
              </div>
            </div>
            <div className="mt-3 sm:mt-4 space-y-2">
              <Button
                asChild
                variant="secondary"
                className="pg-action pg-focus-ring pg-touch w-full rounded-full text-primary"
              >
                <Link href="/guest/profile">Edit profile</Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="pg-action pg-focus-ring pg-touch w-full rounded-full"
              >
                <Link href="/guest/bookings">View receipts</Link>
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

/* ============================================================================
   FEATURED BOOKING COMPONENT (Revamped for DesignSystem.md)
   ============================================================================ */

function FeaturedBooking({
  booking,
  isLoading,
}: {
  booking: BookingDTO | null;
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <Card variant="featured" className="pg-skeleton overflow-hidden">
        <div className="grid sm:grid-cols-[1fr_220px] lg:grid-cols-[1fr_260px]">
          <div className="p-5 sm:p-6 lg:p-8 space-y-4 sm:space-y-6">
            <Skeleton className="h-7 w-32 rounded-full" />
            <div className="space-y-3">
              <Skeleton className="h-7 sm:h-8 lg:h-10 w-3/4 rounded-lg" />
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-4 rounded-full" />
                <Skeleton className="h-4 w-1/3 rounded" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4 sm:gap-6 pt-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-3 w-10 sm:w-12 rounded" />
                  <Skeleton className="h-5 w-16 sm:w-24 rounded" />
                </div>
              ))}
            </div>
          </div>
          <div className="bg-muted border-t sm:border-t-0 sm:border-l border-border p-5 sm:p-6 flex flex-col items-center justify-center gap-3 sm:gap-4">
            <Skeleton className="h-20 sm:h-24 w-full rounded-2xl" />
            <Skeleton className="h-3 w-28 sm:w-32 rounded" />
            <Skeleton className="h-11 sm:h-12 w-full rounded-full" />
          </div>
        </div>
      </Card>
    );
  }

  if (!booking) {
    return (
      <div className="pg-panel relative overflow-hidden p-6 text-center sm:p-8 lg:p-12">
        <div className="relative z-10 flex flex-col items-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 sm:mb-6 sm:h-16 sm:w-16">
            <Sparkles className="h-6 w-6 text-primary sm:h-8 sm:w-8" />
          </div>
          <h2 className="pg-section-title mb-3 sm:mb-4">No upcoming plans?</h2>
          <p className="mb-6 max-w-xl text-base text-muted-foreground sm:mb-8 sm:text-lg">
            Explore our curated list of restaurants and secure your table for tonight.
          </p>
          <div className="flex gap-4">
            <Button
              asChild
              className="pg-action pg-focus-ring pg-touch rounded-full bg-primary px-6 py-5 text-base font-semibold text-primary-foreground hover:bg-primary/90 sm:px-8 sm:py-6 sm:text-lg"
            >
              <Link href="/restaurants">Find a Table</Link>
            </Button>
          </div>
        </div>
        <div className="absolute right-0 top-0 h-48 w-48 -translate-y-1/2 translate-x-1/2 rounded-full bg-primary/10 blur-3xl sm:h-64 sm:w-64" />
      </div>
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

  return (
    <Card variant="featured" className="pg-card-interactive overflow-hidden">
      <div className="grid sm:grid-cols-[1fr_200px] lg:grid-cols-[1fr_260px]">
        <div className="p-5 sm:p-6 lg:p-8 space-y-4 sm:space-y-6">
          <Badge
            variant={isToday ? 'status-confirmed' : 'default'}
            className={cn(
              'rounded-full px-3 py-1 font-semibold text-xs sm:text-sm',
              !isToday && 'bg-muted text-foreground/80 border-none',
            )}
          >
            {isToday ? 'Happening today' : 'Upcoming reservation'}
          </Badge>

          <div>
            <h2 className="pg-section-title mb-1">{booking.restaurantName}</h2>
            <div className="flex items-center text-muted-foreground font-medium text-sm">
              <MapPin className="w-4 h-4 mr-2 flex-shrink-0" />
              {booking.restaurantSlug ? 'View details' : 'Restaurant'}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 sm:gap-4 lg:gap-6">
            <Detail
              label="Date"
              value={
                bookingDate
                  ? formatReservationDateFromDate(bookingDate, {
                      timezone: booking.restaurantTimezone ?? undefined,
                    })
                  : '—'
              }
            />
            <Detail
              label="Time"
              value={
                bookingDate
                  ? formatReservationTimeFromDate(bookingDate, {
                      timezone: booking.restaurantTimezone ?? undefined,
                    })
                  : '—'
              }
            />
            <Detail label="Guests" value={`${booking.partySize} people`} />
          </div>
        </div>

        <div className="bg-muted border-t sm:border-t-0 sm:border-l border-border p-5 sm:p-6 flex flex-col items-center justify-center text-center gap-3 sm:gap-4">
          <div className="w-full rounded-xl sm:rounded-2xl border border-border bg-background py-3 sm:py-4">
            <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-[0.2em] sm:tracking-[0.3em] text-muted-foreground/60">
              Code
            </p>
            <div className="font-mono text-xl sm:text-2xl font-bold text-foreground tracking-[0.2em] sm:tracking-[0.3em]">
              {booking.id.slice(0, 8).toUpperCase()}
            </div>
          </div>
          <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wide">
            Show this code at check-in
          </p>

          <Button
            asChild
            className="pg-action pg-focus-ring pg-touch w-full rounded-full text-sm sm:text-base"
            size="lg"
          >
            <Link href={`/guest/bookings/${booking.id}`}>Manage booking</Link>
          </Button>
        </div>
      </div>
    </Card>
  );
}

function UpcomingBookingCard({ booking }: { booking: BookingDTO }) {
  const bookingDateTime = parseBookingDateTime(booking.startIso, booking.restaurantTimezone);
  const bookingDate = bookingDateTime?.toJSDate() ?? null;
  return (
    <Link href={`/guest/bookings/${booking.id}`} className="pg-focus-ring block rounded-xl">
      <Card
        variant="interactive"
        className="pg-card pg-card-interactive pg-touch group flex items-center gap-3 p-3 sm:gap-4 sm:p-4"
      >
        <div className="flex-shrink-0 w-14 h-14 sm:w-16 sm:h-16 bg-primary/5 text-primary rounded-lg sm:rounded-xl flex flex-col items-center justify-center leading-none">
          <span className="text-[10px] sm:text-xs font-bold uppercase mb-0.5 sm:mb-1">
            {bookingDateTime?.setLocale('en').toFormat('MMM') ?? '—'}
          </span>
          <span className="text-xl sm:text-2xl font-bold">
            {bookingDateTime?.toFormat('d') ?? '—'}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-bold text-foreground truncate text-sm sm:text-base">
            {booking.restaurantName}
          </h4>
          <div className="text-xs sm:text-sm text-muted-foreground flex items-center mt-0.5 sm:mt-1">
            <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5 mr-1 sm:mr-1.5 flex-shrink-0" />
            {bookingDate
              ? formatReservationTimeFromDate(bookingDate, {
                  timezone: booking.restaurantTimezone ?? undefined,
                })
              : '—'}
          </div>
        </div>
        <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground/40 group-hover:text-foreground transition-colors flex-shrink-0" />
      </Card>
    </Link>
  );
}

/* ============================================================================
   UTILITY FUNCTIONS
   ============================================================================ */

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-muted-foreground/60 mb-0.5 sm:mb-1">
        {label}
      </div>
      <div className="text-sm sm:text-base font-semibold text-foreground truncate">{value}</div>
    </div>
  );
}

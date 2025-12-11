'use client';

import { useQueryClient } from '@tanstack/react-query';
import { Calendar, Clock, Heart, MapPin, User, ChevronRight, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useMemo } from 'react';

import { GuestError } from '@/components/guest/ui';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useGuestBookings, useGuestProfile, useGuestSession } from '@/guest/hooks';
import { getGreeting } from '@/guest/lib/formatters';
import { StatusRegion } from '@/guest/routes/shared/StatusRegion';
import { queryKeys } from '@/lib/query/keys';
import { cn } from '@/lib/utils';
import { formatReservationDateFromDate, formatReservationTimeFromDate } from '@reserve/shared/formatting/booking';

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
        const start = new Date(b.startIso);
        if (Number.isNaN(start.getTime())) return false;
        if (['cancelled', 'no_show', 'completed'].includes(b.status)) return false;
        return start.getTime() >= now.getTime();
      })
      .sort((a, b) => new Date(a.startIso).getTime() - new Date(b.startIso).getTime());
  }, [data?.items, derived.liveBooking, derived.nextBooking]);

  const primaryBooking = derived.liveBooking ?? derived.nextBooking ?? null;

  const heroName = useMemo(() => {
    const metadata = (user?.user_metadata ?? null) as Record<string, unknown> | null;
    const fullName = typeof metadata?.['full_name'] === 'string' ? (metadata['full_name'] as string) : null;
    return fullName || profile?.name || user?.email?.split('@')[0] || 'Guest';
  }, [user, profile?.name]);

  const greeting = getGreeting();

  const stats = useMemo(
    () => ({
      total: derived.total,
      upcoming: upcomingList.length,
      favorites: derived.favorites.length,
    }),
    [derived.total, upcomingList.length, derived.favorites.length],
  );

  if (isError) {
    return (
      <StatusRegion focus live="assertive" className="min-h-screen pb-20">
        <div className="flex min-h-[60vh] items-center justify-center">
          <GuestError
            description="We couldn’t fetch your reservations. Please try again."
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
    <div className="min-h-screen bg-surface pb-20">
      {/* Hero */}
      <section className="border-b border-slate-100 bg-gradient-to-r from-blue-50 to-white">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 py-10 sm:py-12">
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-[0.2em] text-subtle">Guest dashboard</p>
            <h1 className="heading-lg md:heading-xl text-slate-900">
              {greeting}, {heroName.split(' ')[0]}
            </h1>
            <p className="text-body text-subtle">Manage your upcoming tables, receipts, and favorites in one place.</p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg" className="rounded-full bg-primary text-white hover:bg-primary/90">
              <Link href="/restaurants">Book a table</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="rounded-full border-slate-200 bg-white text-blue-700 hover:border-blue-500">
              <Link href="/guest/bookings">My bookings</Link>
            </Button>
            <Button asChild size="lg" variant="ghost" className="text-blue-700 hover:text-blue-800">
              <Link href="/guest/profile">Profile</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Main content */}
      <div className="mx-auto grid w-full max-w-6xl gap-8 py-8 sm:py-10 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-8">
          {/* Next booking / empty state */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-slate-900">Next up</h2>
              <Link href="/guest/bookings" className="text-sm font-semibold text-blue-700 hover:text-blue-800 flex items-center gap-1">
                View all <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
            <FeaturedBooking booking={primaryBooking} isLoading={isLoading} />
          </section>

          {/* Upcoming list */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-slate-900">Upcoming</h2>
              {upcomingList.length > 0 ? (
                <span className="text-sm text-subtle">{upcomingList.length} reservation(s)</span>
              ) : null}
            </div>
            {upcomingList.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
                <p className="text-base font-semibold text-slate-900">No upcoming reservations</p>
                <p className="text-sm text-subtle mt-1">Book a table now and it will appear here.</p>
                <div className="mt-4">
                  <Button asChild className="rounded-full">
                    <Link href="/restaurants">Find a table</Link>
                  </Button>
                </div>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {upcomingList.slice(0, 4).map((booking) => (
                  <UpcomingBookingCard key={booking.id} booking={booking} />
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quick stats */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-900">At a glance</p>
              <Badge variant="secondary" className="rounded-full px-3 py-1 text-blue-900">
                {stats.total} total
              </Badge>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <StatPill label="Upcoming" value={stats.upcoming} icon={<Calendar className="h-4 w-4" />} />
              <StatPill label="Favorites" value={stats.favorites} icon={<Heart className="h-4 w-4" />} />
            </div>
          </div>

          {/* Favorites */}
          {derived.favorites.length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-900">Favorites</p>
                <Badge className="rounded-full bg-blue-50 text-blue-700">Top picks</Badge>
              </div>
              <ul className="space-y-3">
                {derived.favorites.slice(0, 5).map((fav) => (
                  <li key={fav.name} className="flex items-center justify-between text-sm text-slate-700">
                    <span className="flex items-center gap-2">
                      <Heart className="h-4 w-4 text-blue-600" aria-hidden />
                      {fav.name}
                    </span>
                    <span className="text-subtle">{fav.count}x</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Profile quick access */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 shadow-card">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-white shadow-card flex items-center justify-center">
                <User className="h-5 w-5 text-blue-700" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">Your profile</p>
                <p className="text-xs text-subtle">Preferences and contact details</p>
              </div>
            </div>
            <div className="mt-4 space-y-2">
              <Button asChild variant="secondary" className="w-full rounded-full text-blue-700">
                <Link href="/guest/profile">Edit profile</Link>
              </Button>
              <Button asChild variant="outline" className="w-full rounded-full">
                <Link href="/guest/bookings">View receipts</Link>
              </Button>
            </div>
          </div>
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
      <div className="rounded-3xl bg-white p-8 shadow-[0_10px_15px_-3px_rgba(0,0,0,0.08)] border border-slate-200">
        <Skeleton className="h-48 w-full rounded-2xl" />
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="relative overflow-hidden rounded-3xl bg-slate-900 text-white shadow-[0_20px_25px_-5px_rgba(0,0,0,0.1)] p-8 md:p-12 text-center">
        <div className="relative z-10 flex flex-col items-center">
          <div className="h-16 w-16 bg-white/10 rounded-full flex items-center justify-center mb-6">
            <Sparkles className="h-8 w-8 text-white" />
          </div>
          <h2 className="text-3xl md:text-4xl font-bold mb-4 tracking-tight">No upcoming plans?</h2>
          <p className="text-lg text-slate-300 max-w-xl mb-8">
            Explore our curated list of restaurants and secure your table for tonight.
          </p>
          <div className="flex gap-4">
            <Button asChild className="rounded-full bg-white text-slate-900 hover:bg-slate-100 px-8 py-6 text-lg font-semibold border-none">
              <Link href="/restaurants">Find a Table</Link>
            </Button>
          </div>
        </div>
        {/* Decorative background elements */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
      </div>
    );
  }

  const bookingDate = new Date(booking.startIso);
  const isToday = isSameDay(bookingDate, new Date());

  return (
    <div className="group relative overflow-hidden rounded-3xl bg-white border border-slate-200 shadow-card transition-transform hover:-translate-y-1">
      <div className="grid md:grid-cols-[1fr_260px]">
        <div className="p-6 md:p-8 space-y-6">
          <Badge
            className={cn(
              "rounded-full px-3 py-1 font-semibold border-none",
              isToday ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-700",
            )}
          >
            {isToday ? "Happening today" : "Upcoming reservation"}
          </Badge>

          <div>
            <h2 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight mb-1">
              {booking.restaurantName}
            </h2>
            <div className="flex items-center text-slate-500 font-medium">
              <MapPin className="w-4 h-4 mr-2" />
              {booking.restaurantSlug ? "View details" : "Restaurant"}
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
            <Detail label="Date" value={formatReservationDateFromDate(bookingDate)} />
            <Detail label="Time" value={formatReservationTimeFromDate(bookingDate)} />
            <Detail label="Guests" value={`${booking.partySize} people`} />
          </div>
        </div>

        <div className="bg-slate-50 border-t md:border-t-0 md:border-l border-slate-200 p-6 flex flex-col items-center justify-center text-center gap-4">
          <div className="w-full rounded-2xl border border-slate-200 bg-white py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Code</p>
            <div className="font-mono text-2xl font-bold text-slate-900 tracking-[0.3em]">
              {booking.id.slice(0, 8).toUpperCase()}
            </div>
          </div>
          <p className="text-xs text-slate-500 uppercase tracking-wide">Show this code at check-in</p>

          <Button asChild className="w-full rounded-full" size="lg">
            <Link href={`/guest/bookings/${booking.id}`}>Manage booking</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

function UpcomingBookingCard({ booking }: { booking: BookingDTO }) {
  const bookingDate = new Date(booking.startIso);
  return (
    <Link
      href={`/guest/bookings/${booking.id}`}
      className="group bg-white rounded-2xl p-4 border border-slate-200 shadow-card hover:-translate-y-1 transition-all flex items-center gap-4"
    >
      <div className="flex-shrink-0 w-16 h-16 bg-blue-50 text-blue-700 rounded-xl flex flex-col items-center justify-center leading-none">
        <span className="text-xs font-bold uppercase mb-1">{bookingDate.toLocaleString('en-US', { month: 'short' })}</span>
        <span className="text-2xl font-bold">{bookingDate.getDate()}</span>
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="font-bold text-slate-900 truncate">{booking.restaurantName}</h4>
        <div className="text-sm text-slate-500 flex items-center mt-1">
          <Clock className="w-3.5 h-3.5 mr-1.5" />
          {formatReservationTimeFromDate(bookingDate)}
        </div>
      </div>
      <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-slate-600 transition-colors" />
    </Link>
  );
}


/* ============================================================================
   UTILITY FUNCTIONS
   ============================================================================ */

function isSameDay(d1: Date, d2: Date): boolean {
  return d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate();
}

function StatPill({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
      <div className="flex items-center gap-2 text-sm text-slate-700">
        <span className="text-blue-700">{icon}</span>
        {label}
      </div>
      <span className="text-base font-semibold text-slate-900">{value}</span>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">{label}</div>
      <div className="text-base font-semibold text-slate-900">{value}</div>
    </div>
  );
}

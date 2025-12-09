'use client';

import { useQueryClient } from '@tanstack/react-query';
import {
  Calendar,
  Clock,
  Heart,
  History,
  MapPin,
  Plus,
  QrCode,
  User,
  Sparkles,
  ChevronRight,
} from 'lucide-react';
import Link from 'next/link';
import { useMemo } from 'react';

import { ActionCard, GuestError, MetricTile, SearchBar } from '@/components/guest/ui';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
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
    <div className="min-h-screen pb-32 space-y-12">
      {/* 1. HERO SECTION & SEARCH */}
      <div className="relative bg-gradient-to-b from-white to-slate-50 pt-16 pb-24 px-6 md:px-12 border-b border-slate-100">
        <div className="max-w-6xl mx-auto space-y-8">
          <div className="space-y-4 max-w-2xl">
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-slate-900 leading-[1.1]">
              {greeting}, {heroName.split(' ')[0]}
            </h1>
            <p className="text-lg text-slate-600 leading-relaxed">
              Find your next favorite table or manage your upcoming plans.
            </p>
          </div>

          <div className="pt-4">
            <SearchBar onSearch={() => window.location.href = '/'} />
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 md:px-12 space-y-16">

        {/* 2. STATS OVERVIEW */}
        <section>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <MetricTile
              label="Total Visits"
              value={stats.total}
              icon={History}
              detail="+2 this month"
            />
            <MetricTile
              label="Upcoming"
              value={stats.upcoming}
              icon={Calendar}
              variant="highlight"
            />
            <MetricTile
              label="Favorites"
              value={stats.favorites}
              icon={Heart}
            />
          </div>
        </section>

        {/* 3. PRIMARY ACTION / NEXT BOOKING */}
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-slate-900">Next Priority</h2>
            {primaryBooking && (
              <Link href="/guest/bookings" className="text-sm font-semibold text-blue-600 hover:text-blue-700 flex items-center">
                See all <ChevronRight className="w-4 h-4 ml-1" />
              </Link>
            )}
          </div>

          <FeaturedBooking
            booking={primaryBooking}
            isLoading={isLoading}
          />
        </section>

        {/* 4. QUICK ACTIONS */}
        <section className="space-y-6">
          <h2 className="text-2xl font-bold text-slate-900">Manage</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <ActionCard
              icon={Plus}
              label="Book Table"
              description="New reservation"
              href="/"
            />
            <ActionCard
              icon={History}
              label="History"
              description="Past visits"
              href="/guest/bookings?tab=history"
            />
            <ActionCard
              icon={User}
              label="Profile"
              description="Preferences"
              href="/guest/profile"
            />
            <ActionCard
              icon={Heart}
              label="Favorites"
              description="Loved spots"
              href="/guest/bookings"
            />
          </div>
        </section>

        {/* 5. UPCOMING LIST */}
        {upcomingList.length > 0 && (
          <section className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-slate-900">Upcoming</h2>
              <Link href="/guest/bookings" className="text-sm font-semibold text-blue-600 hover:text-blue-700">View All</Link>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {upcomingList.slice(0, 6).map((booking) => (
                <UpcomingBookingCard key={booking.id} booking={booking} />
              ))}
            </div>
          </section>
        )}
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
              <Link href="/">Find a Table</Link>
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
    <div className="group relative overflow-hidden rounded-3xl bg-white border border-slate-200 shadow-[0_16px_48px_rgba(0,0,0,0.12)] transition-transform hover:-translate-y-1">
      <div className="grid md:grid-cols-[1fr_280px]">
        {/* Main Content */}
        <div className="p-8 md:p-10 space-y-8">
          <div className="flex items-center gap-3">
            <Badge className={cn("rounded-full px-3 py-1 font-semibold border-none", isToday ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-700")}>
              {isToday ? "Happening Today" : "Upcoming Reservation"}
            </Badge>
          </div>

          <div>
            <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight mb-2">
              {booking.restaurantName}
            </h2>
            <div className="flex items-center text-slate-500 font-medium">
              <MapPin className="w-5 h-5 mr-2" />
              View location
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-8">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Date</div>
              <div className="text-xl font-bold text-slate-900">{formatReservationDateFromDate(bookingDate)}</div>
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Time</div>
              <div className="text-xl font-bold text-slate-900">{formatReservationTimeFromDate(bookingDate)}</div>
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Guests</div>
              <div className="text-xl font-bold text-slate-900">{booking.partySize} People</div>
            </div>
          </div>
        </div>

        {/* Action Panel / QR */}
        <div className="bg-slate-50 border-t md:border-t-0 md:border-l border-slate-200 p-8 flex flex-col items-center justify-center text-center">
          <QRCodeDialog booking={booking}>
            <button className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 hover:scale-105 transition-transform">
              <QrCode className="w-24 h-24 text-slate-900" />
            </button>
          </QRCodeDialog>
          <div className="mt-4 font-mono text-xl font-bold text-slate-900 tracking-widest">
            {booking.id.slice(0, 8).toUpperCase()}
          </div>
          <p className="text-xs text-slate-500 mt-1 uppercase tracking-wide">Confirmation Code</p>

          <div className="mt-8 w-full">
            <Button asChild className="w-full rounded-full" size="lg">
              <Link href={`/guest/bookings/${booking.id}`}>Manage Booking</Link>
            </Button>
          </div>
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
      className="group bg-white rounded-2xl p-5 border border-slate-200 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all flex items-center gap-4"
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

function QRCodeDialog({ booking, children }: { booking: BookingDTO; children: React.ReactNode }) {
  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center text-xl">Check-in Code</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center justify-center py-8">
          <div className="rounded-2xl border-2 border-slate-100 bg-white p-6 shadow-inner">
            <QrCode className="h-48 w-48 text-slate-900" />
          </div>
          <div className="mt-6 text-center">
            <p className="font-mono text-2xl font-bold tracking-widest text-slate-900">
              {booking.id.slice(0, 8).toUpperCase()}
            </p>
            <p className="mt-2 text-sm text-slate-500">Show this code to the host on arrival</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

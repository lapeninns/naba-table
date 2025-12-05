'use client';

import { useQueryClient } from '@tanstack/react-query';
import {
  Calendar,
  ChevronRight,
  Clock,
  Heart,
  History,
  MapPin,
  Plus,
  QrCode,
  Share2,
  User,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { useMemo } from 'react';

import { GuestEmptyState } from '@/components/guest/shared/GuestEmptyState';
import { GuestErrorState } from '@/components/guest/shared/GuestErrorState';
import { GuestCard, GuestSection } from '@/components/guest/ui';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useGuestBookings, useGuestProfile, useGuestSession } from '@/guest/hooks';
import { getGreeting } from '@/guest/lib/formatters';
import { StatusRegion } from '@/guest/routes/shared/StatusRegion';
import { useToast } from '@/hooks/use-toast';
import { queryKeys } from '@/lib/query/keys';
import { cn } from '@/lib/utils';
import { formatReservationDateFromDate, formatReservationTimeFromDate } from '@reserve/shared/formatting/booking';

import { deriveBookingState, type FavoriteRestaurant } from './booking-derivations';

import type { BookingDTO } from '@/guest/services/ports';

export function GuestDashboardClient() {
  const queryClient = useQueryClient();
  const { data, isLoading, isError } = useGuestBookings();
  const { data: profile } = useGuestProfile();
  const { user } = useGuestSession();
  const { toast } = useToast();

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

  if (isError) {
    return (
      <StatusRegion focus live="assertive" className="min-h-screen pb-20">
        <GuestErrorState
          description="We couldn’t fetch your reservations. Please try again."
          onRetry={() => {
            queryClient.invalidateQueries({ queryKey: queryKeys.bookings.all });
            queryClient.invalidateQueries({ queryKey: queryKeys.profile.self() });
          }}
        />
      </StatusRegion>
    );
  }

  return (
    <div className="min-h-screen pb-20 guest-sections">
      <GuestSection
        eyebrow="Welcome back"
        title={`${greeting}, ${heroName.split(' ')[0]}`}
        description={
          primaryBooking
            ? "Your next dining experience is all set."
            : "Ready to discover your next great meal?"
        }
      >
        <div className="sr-only">Dashboard intro</div>
      </GuestSection>

      <div className="guest-sections">
        <GuestSection padding="md" title="Featured booking">
          <FeaturedBooking
            booking={primaryBooking}
            isLoading={isLoading}
            toast={toast}
          />
        </GuestSection>

        <GuestSection padding="md" title="Quick actions">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 guest-stagger">
            <QuickActionCard
              icon={Plus}
              label="New Booking"
              description="Find a table"
              href="/"
              gradient="from-blue-500 to-blue-600"
            />
            <QuickActionCard
              icon={History}
              label="History"
              description="Past trips"
              href="/guest/bookings?tab=history"
              gradient="from-violet-500 to-violet-600"
            />
            <QuickActionCard
              icon={User}
              label="Profile"
              description="Your details"
              href="/guest/profile"
              gradient="from-emerald-500 to-emerald-600"
            />
            <QuickActionCard
              icon={Heart}
              label="Favorites"
              description="Top spots"
              href="/guest/bookings"
              gradient="from-rose-500 to-rose-600"
            />
          </div>
        </GuestSection>

        <div className="grid gap-6 lg:grid-cols-2">
          <GuestSection
            padding="md"
            title="Upcoming"
            actions={
              upcomingList.length > 0 ? (
                <Link
                  href="/guest/bookings"
                  className="flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors"
                >
                  View all <ChevronRight className="h-4 w-4" />
                </Link>
              ) : null
            }
          >
            {isLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-24 w-full rounded-2xl" />
                <Skeleton className="h-24 w-full rounded-2xl" />
              </div>
            ) : upcomingList.length > 0 ? (
              <div className="space-y-4">
                {upcomingList.slice(0, 3).map((booking, index) => (
                  <UpcomingBookingRow
                    key={booking.id}
                    booking={booking}
                    style={{ animationDelay: `${index * 50}ms` }}
                  />
                ))}
              </div>
            ) : (
              <GuestEmptyState
                icon={<Calendar className="h-8 w-8" aria-hidden />}
                title="No upcoming trips"
                description="When you book a table, it will show up here."
                ctaLabel="Find a restaurant"
                ctaHref="/"
              />
            )}
          </GuestSection>

          <GuestSection padding="md" title="Your favorites">
            {isLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-24 w-full rounded-2xl" />
              </div>
            ) : derived.favorites.length > 0 ? (
              <div className="space-y-4">
                {derived.favorites.slice(0, 3).map((fav, i) => (
                  <FavoriteRow key={fav.slug || i} favorite={fav} />
                ))}
              </div>
            ) : (
              <GuestEmptyState
                icon={<Heart className="h-8 w-8" aria-hidden />}
                title="No favorites yet"
                description="Restaurants you visit often will appear here."
                ctaLabel="Explore restaurants"
                ctaHref="/"
              />
            )}
          </GuestSection>
        </div>
      </div>
    </div>
  );
}

/* ============================================================================
   FEATURED BOOKING COMPONENT
   ============================================================================ */

function FeaturedBooking({
  booking,
  isLoading,
  toast
}: {
  booking: BookingDTO | null;
  isLoading: boolean;
  toast: ReturnType<typeof useToast>['toast'];
}) {
  if (isLoading) {
    return (
      <GuestCard className="overflow-hidden bg-white p-8 shadow-xl">
        <div className="space-y-6">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-10 w-2/3" />
          <Skeleton className="h-32 w-full rounded-2xl" />
          <div className="flex gap-4">
            <Skeleton className="h-12 w-40 rounded-full" />
            <Skeleton className="h-12 w-32 rounded-full" />
          </div>
        </div>
      </GuestCard>
    );
  }

  if (!booking) {
    return (
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8 shadow-2xl sm:p-12">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            }}
          />
        </div>
        {/* Gradient Orbs */}
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-blue-500/20 blur-3xl" />
        <div className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-violet-500/20 blur-3xl" />

        <div className="relative z-10 mx-auto max-w-lg text-center">
          <div className="mx-auto mb-8 flex h-20 w-20 items-center justify-center rounded-full bg-white/10 backdrop-blur-sm ring-1 ring-white/20">
            <Calendar className="h-10 w-10 text-white" />
          </div>
          <h2 className="text-3xl font-bold text-white sm:text-4xl">
            Ready for your next adventure?
          </h2>
          <p className="mt-4 text-lg text-slate-300">
            Discover amazing restaurants and book your perfect table in seconds.
          </p>
          <Button
            asChild
            size="lg"
            className="mt-8 rounded-full bg-white px-10 text-slate-900 shadow-lg hover:bg-slate-100 hover:shadow-xl transition-all"
          >
            <Link href="/">
              <Plus className="mr-2 h-5 w-5" />
              Find a Table
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  const bookingDate = new Date(booking.startIso);
  const isToday = isSameDay(bookingDate, new Date());
  const isTomorrow = isSameDay(bookingDate, addDays(new Date(), 1));
  const dateLabel = isToday ? 'Today' : isTomorrow ? 'Tomorrow' : formatReservationDateFromDate(bookingDate, { timezone: booking.restaurantTimezone ?? undefined });

  return (
    <GuestCard className="group relative overflow-hidden rounded-3xl bg-white shadow-[0_20px_50px_-12px_rgba(0,0,0,0.15)] ring-1 ring-slate-900/5">
      {/* Ticket Design */}
      <div className="grid md:grid-cols-[1fr_240px]">
        {/* Main Content */}
        <div className="relative p-6 sm:p-8 lg:p-10">
          {/* Status Badge */}
          <div className="mb-6 flex items-center gap-3">
            <Badge
              variant="secondary"
              className={cn(
                "rounded-full px-4 py-1.5 text-sm font-semibold",
                isToday
                  ? "bg-gradient-to-r from-emerald-500 to-emerald-600 text-white"
                  : "bg-blue-50 text-blue-700"
              )}
            >
              {isToday ? (
                <>
                  <Clock className="mr-1.5 h-3.5 w-3.5" />
                  Happening Today
                </>
              ) : (
                'Upcoming Reservation'
              )}
            </Badge>
          </div>

          {/* Restaurant Info */}
          <div className="space-y-3">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              {booking.restaurantName}
            </h2>
            <div className="flex items-center gap-2 text-slate-500">
              <MapPin className="h-4 w-4" />
              <span>View location on map</span>
            </div>
          </div>

          {/* Booking Details Grid */}
          <div className="mt-8 flex flex-wrap gap-6 sm:gap-10">
            <DetailItem label="Date" value={dateLabel} />
            <DetailItem
              label="Time"
              value={formatReservationTimeFromDate(bookingDate, { timezone: booking.restaurantTimezone ?? undefined })}
            />
            <DetailItem label="Guests" value={`${booking.partySize} ${booking.partySize === 1 ? 'Guest' : 'Guests'}`} />
          </div>

          {/* Action Buttons */}
          <div className="mt-10 flex flex-wrap gap-3">
            <Button asChild className="rounded-full bg-slate-900 px-8 shadow-lg hover:bg-slate-800 hover:shadow-xl transition-all">
              <Link href={`/guest/bookings/${booking.id}`}>
                View Details
                <ChevronRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
            <ShareButton booking={booking} toast={toast} />
            <DirectionsButton booking={booking} />
          </div>
        </div>

        {/* QR Code Side Panel */}
        <div className="relative hidden border-l border-dashed border-slate-200 bg-gradient-to-br from-slate-50 to-slate-100/50 md:block">
          {/* Ticket Cutouts */}
          <div className="absolute -left-3 top-0 h-6 w-6 rounded-full bg-white shadow-inner" />
          <div className="absolute -left-3 bottom-0 h-6 w-6 rounded-full bg-white shadow-inner" />

          <div className="flex h-full flex-col items-center justify-center p-8 text-center">
            <QRCodeDialog booking={booking}>
              <button className="group/qr relative overflow-hidden rounded-2xl bg-white p-4 shadow-md transition-all hover:shadow-lg hover:scale-105">
                <div className="h-32 w-32 flex items-center justify-center">
                  <QrCode className="h-full w-full text-slate-900 transition-opacity group-hover/qr:opacity-80" />
                </div>
              </button>
            </QRCodeDialog>
            <div className="mt-6 space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Confirmation</p>
              <p className="font-mono text-xl font-bold text-slate-900">{booking.id.slice(0, 8).toUpperCase()}</p>
            </div>
          </div>
        </div>
      </div>
    </GuestCard>
  );
}

/* ============================================================================
   SUPPORTING COMPONENTS
   ============================================================================ */

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="text-xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function QuickActionCard({
  icon: Icon,
  label,
  description,
  href,
  gradient
}: {
  icon: React.ElementType;
  label: string;
  description: string;
  href: string;
  gradient: string;
}) {
  return (
    <Link
      href={href}
      className="group relative overflow-hidden rounded-2xl border border-slate-100 bg-white p-5 shadow-sm transition-all hover:-translate-y-1 hover:shadow-xl hover:border-slate-200"
    >
      <div className={cn(
        "mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-lg transition-transform group-hover:scale-110",
        gradient
      )}>
        <Icon className="h-6 w-6" />
      </div>
      <h3 className="font-semibold text-slate-900">{label}</h3>
      <p className="mt-0.5 text-sm text-slate-500">{description}</p>
      <ChevronRight className="absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-300 opacity-0 transition-all group-hover:opacity-100 group-hover:translate-x-1" />
    </Link>
  );
}

function UpcomingBookingRow({ booking, style }: { booking: BookingDTO; style?: React.CSSProperties }) {
  const bookingDate = new Date(booking.startIso);

  return (
    <Link
      href={`/guest/bookings/${booking.id}`}
      className="group flex items-center gap-4 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm transition-all hover:border-slate-200 hover:shadow-md animate-fade-up"
      style={style}
    >
      {/* Date Box */}
      <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-gradient-to-br from-blue-50 to-blue-100 text-blue-700">
        <span className="text-xs font-semibold uppercase">
          {bookingDate.toLocaleString('en-US', { month: 'short' })}
        </span>
        <span className="text-xl font-bold leading-none">
          {bookingDate.getDate()}
        </span>
      </div>

      {/* Details */}
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-slate-900 truncate">{booking.restaurantName}</p>
        <div className="mt-0.5 flex items-center gap-2 text-sm text-slate-500">
          <Clock className="h-3.5 w-3.5" />
          <span>{formatReservationTimeFromDate(bookingDate, { timezone: booking.restaurantTimezone ?? undefined })}</span>
          <span className="text-slate-300">•</span>
          <Users className="h-3.5 w-3.5" />
          <span>{booking.partySize} guests</span>
        </div>
      </div>

      <ChevronRight className="h-5 w-5 shrink-0 text-slate-300 transition-transform group-hover:translate-x-1 group-hover:text-slate-500" />
    </Link>
  );
}

function FavoriteRow({ favorite }: { favorite: FavoriteRestaurant }) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm transition-all hover:border-slate-200 hover:shadow-md">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-rose-50 to-rose-100 text-rose-500">
        <Heart className="h-5 w-5 fill-current" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-slate-900 truncate">{favorite.name}</p>
        <p className="text-sm text-slate-500">{favorite.count} {favorite.count === 1 ? 'visit' : 'visits'}</p>
      </div>
      <Button variant="outline" size="sm" className="shrink-0 rounded-full border-slate-200 hover:bg-slate-50">
        Book
      </Button>
    </div>
  );
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

function ShareButton({ booking, toast }: { booking: BookingDTO; toast: ReturnType<typeof useToast>['toast'] }) {
  const handleShare = () => {
    const url = `${window.location.origin}/guest/bookings/${booking.id}`;
    const text = `Join me at ${booking.restaurantName}`;

    if (navigator.share) {
      navigator.share({ title: 'Dinner plans', text, url }).catch(() => { });
    } else {
      navigator.clipboard.writeText(`${text} ${url}`).then(() => {
        toast({ title: 'Link copied to clipboard' });
      });
    }
  };

  return (
    <Button variant="outline" className="rounded-full border-slate-200" onClick={handleShare}>
      <Share2 className="mr-2 h-4 w-4" />
      Share
    </Button>
  );
}

function DirectionsButton({ booking }: { booking: BookingDTO }) {
  const href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(booking.restaurantName)}`;
  return (
    <Button variant="outline" asChild className="rounded-full border-slate-200">
      <a href={href} target="_blank" rel="noreferrer">
        <MapPin className="mr-2 h-4 w-4" />
        Directions
      </a>
    </Button>
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

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

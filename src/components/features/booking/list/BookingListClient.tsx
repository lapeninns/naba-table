'use client';

import { useQueryClient } from '@tanstack/react-query';
import {
  ArrowRight,
  Calendar,
  Clock,
  MapPin,
  MoreHorizontal,
  Plus,
  Search,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { GuestEmpty, GuestError } from '@/components/guest/ui';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useGuestBookings } from '@/guest/hooks';
import { normalizeBookingsTab, type BookingsTab } from '@/guest/lib/validation';
import { StatusRegion } from '@/guest/routes/shared/StatusRegion';
import { queryKeys } from '@/lib/query/keys';
import { cn } from '@/lib/utils';
import { formatReservationTime } from '@reserve/shared/formatting/booking';

import type { BookingDTO } from '@/guest/services/ports';

export function BookingListClient({ initialTab = 'upcoming' }: { initialTab?: BookingsTab }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { data: bookings, isLoading, isError } = useGuestBookings({ pageSize: 50 });
  const [activeTab, setActiveTab] = useState<BookingsTab>(normalizeBookingsTab(initialTab));

  // Sync state with URL for back/forward/share
  useEffect(() => {
    const normalized = normalizeBookingsTab(searchParams.get('tab'));
    setActiveTab((prev) => (prev === normalized ? prev : normalized));
  }, [searchParams]);

  const { upcoming, past } = useMemo(() => {
    const items = bookings?.items ?? [];
    const now = Date.now();

    const upcomingItems = items.filter((booking) => {
      const bookingTime = new Date(booking.startIso).getTime();
      return bookingTime >= now && booking.status !== 'cancelled';
    });

    const pastItems = items.filter((booking) => {
      const bookingTime = new Date(booking.startIso).getTime();
      return bookingTime < now || booking.status === 'cancelled' || booking.status === 'completed';
    });

    return {
      upcoming: upcomingItems.sort(
        (a, b) => new Date(a.startIso).getTime() - new Date(b.startIso).getTime(),
      ),
      past: pastItems.sort(
        (a, b) => new Date(b.startIso).getTime() - new Date(a.startIso).getTime(),
      ),
    };
  }, [bookings?.items]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-surface-warm pb-20">
        {/* Hero skeleton */}
        <section className="border-b border-slate-100 bg-gradient-hero py-12 px-6">
          <div className="mx-auto max-w-6xl space-y-4">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-5 w-96" />
          </div>
        </section>

        {/* Tabs skeleton */}
        <div className="mx-auto max-w-6xl px-6 py-8">
          <Skeleton className="h-12 w-80 mb-8" />
          <div className="grid gap-6 md:grid-cols-2">
            <Skeleton className="h-56 rounded-xl" />
            <Skeleton className="h-56 rounded-xl" />
            <Skeleton className="h-56 rounded-xl" />
            <Skeleton className="h-56 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <StatusRegion focus live="assertive" className="min-h-screen bg-surface-warm pb-20">
        <div className="flex min-h-[60vh] items-center justify-center">
          <GuestError
            description="We couldn't load your bookings. Please try again."
            onRetry={() => queryClient.invalidateQueries({ queryKey: queryKeys.bookings.all })}
          />
        </div>
      </StatusRegion>
    );
  }

  const hasAnyBookings = (bookings?.items?.length ?? 0) > 0;

  if (!hasAnyBookings) {
    return (
      <StatusRegion live="polite" className="min-h-screen bg-surface-warm pb-20">
        <GuestEmpty
          icon={Search}
          title="No bookings yet"
          description="Discover amazing restaurants and book your first table."
          actionLabel="Find a restaurant"
          actionHref="/restaurants"
        />
      </StatusRegion>
    );
  }

  return (
    <div className="min-h-screen bg-surface-warm pb-20">
      {/* Hero Section */}
      <section className="border-b border-slate-100 bg-gradient-hero">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 py-12 px-5 sm:gap-6 sm:px-8 sm:py-16 lg:px-10 lg:py-20">
          <div className="space-y-2 sm:space-y-3 animate-fade-in-up">
            <p className="text-xs uppercase tracking-[0.2em] text-subtle">My Reservations</p>
            <h1 className="heading-hero">
              Your Trips
            </h1>
            <p className="text-body-warm max-w-2xl">
              Manage your upcoming and past reservations
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button
              asChild
              size="lg"
              className="rounded-full bg-primary text-white hover:bg-primary/90 min-h-[48px] w-full sm:w-auto btn-tactile focus-ring touch-feedback"
            >
              <Link href="/restaurants">
                <Plus className="mr-2 h-5 w-5" />
                New Booking
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <div className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8 sm:py-12 lg:px-10">
        <Tabs
          value={activeTab}
          onValueChange={(v) => {
            const next = normalizeBookingsTab(v);
            setActiveTab(next);
            const params = new URLSearchParams(searchParams.toString());
            params.set('tab', next === 'past' ? 'history' : 'upcoming');
            const search = params.toString();
            router.replace(`${pathname}?${search}`);
          }}
          className="w-full"
        >
          <TabsList className="w-full justify-start gap-1 border-b border-slate-200 bg-transparent p-0 mb-8 sm:mb-10 lg:mb-12 h-auto rounded-none overflow-x-auto flex-nowrap scrollbar-hide">
            <TabsTrigger
              value="upcoming"
              className={cn(
                'relative rounded-none border-b-2 border-transparent bg-transparent px-4 py-3 sm:px-6 text-sm sm:text-base font-semibold transition-colors min-h-[44px] whitespace-nowrap',
                'data-[state=active]:border-blue-600 data-[state=active]:text-slate-900 data-[state=active]:shadow-none',
                'text-slate-500 hover:text-slate-700',
              )}
            >
              Upcoming
              <Badge variant="metric" className="ml-2">
                {upcoming.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger
              value="past"
              className={cn(
                'relative rounded-none border-b-2 border-transparent bg-transparent px-4 py-3 sm:px-6 text-sm sm:text-base font-semibold transition-colors min-h-[44px] whitespace-nowrap',
                'data-[state=active]:border-blue-600 data-[state=active]:text-slate-900 data-[state=active]:shadow-none',
                'text-slate-500 hover:text-slate-700',
              )}
            >
              Past
              <Badge
                variant="secondary"
                className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500"
              >
                {past.length}
              </Badge>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upcoming" className="mt-0">
            {upcoming.length === 0 ? (
              <Card className="p-12 bg-surface-elevated text-center">
                <Calendar className="h-12 w-12 mx-auto mb-4 text-slate-400" />
                <h3 className="heading-subsection mb-2">No upcoming trips</h3>
                <p className="text-sm text-subtle mb-6">Time to plan your next dining adventure.</p>
                <Button
                  asChild
                  className="rounded-full min-h-[44px] btn-tactile focus-ring touch-feedback"
                >
                  <Link href="/restaurants">Find a restaurant</Link>
                </Button>
              </Card>
            ) : (
              <div className="grid gap-4 sm:gap-6 md:grid-cols-2 stagger-container">
                {upcoming.map((booking, index) => (
                  <BookingCard
                    key={booking.id}
                    booking={booking}
                    style={{ animationDelay: `${index * 80}ms` }}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="past" className="mt-0">
            {past.length === 0 ? (
              <Card className="p-12 bg-surface-elevated text-center">
                <Calendar className="h-12 w-12 mx-auto mb-4 text-slate-400" />
                <h3 className="heading-subsection mb-2">No past trips</h3>
                <p className="text-sm text-subtle">Your completed reservations will appear here.</p>
              </Card>
            ) : (
              <div className="grid gap-4 sm:gap-6 md:grid-cols-2 stagger-container">
                {past.map((booking, index) => (
                  <BookingCard
                    key={booking.id}
                    booking={booking}
                    isPast
                    style={{ animationDelay: `${index * 80}ms` }}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

/* ============================================================================
   BOOKING CARD COMPONENT
   ============================================================================ */

type BookingCardProps = {
  booking: BookingDTO;
  isPast?: boolean;
  style?: React.CSSProperties;
};

function BookingCard({ booking, isPast = false, style }: BookingCardProps) {
  const bookingDate = new Date(booking.startIso);
  const timePortion = booking.startIso.split('T')[1]?.substring(0, 5) || '';
  const formattedTime = formatReservationTime(timePortion);

  return (
    <Card
      variant="interactive"
      className={cn(
        'overflow-hidden transition-all touch-feedback',
        isPast && 'opacity-75 hover:opacity-100',
      )}
      style={style}
    >
      <div className="p-5 sm:p-6 lg:p-8">
        {/* Card Header with Restaurant Name */}
        <div className="flex items-start justify-between gap-4 sm:gap-5 mb-5 sm:mb-6 lg:mb-8">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3 mb-1">
              <h3 className="heading-subsection truncate">
                {booking.restaurantName}
              </h3>
              <StatusBadge status={booking.status} isPast={isPast} />
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <MapPin className="h-3.5 w-3.5" />
              <span className="truncate">Main Dining Room</span>
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 -mr-2 text-slate-400 hover:text-slate-900 focus-ring"
              >
                <MoreHorizontal className="h-5 w-5" />
                <span className="sr-only">Open menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 rounded-xl p-2">
              <DropdownMenuItem asChild className="rounded-lg cursor-pointer">
                <Link href={`/guest/bookings/${booking.id}`} className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  View Details
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild className="rounded-lg cursor-pointer">
                <Link
                  href={`/restaurants/${booking.restaurantSlug || '#'}`}
                  className="flex items-center gap-2"
                >
                  <MapPin className="h-4 w-4" />
                  View Restaurant
                </Link>
              </DropdownMenuItem>
              {!isPast && booking.status !== 'cancelled' && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    asChild
                    className="text-red-600 focus:text-red-600 focus:bg-red-50 rounded-lg cursor-pointer"
                  >
                    <Link href={`/guest/bookings/${booking.id}?intent=cancel`}>Cancel Booking</Link>
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Booking Details */}
        <div className="flex items-center gap-4 sm:gap-5 mb-4 sm:mb-6">
          {/* Date Box */}
          <div
            className={cn(
              'flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-xl border text-center transition-colors',
              isPast
                ? 'border-slate-200 bg-slate-100 text-slate-500'
                : 'border-blue-100 bg-blue-50 text-blue-700',
            )}
          >
            <span className="text-xs font-bold uppercase leading-none mb-1">
              {bookingDate.toLocaleString('en-US', { month: 'short' })}
            </span>
            <span className="text-2xl font-bold leading-none">{bookingDate.getDate()}</span>
          </div>

          {/* Time and Party Details */}
          <div className="flex-1 space-y-1.5">
            <div className="flex items-center gap-2.5 text-slate-700">
              <Clock className="h-4 w-4 text-slate-400" />
              <span className="font-semibold">{formattedTime}</span>
            </div>
            <div className="flex items-center gap-2.5 text-slate-700">
              <Users className="h-4 w-4 text-slate-400" />
              <span>
                {booking.partySize} {booking.partySize === 1 ? 'guest' : 'guests'}
              </span>
            </div>
          </div>
        </div>

        {/* Footer Link */}
        <Link
          href={`/guest/bookings/${booking.id}`}
          className="flex items-center justify-between -mx-5 -mb-5 px-5 py-4 sm:-mx-6 sm:-mb-6 sm:px-6 sm:py-5 lg:-mx-8 lg:-mb-8 lg:px-8 lg:py-6 text-sm font-medium text-slate-500 hover:text-blue-600 hover:bg-slate-50 transition-colors border-t border-slate-100 group focus-ring touch-feedback"
        >
          <span>View reservation details</span>
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
        </Link>
      </div>
    </Card>
  );
}

/* ============================================================================
   SUPPORTING COMPONENTS
   ============================================================================ */

type StatusBadgeProps = {
  status: BookingDTO['status'];
  isPast?: boolean;
};

function StatusBadge({ status, isPast = false }: StatusBadgeProps) {
  const labels: Record<string, string> = {
    confirmed: 'Confirmed',
    pending: 'Pending',
    pending_allocation: 'Pending',
    cancelled: 'Cancelled',
    completed: 'Completed',
    checked_in: 'Live',
    no_show: 'No Show',
    PRIORITY_WAITLIST: 'Waitlist',
  };

  const label = labels[status] ?? (isPast ? 'Past' : status);

  // Use our new Badge variants
  if (isPast || status === 'completed') {
    return (
      <Badge variant="status-completed" className="text-[10px] uppercase tracking-wider">
        {label}
      </Badge>
    );
  }
  if (status === 'cancelled' || status === 'no_show') {
    return (
      <Badge variant="status-cancelled" className="text-[10px] uppercase tracking-wider">
        {label}
      </Badge>
    );
  }
  if (status === 'confirmed' || status === 'checked_in') {
    return (
      <Badge variant="status-confirmed" className="text-[10px] uppercase tracking-wider">
        {label}
      </Badge>
    );
  }
  if (status === 'pending' || status === 'pending_allocation') {
    return (
      <Badge variant="status-pending" className="text-[10px] uppercase tracking-wider">
        {label}
      </Badge>
    );
  }

  // Default fallback
  return (
    <Badge
      variant="secondary"
      className="rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider font-bold border border-slate-200 bg-slate-50 text-slate-600"
    >
      {label}
    </Badge>
  );
}

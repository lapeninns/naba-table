'use client';

import { useQueryClient } from '@tanstack/react-query';
import {
  ArrowRight,
  Calendar,
  ChevronRight,
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

import { GuestEmptyState } from '@/components/guest/shared/GuestEmptyState';
import { GuestErrorState } from '@/components/guest/shared/GuestErrorState';
import { GuestCard, GuestSection } from '@/components/guest/ui';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
    const tabParam = searchParams.get('tab');
    const normalized = normalizeBookingsTab(tabParam);
    if (normalized !== activeTab) {
      setActiveTab(normalized);
    }
  }, [activeTab, searchParams]);

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
      upcoming: upcomingItems.sort((a, b) => new Date(a.startIso).getTime() - new Date(b.startIso).getTime()),
      past: pastItems.sort((a, b) => new Date(b.startIso).getTime() - new Date(a.startIso).getTime()),
    };
  }, [bookings?.items]);

  if (isLoading) {
    return (
      <div className="min-h-screen pb-20">
        <div className="space-y-6 mb-10">
          <Skeleton className="h-12 w-48" />
          <Skeleton className="h-6 w-72" />
        </div>
        <Skeleton className="h-12 w-64 mb-8" />
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-48 rounded-2xl" />
          <Skeleton className="h-48 rounded-2xl" />
          <Skeleton className="h-48 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <StatusRegion focus live="assertive" className="min-h-screen pb-20">
        <GuestErrorState
          description="We couldn’t load your bookings. Please try again."
          onRetry={() => queryClient.invalidateQueries({ queryKey: queryKeys.bookings.all })}
        />
      </StatusRegion>
    );
  }

  const hasAnyBookings = (bookings?.items?.length ?? 0) > 0;

  if (!hasAnyBookings) {
    return (
      <StatusRegion live="polite" className="min-h-screen pb-20">
        <GuestEmptyState
          title="No bookings yet"
          description="Discover amazing restaurants and book your first table."
          ctaLabel="Find a restaurant"
          ctaHref="/restaurants"
          icon={Search}
        />
      </StatusRegion>
    );
  }

  return (
    <div className="min-h-screen pb-20">
      <GuestSection
        title="Your Trips"
        description="Manage your upcoming and past reservations"
        actions={
          <Button asChild size="lg" className="rounded-full shadow-lg">
            <Link href="/restaurants">
              <Plus className="mr-2 h-5 w-5" />
              New Booking
            </Link>
          </Button>
        }
        className="bg-white"
      >
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
          <TabsList className="w-full justify-start gap-1 border-b border-slate-100 bg-transparent p-0 mb-8">
            <TabsTrigger
              value="upcoming"
              className={cn(
                "relative rounded-none border-b-2 border-transparent bg-transparent px-6 py-4 text-base font-medium transition-colors",
                "data-[state=active]:border-slate-900 data-[state=active]:text-slate-900 data-[state=active]:shadow-none",
                "text-slate-500 hover:text-slate-700"
              )}
            >
              Upcoming
              <Badge variant="secondary" className="ml-2 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">
                {upcoming.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger
              value="past"
              className={cn(
                "relative rounded-none border-b-2 border-transparent bg-transparent px-6 py-4 text-base font-medium transition-colors",
                "data-[state=active]:border-slate-900 data-[state=active]:text-slate-900 data-[state=active]:shadow-none",
                "text-slate-500 hover:text-slate-700"
              )}
            >
              Past
              <Badge variant="secondary" className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">
                {past.length}
              </Badge>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upcoming" className="mt-0">
            {upcoming.length === 0 ? (
              <EmptyTabState
                icon={Calendar}
                title="No upcoming trips"
                description="Time to plan your next dining adventure."
                actionLabel="Find a restaurant"
                actionHref="/restaurants"
              />
            ) : (
              <div className="grid gap-5 md:grid-cols-2 guest-stagger">
                {upcoming.map((booking, index) => (
                  <BookingCard
                    key={booking.id}
                    booking={booking}
                    style={{ animationDelay: `${index * 50}ms` }}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="past" className="mt-0">
            {past.length === 0 ? (
              <EmptyTabState
                icon={Calendar}
                title="No past trips"
                description="Your completed reservations will appear here."
              />
            ) : (
              <div className="grid gap-5 md:grid-cols-2 guest-stagger">
                {past.map((booking, index) => (
                  <BookingCard
                    key={booking.id}
                    booking={booking}
                    isPast
                    style={{ animationDelay: `${index * 50}ms` }}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </GuestSection>
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
    <GuestCard
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm transition-all animate-fade-up",
        "hover:border-slate-200 hover:shadow-xl hover:-translate-y-1",
        isPast && "opacity-80 hover:opacity-100"
      )}
      style={style}
      footer={
        <Link
          href={`/guest/bookings/${booking.id}`}
          className="flex items-center justify-between border-t border-slate-50 bg-gradient-to-r from-slate-50 to-white px-6 py-4 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900"
        >
          <span>View reservation details</span>
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
        </Link>
      }
    >
      {/* Card Header with Restaurant Name */}
      <div className="border-b border-slate-50 bg-gradient-to-r from-slate-50 to-white px-6 py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h3 className="text-lg font-bold text-slate-900 truncate">
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
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-slate-400 hover:text-slate-900">
                <MoreHorizontal className="h-5 w-5" />
                <span className="sr-only">Open menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 rounded-xl">
              <DropdownMenuItem asChild>
                <Link href={`/guest/bookings/${booking.id}`} className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  View Details
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={`/restaurants/${booking.restaurantSlug || '#'}`} className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  View Restaurant
                </Link>
              </DropdownMenuItem>
              {!isPast && booking.status !== 'cancelled' && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild className="text-red-600 focus:text-red-600 focus:bg-red-50">
                    <Link href={`/guest/bookings/${booking.id}?intent=cancel`}>
                      Cancel Booking
                    </Link>
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Booking Details */}
      <div className="p-6">
        <div className="flex items-center gap-4">
          {/* Date Box */}
          <div className={cn(
            "flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-xl border text-center",
            isPast
              ? "border-slate-100 bg-slate-50 text-slate-400"
              : "border-blue-100 bg-gradient-to-br from-blue-50 to-blue-100 text-blue-700 shadow-sm"
          )}>
            <span className="text-xs font-bold uppercase leading-none">
              {bookingDate.toLocaleString('en-US', { month: 'short' })}
            </span>
            <span className="text-2xl font-bold leading-tight">
              {bookingDate.getDate()}
            </span>
          </div>

          {/* Time and Party Details */}
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2 text-slate-600">
              <Clock className="h-4 w-4" />
              <span className="font-medium">{formattedTime}</span>
            </div>
            <div className="flex items-center gap-2 text-slate-600">
              <Users className="h-4 w-4" />
              <span>{booking.partySize} {booking.partySize === 1 ? 'guest' : 'guests'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Card Footer */}
    </GuestCard>
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

  const getStyles = () => {
    if (isPast || status === 'completed') {
      return 'bg-slate-100 text-slate-600';
    }
    if (status === 'cancelled') {
      return 'bg-red-50 text-red-700';
    }
    if (status === 'confirmed' || status === 'checked_in') {
      return 'bg-emerald-50 text-emerald-700';
    }
    if (status === 'pending' || status === 'pending_allocation') {
      return 'bg-amber-50 text-amber-700';
    }
    return 'bg-slate-100 text-slate-700';
  };

  return (
    <Badge
      variant="secondary"
      className={cn(
        "rounded-full px-2.5 py-0.5 text-xs font-semibold border-0",
        getStyles()
      )}
    >
      {label}
    </Badge>
  );
}

function EmptyTabState({
  icon: Icon,
  title,
  description,
  actionLabel,
  actionHref
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
}) {
  return (
    <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-gradient-to-b from-slate-50/80 to-white py-16 sm:py-20 text-center">
      <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-slate-100">
        <Icon className="h-7 w-7 text-slate-400" />
      </div>
      <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
      <p className="mx-auto mt-2 max-w-sm text-sm text-slate-500">{description}</p>
      {actionLabel && actionHref && (
        <Button variant="link" asChild className="mt-5 text-slate-900 font-medium">
          <Link href={actionHref}>
            {actionLabel}
            <ChevronRight className="ml-1 h-4 w-4" />
          </Link>
        </Button>
      )}
    </div>
  );
}

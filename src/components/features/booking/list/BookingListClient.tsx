'use client';

import { CalendarClock, CalendarX, MapPin, Users, MoreHorizontal, ArrowRight, Clock, Calendar } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useBookings } from '@/hooks/useBookings';
import { formatReservationDate, formatReservationTime } from '@reserve/shared/formatting/booking';
import { DEFAULT_RESTAURANT_SLUG } from '@shared/config/venue';

import type { BookingDTO } from '@/hooks/useBookings';

export function BookingListClient() {
  const router = useRouter();
  const { data: bookings, isLoading, isError } = useBookings({ pageSize: 50 });
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming');

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
      <div className="mx-auto w-full max-w-[80vw] space-y-8 py-8">
        <div className="flex items-center justify-between">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <Skeleton className="h-12 w-full max-w-md" />
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-64 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="mx-auto w-full max-w-[80vw] py-16 text-center">
        <div className="mx-auto mb-6 inline-flex h-20 w-20 items-center justify-center rounded-full bg-destructive/10">
          <CalendarX className="h-10 w-10 text-destructive" aria-hidden="true" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Something went wrong</h1>
        <p className="mt-3 text-lg text-muted-foreground">
          We couldn&apos;t load your bookings. Please check your connection and try again.
        </p>
        <Button variant="outline" onClick={() => router.refresh()} className="mt-8">
          Retry
        </Button>
      </div>
    );
  }

  const bookingPath = DEFAULT_RESTAURANT_SLUG ? `/restaurants/${DEFAULT_RESTAURANT_SLUG}/book` : '/restaurants';

  const hasAnyBookings = (bookings?.items?.length ?? 0) > 0;

  if (!hasAnyBookings) {
    return (
      <div className="mx-auto w-full max-w-[80vw] py-24 text-center">
        <div className="mx-auto mb-6 inline-flex h-24 w-24 items-center justify-center rounded-full bg-primary/5">
          <CalendarClock className="h-12 w-12 text-primary" aria-hidden="true" />
        </div>
        <h1 className="text-4xl font-bold tracking-tight text-foreground">
          No bookings yet
        </h1>
        <p className="mx-auto mt-4 max-w-lg text-lg text-muted-foreground">
          You don&apos;t have any reservations. Browse our partner restaurants to find your next table.
        </p>
        <div className="mt-10">
          <Link href={bookingPath}>
            <Button size="lg" className="h-12 px-8 text-base">
              <CalendarClock className="mr-2 h-5 w-5" aria-hidden="true" />
              Find a Restaurant
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[80vw] space-y-8 py-8">
      {/* Header */}
      <header className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            My Bookings
          </h1>
          <p className="text-muted-foreground">
            Manage your upcoming and past reservations
          </p>
        </div>
        <Link href={bookingPath}>
          <Button size="lg" className="w-full shadow-sm sm:w-auto">
            <CalendarClock className="mr-2 h-5 w-5" aria-hidden="true" />
            New Booking
          </Button>
        </Link>
      </header>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'upcoming' | 'past')} className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="upcoming">Upcoming ({upcoming.length})</TabsTrigger>
          <TabsTrigger value="past">Past ({past.length})</TabsTrigger>
        </TabsList>

        {/* Upcoming Tab */}
        <TabsContent value="upcoming" className="mt-8 space-y-6">
          {upcoming.length === 0 ? (
            <Card className="border-dashed bg-muted/30">
              <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
                <div className="rounded-full bg-background p-4 shadow-sm">
                  <CalendarClock className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
                </div>
                <div className="space-y-1">
                  <p className="text-xl font-semibold text-foreground">No upcoming bookings</p>
                  <p className="text-muted-foreground">
                    Ready to eat? Book a table now.
                  </p>
                </div>
                <Link href={`/restaurants/${DEFAULT_RESTAURANT_SLUG}/book`}>
                  <Button variant="outline" className="mt-2">Browse Restaurants</Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-6 md:grid-cols-2">
              {upcoming.map((booking) => (
                <BookingCard key={booking.id} booking={booking} />
              ))}
            </div>
          )}
        </TabsContent>

        {/* Past Tab */}
        <TabsContent value="past" className="mt-8 space-y-6">
          {past.length === 0 ? (
            <Card className="border-dashed bg-muted/30">
              <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
                <div className="rounded-full bg-background p-4 shadow-sm">
                  <CalendarX className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
                </div>
                <div className="space-y-1">
                  <p className="text-xl font-semibold text-foreground">No past bookings</p>
                  <p className="text-muted-foreground">
                    Your dining history will appear here.
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-6 md:grid-cols-2">
              {past.map((booking) => (
                <BookingCard key={booking.id} booking={booking} isPast />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

type BookingCardProps = {
  booking: BookingDTO;
  isPast?: boolean;
};

function BookingCard({ booking, isPast = false }: BookingCardProps) {
  // Extract date portion (YYYY-MM-DD) from startIso (YYYY-MM-DDTHH:mm:ss)
  const datePortion = booking.startIso.split('T')[0];
  // Extract time portion (HH:mm) from startIso
  const timePortion = booking.startIso.split('T')[1]?.substring(0, 5) || '';

  const formattedDate = formatReservationDate(datePortion);
  const formattedTime = formatReservationTime(timePortion);

  return (
    <Card className="group relative flex flex-col overflow-hidden transition-all hover:shadow-md">
      <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-primary/80 to-primary" />

      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3 pt-6">
        <div className="space-y-1">
          <CardTitle className="line-clamp-1 text-xl font-bold">
            <Link href={`/bookings/${booking.id}`} className="hover:underline hover:decoration-primary/50 hover:underline-offset-4">
              {booking.restaurantName}
            </Link>
          </CardTitle>
          <StatusBadge status={booking.status} isPast={isPast} />
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="-mr-2 h-8 w-8 text-muted-foreground hover:text-foreground">
              <MoreHorizontal className="h-4 w-4" />
              <span className="sr-only">Open menu</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuItem asChild>
              <Link href={`/bookings/${booking.id}`}>View details</Link>
            </DropdownMenuItem>
            {!isPast && booking.status !== 'cancelled' && (
              <>
                <DropdownMenuItem asChild>
                  <Link href={`/bookings/${booking.id}`}>Modify booking</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild className="text-destructive focus:text-destructive">
                  <Link href={`/bookings/${booking.id}?intent=cancel`}>Cancel booking</Link>
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>

      <CardContent className="flex-1 space-y-4 pb-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="flex flex-col gap-1">
            <span className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="h-4 w-4" /> Date
            </span>
            <span className="font-medium">{formattedDate}</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="flex items-center gap-2 text-muted-foreground">
              <Clock className="h-4 w-4" /> Time
            </span>
            <span className="font-medium">{formattedTime}</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="flex items-center gap-2 text-muted-foreground">
              <Users className="h-4 w-4" /> Guests
            </span>
            <span className="font-medium">
              {booking.partySize} {booking.partySize === 1 ? 'person' : 'people'}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="h-4 w-4" /> Location
            </span>
            <span className="truncate font-medium">
              {booking.restaurantSlug ? 'View map' : 'Main Dining'}
            </span>
          </div>
        </div>
      </CardContent>

      <CardFooter className="border-t bg-muted/10 p-4">
        <Link href={`/bookings/${booking.id}`} className="flex w-full items-center justify-between text-sm font-medium text-primary hover:underline">
          <span>Manage reservation</span>
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
        </Link>
      </CardFooter>
    </Card>
  );
}

type StatusBadgeProps = {
  status: BookingDTO['status'];
  isPast?: boolean;
};

function StatusBadge({ status, isPast = false }: StatusBadgeProps) {
  const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    confirmed: 'default',
    pending: 'secondary',
    pending_allocation: 'secondary',
    cancelled: 'destructive',
    completed: 'outline',
    checked_in: 'default',
    no_show: 'destructive',
    PRIORITY_WAITLIST: 'secondary',
  };

  const labels: Record<string, string> = {
    confirmed: 'Confirmed',
    pending: 'Pending',
    pending_allocation: 'Pending',
    cancelled: 'Cancelled',
    completed: 'Completed',
    checked_in: 'Checked In',
    no_show: 'No Show',
    PRIORITY_WAITLIST: 'Waitlist',
  };

  const variant = variants[status] ?? (isPast ? 'outline' : 'secondary');
  const label = labels[status] ?? (isPast ? 'Past' : status);

  // Custom styling for specific statuses
  const className = status === 'confirmed'
    ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100/80 border-emerald-200'
    : status === 'cancelled'
      ? 'bg-red-100 text-red-700 hover:bg-red-100/80 border-red-200'
      : undefined;

  return <Badge variant={variant} className={className}>{label}</Badge>;
}

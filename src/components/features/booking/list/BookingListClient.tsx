'use client';

import Link from 'next/link';
// import { useMemo } from 'react'; // Removed unused import

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useBookings } from '@/hooks/useBookings';
import { formatReservationDate, formatReservationTime } from '@reserve/shared/formatting/booking';
import { normalizeTime } from '@reserve/shared/time';

import type { BookingDTO } from '@/hooks/useBookings';

export function BookingListClient() {
  // const router = useRouter(); // Removed unused router
  const { data: bookings, isLoading, isError } = useBookings();

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-4">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">My Bookings</h1>
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="mx-auto w-full max-w-3xl py-12 text-center">
        <h1 className="text-2xl font-bold text-slate-900">Something went wrong</h1>
        <p className="mt-2 text-slate-600">We couldn’t load your bookings. Please try again.</p>
        <Button variant="outline" onClick={() => window.location.reload()} className="mt-4">
          Retry
        </Button>
      </div>
    );
  }

  const items = bookings?.items ?? [];

  if (!items || items.length === 0) {
    return (
      <div className="mx-auto w-full max-w-3xl py-16 text-center">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">No upcoming bookings</h1>
        <p className="mt-2 max-w-md mx-auto text-slate-600">
          You don’t have any active reservations. Browse our partner restaurants to find your next table.
        </p>
        <div className="mt-8">
          <Link href="/restaurants">
            <Button size="lg">Find a restaurant</Button>
          </Link>
        </div>
      </div>
    );
  }

  // Sort bookings: upcoming first, then by date ascending. Past bookings could be separated if needed.
  const sortedBookings = [...items].sort((a, b) => {
    const dateA = new Date(a.startIso).getTime();
    const dateB = new Date(b.startIso).getTime();
    return dateA - dateB;
  });

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">My Bookings</h1>
        <Link href="/restaurants">
          <Button variant="outline">New Booking</Button>
        </Link>
      </header>

      <ul className="space-y-4">
        {sortedBookings.map((booking) => (
          <li key={booking.id}>
            <Link href={`/bookings/${booking.id}`} className="block group">
              <Card className="transition-colors group-hover:border-primary/50">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle className="text-lg font-semibold group-hover:text-primary transition-colors">
                        {booking.restaurantName}
                      </CardTitle>
                      <CardDescription>
                        {formatReservationDate(booking.startIso)} at{' '}
                        {formatReservationTime(normalizeTime(booking.startIso) ?? booking.startIso)}
                      </CardDescription>
                    </div>
                    <StatusBadge status={booking.status} />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4 text-sm text-slate-600">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium text-slate-900">{booking.partySize}</span> guests
                    </div>
                    {booking.notes && (
                      <div className="flex items-center gap-1.5 truncate max-w-[200px]">
                        <span className="sr-only">Note:</span>
                        <span className="truncate italic">{booking.notes}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function StatusBadge({ status }: { status: BookingDTO['status'] }) {
  const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    confirmed: 'default',
    pending: 'secondary',
    cancelled: 'destructive',
    completed: 'outline',
  };

  const labels: Record<string, string> = {
    confirmed: 'Confirmed',
    pending: 'Pending',
    cancelled: 'Cancelled',
    completed: 'Past',
  };

  return <Badge variant={variants[status] ?? 'outline'}>{labels[status] ?? status}</Badge>;
}
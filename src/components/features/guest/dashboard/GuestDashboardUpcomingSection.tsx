import { ChevronRight, Clock } from 'lucide-react';
import Link from 'next/link';

import { GuestPanel } from '@/components/guest/ui';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/typography';

import { buildGuestDashboardUpcomingBookingDisplay } from './booking-derivations';

import type { BookingDTO } from '@/guest/services/ports';

export function GuestDashboardUpcomingSection({
  isLoading,
  upcomingList,
}: {
  isLoading: boolean;
  upcomingList: BookingDTO[];
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
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
          <p className="text-sm font-semibold text-foreground">No other upcoming reservations</p>
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
  );
}

function UpcomingSkeletonGrid() {
  return (
    <div className="grid gap-3">
      {[0, 1, 2].map((item) => (
        <GuestPanel key={item} className="p-4">
          <div className="flex items-center gap-4">
            <Skeleton className="size-14 rounded-2xl" />
            <div className="flex flex-1 flex-col gap-2">
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
  const { dayLabel, monthLabel, partyLabel, timeLabel } =
    buildGuestDashboardUpcomingBookingDisplay(booking);

  return (
    <Link
      href={`/guest/bookings/${booking.id}`}
      className="pg-focus-ring block rounded-[var(--pg-radius-md)]"
    >
      <GuestPanel interactive className="pg-touch group flex items-center gap-3 p-4">
        <div className="flex size-14 shrink-0 flex-col items-center justify-center rounded-[var(--pg-radius-md)] border border-border/80 bg-background text-primary shadow-[var(--pg-shadow-xs)]">
          <span className="text-xs font-bold uppercase">{monthLabel}</span>
          <span className="text-2xl font-bold leading-none">{dayLabel}</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground sm:text-base">
            {booking.restaurantName}
          </p>
          <Text
            variant="caption"
            className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1"
          >
            <Clock className="size-3.5" aria-hidden />
            <span>{timeLabel}</span>
            <span aria-hidden>·</span>
            <span>{partyLabel}</span>
          </Text>
        </div>
        <ChevronRight
          className="size-5 text-muted-foreground transition group-hover:text-foreground"
          aria-hidden
        />
      </GuestPanel>
    </Link>
  );
}

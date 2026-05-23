import { Calendar, ChevronRight, Clock, Users } from 'lucide-react';
import Link from 'next/link';

import { GuestInsetCard, GuestPanel, GuestPrimaryButton } from '@/components/guest/ui';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

import { buildGuestDashboardFeaturedBookingDisplay } from './booking-derivations';

import type { BookingDTO } from '@/guest/services/ports';
import type { LucideIcon } from 'lucide-react';

export function GuestDashboardCurrentReservationSection({
  booking,
  isLoading,
}: {
  booking: BookingDTO | null;
  isLoading: boolean;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
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
            <ChevronRight data-icon="inline-end" aria-hidden />
          </Link>
        </Button>
      </div>
      <FeaturedBooking booking={booking} isLoading={isLoading} />
    </section>
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
          <div className="flex flex-col gap-5 p-5 sm:p-6">
            <div className="flex flex-wrap items-center gap-2">
              <Skeleton className="h-8 w-28 rounded-full" />
              <Skeleton className="h-8 w-24 rounded-full" />
            </div>
            <div className="flex flex-col gap-2">
              <Skeleton className="h-8 w-full max-w-72 rounded-xl" />
              <div className="flex flex-col gap-2">
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
          <div className="flex min-w-0 flex-col gap-2">
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

  const { dateLabel, isToday, partyLabel, statusLabel, timeLabel } =
    buildGuestDashboardFeaturedBookingDisplay({ booking });

  return (
    <GuestPanel className="overflow-hidden">
      <div className="grid lg:grid-cols-[minmax(0,1fr)_17rem]">
        <div className="flex flex-col gap-5 p-5 sm:p-6">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="guest-chip" className="pg-chip">
              {isToday ? 'Happening today' : 'Next booking'}
            </Badge>
            <Badge variant="guest-chip-outline" className="pg-chip">
              {statusLabel}
            </Badge>
          </div>
          <div className="flex flex-col gap-2">
            <h3 className="pg-card-title text-2xl">{booking.restaurantName}</h3>
            <p className="pg-body max-w-[54ch] text-sm">
              Manage this reservation, check the arrival details, or open the receipt after your
              visit.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <MiniDetail icon={Calendar} label="Date" value={dateLabel} />
            <MiniDetail icon={Clock} label="Time" value={timeLabel} />
            <MiniDetail icon={Users} label="Party" value={partyLabel} />
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

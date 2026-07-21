import { Clock, MapPin, MoreHorizontal, Users } from 'lucide-react';
import Link from 'next/link';

import { GuestContent, GuestInsetCard, GuestPageFrame, GuestPanel } from '@/components/guest/ui';
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
import { Text } from '@/components/ui/typography';
import { cn } from '@/lib/utils';

import {
  buildBookingRestaurantHref,
  formatBookingPartyLabel,
  formatBookingStatus,
  getBookingCardDisplay,
  isActiveBookingStatus,
  isDangerBookingStatus,
} from './bookingListDomain';

import type { BookingDTO } from '@/guest/services/ports';

export function BookingsLoadingState() {
  return (
    <GuestPageFrame>
      <section className="pg-hero-band pg-section-tight">
        <div className="pg-container flex flex-col gap-4">
          <Skeleton className="h-5 w-40 rounded-full" />
          <Skeleton className="h-12 w-full max-w-xl rounded-xl" />
          <Skeleton className="h-5 w-full max-w-2xl rounded-lg" />
        </div>
      </section>
      <GuestContent>
        <Skeleton className="h-12 w-72 rounded-full" />
        <div className="grid gap-4 md:grid-cols-2">
          {[0, 1, 2, 3].map((item) => (
            <Skeleton key={item} className="h-64 rounded-[var(--pg-radius-md)]" />
          ))}
        </div>
      </GuestContent>
    </GuestPageFrame>
  );
}

export function BookingGrid({
  bookings,
  isPast = false,
}: {
  bookings: BookingDTO[];
  isPast?: boolean;
}) {
  return (
    <div className="pg-stagger grid gap-4 md:grid-cols-2">
      {bookings.map((booking) => (
        <BookingCard key={booking.id} booking={booking} isPast={isPast} />
      ))}
    </div>
  );
}

function BookingCard({ booking, isPast = false }: { booking: BookingDTO; isPast?: boolean }) {
  const { monthLabel, dayLabel, timeLabel } = getBookingCardDisplay(booking);
  const restaurantHref = buildBookingRestaurantHref(booking);

  return (
    <GuestPanel
      interactive
      className={cn('overflow-hidden', isPast && 'opacity-80 hover:opacity-100')}
    >
      <div className="flex min-h-full flex-col">
        <div className="flex items-start justify-between gap-4 p-5 sm:p-6">
          <div className="flex min-w-0 flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="pg-card-title truncate">{booking.restaurantName}</h3>
              <StatusBadge status={booking.status} isPast={isPast} />
            </div>
            <Text variant="caption" className="flex items-center gap-2">
              <MapPin className="size-4 shrink-0" aria-hidden />
              <span className="truncate">{booking.restaurantSlug ?? 'Restaurant details'}</span>
            </Text>
          </div>
          <BookingCardMenu booking={booking} isPast={isPast} restaurantHref={restaurantHref} />
        </div>

        <div className="grid gap-3 px-5 pb-5 sm:grid-cols-[5rem_1fr] sm:px-6 sm:pb-6">
          <div className="flex size-20 flex-col items-center justify-center rounded-[var(--pg-radius-md)] bg-primary/10 text-primary">
            <span className="text-xs font-bold uppercase">{monthLabel}</span>
            <span className="text-3xl font-bold leading-none">{dayLabel}</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <InlineDetail icon={Clock} label="Time" value={timeLabel} />
            <InlineDetail
              icon={Users}
              label="Party"
              value={formatBookingPartyLabel(booking.partySize)}
            />
          </div>
        </div>

        <div className="mt-auto grid gap-2 border-t border-border/60 bg-muted/30 p-4 sm:grid-cols-2">
          <Button asChild className="pg-action pg-focus-ring pg-touch rounded-full">
            <Link href={`/guest/bookings/${booking.id}`}>
              {isPast ? 'Open booking' : 'Manage booking'}
            </Link>
          </Button>
          <Button
            asChild
            variant="outline"
            className="pg-action pg-focus-ring pg-touch rounded-full border-border bg-background"
          >
            <Link href={`/guest/bookings/${booking.id}/receipt`}>Receipt</Link>
          </Button>
        </div>
      </div>
    </GuestPanel>
  );
}

function BookingCardMenu({
  booking,
  isPast,
  restaurantHref,
}: {
  booking: BookingDTO;
  isPast: boolean;
  restaurantHref: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="pg-focus-ring -mr-2 size-10 rounded-full text-muted-foreground hover:text-foreground"
        >
          <MoreHorizontal className="size-5" aria-hidden />
          <span className="sr-only">Open booking menu</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-52 rounded-[var(--pg-radius-md)] border-border/80 bg-background/95 p-2 shadow-[var(--pg-shadow-popover)]"
      >
        <DropdownMenuItem asChild className="cursor-pointer rounded-lg">
          <Link href={`/guest/bookings/${booking.id}`}>View booking</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="cursor-pointer rounded-lg">
          <Link href={`/guest/bookings/${booking.id}/receipt`}>Open receipt</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="cursor-pointer rounded-lg">
          <Link href={restaurantHref}>View restaurant</Link>
        </DropdownMenuItem>
        {!isPast && booking.status !== 'cancelled' ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild className="cursor-pointer rounded-lg text-destructive">
              <Link href={`/guest/bookings/${booking.id}?intent=cancel`}>Cancel booking</Link>
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function InlineDetail({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Clock;
  label: string;
  value: string;
}) {
  return <GuestInsetCard icon={Icon} label={label} value={value} className="p-3" />;
}

function StatusBadge({
  status,
  isPast = false,
}: {
  status: BookingDTO['status'];
  isPast?: boolean;
}) {
  const label = formatBookingStatus(status, isPast);
  const danger = isDangerBookingStatus(status);
  const active = isActiveBookingStatus(status, isPast);

  return (
    <Badge
      variant={danger ? 'destructive' : 'secondary'}
      className={cn(
        'rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.12em]',
        active && 'border-primary/20 bg-primary/10 text-primary',
        isPast && !danger && 'border-border bg-muted text-muted-foreground',
      )}
    >
      {label}
    </Badge>
  );
}

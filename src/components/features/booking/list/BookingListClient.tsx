'use client';

import { useQueryClient } from '@tanstack/react-query';
import {
  Calendar,
  CalendarPlus,
  Clock,
  MapPin,
  MoreHorizontal,
  ReceiptText,
  Search,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import {
  GuestContent,
  GuestEmpty,
  GuestError,
  GuestHero,
  GuestInsetCard,
  GuestMetricCard,
  GuestPageFrame,
  GuestPanel,
  GuestPrimaryButton,
  GuestSectionHeader,
} from '@/components/guest/ui';
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
import {
  getBookingDateTimeMillis,
  parseBookingDateTime,
} from '@reserve/shared/formatting/bookingDateTime';

import type { BookingDTO } from '@/guest/services/ports';

function getBookingStartMillis(booking: BookingDTO): number {
  return getBookingDateTimeMillis(booking.startIso, booking.restaurantTimezone) ?? Number.NaN;
}

function getBookingCardDisplay(booking: BookingDTO) {
  const parsed = parseBookingDateTime(booking.startIso, booking.restaurantTimezone);
  if (!parsed) {
    return { monthLabel: 'TBC', dayLabel: '--', timeLabel: 'Time pending' };
  }
  return {
    monthLabel: parsed.setLocale('en').toFormat('MMM'),
    dayLabel: parsed.toFormat('d'),
    timeLabel: parsed.toFormat('HH:mm'),
  };
}

export function BookingListClient({ initialTab = 'upcoming' }: { initialTab?: BookingsTab }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { data: bookings, isLoading, isError } = useGuestBookings({ pageSize: 50 });
  const [activeTab, setActiveTab] = useState<BookingsTab>(normalizeBookingsTab(initialTab));

  useEffect(() => {
    const normalized = normalizeBookingsTab(searchParams.get('tab'));
    setActiveTab((prev) => (prev === normalized ? prev : normalized));
  }, [searchParams]);

  const { upcoming, past } = useMemo(() => {
    const items = bookings?.items ?? [];
    const now = Date.now();

    const upcomingItems = items.filter((booking) => {
      const bookingTime = getBookingStartMillis(booking);
      return Number.isFinite(bookingTime) && bookingTime >= now && booking.status !== 'cancelled';
    });

    const pastItems = items.filter((booking) => {
      const bookingTime = getBookingStartMillis(booking);
      return (
        (Number.isFinite(bookingTime) && bookingTime < now) ||
        booking.status === 'cancelled' ||
        booking.status === 'completed'
      );
    });

    return {
      upcoming: upcomingItems.sort((a, b) => getBookingStartMillis(a) - getBookingStartMillis(b)),
      past: pastItems.sort((a, b) => getBookingStartMillis(b) - getBookingStartMillis(a)),
    };
  }, [bookings?.items]);

  if (isLoading) return <BookingsLoadingState />;

  if (isError) {
    return (
      <StatusRegion focus live="assertive">
        <div className="flex min-h-[60vh] items-center justify-center px-4">
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
      <StatusRegion live="polite">
        <GuestPageFrame>
          <GuestHero
            eyebrow="My reservations"
            title="Your booking archive starts here."
            description="Once you reserve a table, upcoming plans, receipts, and manage links will appear in this portal."
            actions={
              <GuestPrimaryButton href="/restaurants">Find a restaurant</GuestPrimaryButton>
            }
            compact
          />
          <GuestContent narrow>
            <GuestEmpty
              icon={Search}
              title="No bookings yet"
              description="Browse live restaurants and book your first table."
              actionLabel="Find a restaurant"
              actionHref="/restaurants"
            />
          </GuestContent>
        </GuestPageFrame>
      </StatusRegion>
    );
  }

  return (
    <GuestPageFrame>
      <GuestHero
        eyebrow="My reservations"
        title="Upcoming plans and saved receipts."
        description="A clean archive for live reservations, past visits, receipt downloads, and repeat bookings."
        actions={
          <GuestPrimaryButton href="/restaurants">
            <CalendarPlus className="h-5 w-5" aria-hidden />
            New booking
          </GuestPrimaryButton>
        }
        aside={
          <div className="grid grid-cols-2 gap-3">
            <GuestMetricCard icon={Calendar} label="Upcoming" value={upcoming.length} />
            <GuestMetricCard icon={ReceiptText} label="Receipts" value={past.length} />
          </div>
        }
        compact
      />

      <GuestContent>
        <Tabs
          value={activeTab}
          onValueChange={(value) => {
            const next = normalizeBookingsTab(value);
            setActiveTab(next);
            const params = new URLSearchParams(searchParams.toString());
            params.set('tab', next === 'past' ? 'history' : 'upcoming');
            const search = params.toString();
            router.replace(`${pathname}?${search}`);
          }}
          className="space-y-6"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <GuestSectionHeader
              eyebrow="Archive"
              title="Choose a view"
              description="Upcoming reservations stay operational. Past bookings focus on receipts and rebooking."
            />
            <TabsList className="grid h-auto grid-cols-2 rounded-[var(--pg-radius-pill)] border border-border/80 bg-background/90 p-1">
              <TabsTrigger value="upcoming" className="rounded-full px-4 py-2">
                Upcoming
                <Badge variant="secondary" className="ml-2 rounded-full">
                  {upcoming.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="past" className="rounded-full px-4 py-2">
                Past
                <Badge variant="secondary" className="ml-2 rounded-full">
                  {past.length}
                </Badge>
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="upcoming" className="mt-0">
            {upcoming.length === 0 ? (
              <GuestEmpty
                icon={Calendar}
                title="No upcoming reservations"
                description="Plan the next visit and it will appear here with manage and receipt links."
                actionLabel="Find a restaurant"
                actionHref="/restaurants"
              />
            ) : (
              <BookingGrid bookings={upcoming} />
            )}
          </TabsContent>

          <TabsContent value="past" className="mt-0">
            {past.length === 0 ? (
              <GuestPanel className="p-8 text-center">
                <ReceiptText className="mx-auto mb-4 h-10 w-10 text-muted-foreground" aria-hidden />
                <h3 className="pg-card-title">No receipts yet</h3>
                <p className="pg-caption mt-2">Completed reservations will appear here.</p>
              </GuestPanel>
            ) : (
              <BookingGrid bookings={past} isPast />
            )}
          </TabsContent>
        </Tabs>
      </GuestContent>
    </GuestPageFrame>
  );
}

function BookingsLoadingState() {
  return (
    <GuestPageFrame>
      <section className="pg-hero-band pg-section-tight">
        <div className="pg-container space-y-4">
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

function BookingGrid({ bookings, isPast = false }: { bookings: BookingDTO[]; isPast?: boolean }) {
  return (
    <div className="pg-stagger grid gap-4 md:grid-cols-2">
      {bookings.map((booking) => (
        <BookingCard key={booking.id} booking={booking} isPast={isPast} />
      ))}
    </div>
  );
}

function BookingCard({
  booking,
  isPast = false,
}: {
  booking: BookingDTO;
  isPast?: boolean;
}) {
  const { monthLabel, dayLabel, timeLabel } = useMemo(
    () => getBookingCardDisplay(booking),
    [booking],
  );
  const restaurantHref = booking.restaurantSlug
    ? `/restaurants/${booking.restaurantSlug}`
    : '/restaurants';

  return (
    <GuestPanel interactive className={cn('overflow-hidden', isPast && 'opacity-80 hover:opacity-100')}>
      <div className="flex min-h-full flex-col">
        <div className="flex items-start justify-between gap-4 p-5 sm:p-6">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="pg-card-title truncate">{booking.restaurantName}</h3>
              <StatusBadge status={booking.status} isPast={isPast} />
            </div>
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4 shrink-0" aria-hidden />
              <span className="truncate">{booking.restaurantSlug ?? 'Restaurant details'}</span>
            </p>
          </div>
          <BookingCardMenu booking={booking} isPast={isPast} restaurantHref={restaurantHref} />
        </div>

        <div className="grid gap-3 px-5 pb-5 sm:grid-cols-[5rem_1fr] sm:px-6 sm:pb-6">
          <div className="flex h-20 w-20 flex-col items-center justify-center rounded-[var(--pg-radius-md)] bg-primary/10 text-primary">
            <span className="text-xs font-bold uppercase">{monthLabel}</span>
            <span className="text-3xl font-bold leading-none">{dayLabel}</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <InlineDetail icon={Clock} label="Time" value={timeLabel} />
            <InlineDetail
              icon={Users}
              label="Party"
              value={`${booking.partySize} ${booking.partySize === 1 ? 'guest' : 'guests'}`}
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
          className="pg-focus-ring -mr-2 h-10 w-10 rounded-full text-muted-foreground hover:text-foreground"
        >
          <MoreHorizontal className="h-5 w-5" aria-hidden />
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
  const labels: Record<string, string> = {
    confirmed: 'Confirmed',
    pending: 'Pending',
    pending_allocation: 'Pending',
    cancelled: 'Cancelled',
    completed: 'Completed',
    checked_in: 'Live',
    no_show: 'No show',
    PRIORITY_WAITLIST: 'Waitlist',
  };
  const label = labels[status] ?? (isPast ? 'Past' : status);
  const danger = status === 'cancelled' || status === 'no_show';
  const active = !isPast && ['confirmed', 'checked_in'].includes(status);

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

'use client';

import { useCallback, useMemo, useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { AlertTriangle, Ban, CalendarDays, CheckCircle2, ClipboardList, Users, ChevronDown } from 'lucide-react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Calendar, CalendarDayButton } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { formatDateKey, formatDateReadable, getDateInTimezone } from '@/lib/utils/datetime';
import { formatReservationTime } from '@reserve/shared/formatting/booking';

import type { BookingHeatmap, TodayBookingsSummary, TodayBooking } from '@/server/ops/bookings';

type TodayBookingsCardProps = {
  summary: TodayBookingsSummary;
  restaurantName: string;
  selectedDate: string;
  heatmap: BookingHeatmap;
};

type BookingFilter = 'all' | 'upcoming' | 'completed' | 'no-show';

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  confirmed: 'default',
  completed: 'default',
  pending: 'secondary',
  pending_allocation: 'secondary',
  cancelled: 'outline',
  no_show: 'destructive',
};

const UPCOMING_STATUSES = new Set(['pending', 'pending_allocation', 'confirmed']);
const ATTENTION_STATUSES = new Set(['pending', 'pending_allocation', 'confirmed']);
const INACTIVE_STATUSES = new Set(['cancelled', 'no_show']);

const FILTER_OPTIONS: { value: BookingFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'completed', label: 'Show' },
  { value: 'no-show', label: 'No show' },
];

const AVERAGE_DAILY_COVERS = 60;

type HeatIntensity = 'none' | 'faint' | 'low' | 'medium' | 'high';

const HEATMAP_CLASS_MAP: Record<HeatIntensity, string> = {
  none: '',
  faint:
    'data-[selected-single=false]:bg-emerald-100/60 data-[selected-single=false]:text-emerald-900 data-[selected-single=false]:hover:bg-emerald-100/80',
  low:
    'data-[selected-single=false]:bg-emerald-200/70 data-[selected-single=false]:text-emerald-950 data-[selected-single=false]:hover:bg-emerald-200/90',
  medium:
    'data-[selected-single=false]:bg-emerald-400/80 data-[selected-single=false]:text-white data-[selected-single=false]:hover:bg-emerald-400/90',
  high:
    'data-[selected-single=false]:bg-emerald-600/80 data-[selected-single=false]:text-white data-[selected-single=false]:hover:bg-emerald-600/90',
};

function formatStatus(value: string): string {
  switch (value) {
    case 'completed':
      return 'Show';
    case 'no_show':
      return 'No show';
    default:
      return value.replace(/_/g, ' ');
  }
}

function formatTime(value: string | null | undefined, fallback = 'Time TBC'): string {
  if (!value) return fallback;
  const formatted = formatReservationTime(value);
  return formatted || fallback;
}

function parseTimeToMinutes(value: string | null | undefined): number | null {
  if (!value) return null;
  const [hours, minutes] = value.split(':');
  const h = Number.parseInt(hours ?? '', 10);
  const m = Number.parseInt(minutes ?? '', 10);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 text-sm">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="max-w-[220px] text-right text-sm text-foreground">{value}</span>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const variant = STATUS_VARIANT[status] ?? 'secondary';
  return (
    <Badge variant={variant} className="capitalize">
      {formatStatus(status)}
    </Badge>
  );
}

function BookingDetailsDialog({
  booking,
  summary,
  onStatusChange,
}: {
  booking: TodayBooking;
  summary: TodayBookingsSummary;
  onStatusChange: (bookingId: string, status: 'completed' | 'no_show') => Promise<void>;
}) {
  const [loadingStatus, setLoadingStatus] = useState<'completed' | 'no_show' | null>(null);

  const handleStatusChange = async (status: 'completed' | 'no_show') => {
    if (loadingStatus) return;
    setLoadingStatus(status);
    try {
      await onStatusChange(booking.id, status);
    } catch (error) {
      // errors handled upstream via toast; swallow to reset state
    } finally {
      setLoadingStatus(null);
    }
  };

  const isCancelled = booking.status === 'cancelled';
  const isProcessing = loadingStatus !== null;
  const disableShow = isCancelled || isProcessing || booking.status === 'completed';
  const disableNoShow = isCancelled || isProcessing || booking.status === 'no_show';

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="touch-manipulation"
          aria-label={`View booking details${booking.notes ? ' (notes available)' : ''}`}
        >
          Details
          {booking.notes ? <span className="ml-2 inline-flex h-2 w-2 rounded-full bg-primary" aria-hidden /> : null}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{booking.customerName}</DialogTitle>
          <DialogDescription>
            Service on {summary.date} ({summary.timezone})
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Status</span>
            <StatusBadge status={booking.status} />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <DetailRow label="Start time" value={formatTime(booking.startTime)} />
            <DetailRow label="End time" value={formatTime(booking.endTime, '—')} />
            <DetailRow label="Guests" value={`${booking.partySize}`} />
            <DetailRow label="Reference" value={booking.reference ?? 'Not provided'} />
            <DetailRow label="Email" value={booking.customerEmail ?? 'Not provided'} />
            <DetailRow label="Phone" value={booking.customerPhone ?? 'Not provided'} />
          </div>

          {booking.notes ? (
            <div className="space-y-1">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Notes</span>
              <p className="rounded-md border border-border/60 bg-muted/20 p-3 text-sm leading-relaxed text-foreground">
                {booking.notes}
              </p>
            </div>
          ) : null}
        </div>

        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="default"
                size="sm"
                disabled={disableShow}
                className="touch-manipulation"
              >
                Mark as show
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Mark as show?</AlertDialogTitle>
                <AlertDialogDescription>
                  Confirm that {booking.customerName} has arrived so the booking is recorded as attended.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={loadingStatus !== null}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    void handleStatusChange('completed');
                  }}
                  disabled={loadingStatus !== null}
                >
                  {loadingStatus === 'completed' ? 'Updating…' : 'Confirm'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="destructive"
                size="sm"
                disabled={disableNoShow}
                className="touch-manipulation"
              >
                Mark as no show
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Mark as no show?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will flag the booking as not attended. You can revert later if the guest arrives.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={loadingStatus !== null}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    void handleStatusChange('no_show');
                  }}
                  disabled={loadingStatus !== null}
                >
                  {loadingStatus === 'no_show' ? 'Updating…' : 'Confirm'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function TodayBookingsCard({ summary, restaurantName, selectedDate, heatmap }: TodayBookingsCardProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [filter, setFilter] = useState<BookingFilter>('all');
  const [isNavigating, startTransition] = useTransition();

  const selectedDateObj = useMemo(() => {
    const next = new Date(`${selectedDate}T00:00:00`);
    return Number.isNaN(next.getTime()) ? new Date() : next;
  }, [selectedDate]);

  const selectedDateReadable = useMemo(
    () => formatDateReadable(selectedDateObj, summary.timezone),
    [selectedDateObj, summary.timezone],
  );

  const currentContext = useMemo(() => {
    const now = new Date();
    const date = getDateInTimezone(now, summary.timezone);
    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: summary.timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const timeString = formatter.format(now);
    return {
      date,
      minutes: parseTimeToMinutes(timeString),
    };
  }, [summary.timezone]);
  const isUpcoming = useCallback(
    (booking: TodayBooking) => {
      if (summary.date !== currentContext.date) return false;
      if (!booking.startTime) return false;
      if (!UPCOMING_STATUSES.has(booking.status)) return false;
      const startMinutes = parseTimeToMinutes(booking.startTime);
      if (startMinutes === null || currentContext.minutes === null) return false;
      return startMinutes > currentContext.minutes;
    },
    [currentContext.date, currentContext.minutes, summary.date],
  );

  const computedCounts = useMemo(() => {
    return summary.bookings.reduce(
      (acc, booking) => {
        if (isUpcoming(booking)) {
          acc.upcoming += 1;
        }
        if (booking.status === 'completed') {
          acc.show += 1;
        }
        if (booking.status === 'no_show') {
          acc.noShow += 1;
        }
        return acc;
      },
      { upcoming: 0, show: 0, noShow: 0 },
    );
  }, [isUpcoming, summary.bookings]);

  const filterCounts = useMemo<Record<BookingFilter, number>>(
    () => ({
      all: summary.bookings.length,
      upcoming: computedCounts.upcoming,
      completed: computedCounts.show,
      'no-show': computedCounts.noShow,
    }),
    [computedCounts.noShow, computedCounts.show, computedCounts.upcoming, summary.bookings.length],
  );

  const filteredBookings = useMemo(() => {
    switch (filter) {
      case 'upcoming':
        return summary.bookings.filter((booking) => isUpcoming(booking));
      case 'completed':
        return summary.bookings.filter((booking) => booking.status === 'completed');
      case 'no-show':
        return summary.bookings.filter((booking) => booking.status === 'no_show');
      default:
        return summary.bookings;
    }
  }, [filter, isUpcoming, summary.bookings]);

  const bookingsWithAlerts = useMemo(() => {
    return filteredBookings.map((booking) => {
      const startMinutes = parseTimeToMinutes(booking.startTime);
      const isSameDay = summary.date === currentContext.date;
      const isPastStart =
        isSameDay && startMinutes !== null && currentContext.minutes !== null && currentContext.minutes >= startMinutes;
      const needsAttention = isPastStart && ATTENTION_STATUSES.has(booking.status);
      return {
        ...booking,
        needsAttention,
      };
    });
  }, [filteredBookings, summary.date, currentContext]);

  const stats = [
    { label: 'Total bookings', value: summary.totals.total, icon: CalendarDays },
    { label: 'Upcoming', value: computedCounts.upcoming, icon: ClipboardList },
    { label: 'Show', value: computedCounts.show, icon: CheckCircle2 },
    { label: 'No shows', value: computedCounts.noShow, icon: AlertTriangle },
    { label: 'Cancelled', value: summary.totals.cancelled, icon: Ban },
    { label: 'Covers', value: summary.totals.covers, icon: Users },
  ];

  const handleDateSelect = useCallback(
    (date: Date | undefined) => {
      if (!date) return;
      const formatted = getDateInTimezone(date, summary.timezone);
      const params = new URLSearchParams(searchParams?.toString() ?? '');
      params.set('date', formatted);
      const query = params.toString();
      startTransition(() => {
        router.replace(`?${query}`, { scroll: false });
      });
    },
    [router, searchParams, summary.timezone],
  );

  const intensityByDate = useMemo(() => {
    const result: Record<string, HeatIntensity> = {};
    Object.entries(heatmap ?? {}).forEach(([date, value]) => {
      const covers = value?.covers ?? 0;
      if (!covers) return;
      const ratio = covers / AVERAGE_DAILY_COVERS;
      if (ratio >= 1.6) {
        result[date] = 'high';
      } else if (ratio >= 1.1) {
        result[date] = 'medium';
      } else if (ratio >= 0.75) {
        result[date] = 'low';
      } else {
        result[date] = 'faint';
      }
    });
    return result;
  }, [heatmap]);

  const getIntensityForDate = useCallback(
    (date: Date): HeatIntensity => intensityByDate[formatDateKey(date)] ?? 'none',
    [intensityByDate],
  );

  const calendarComponents = useMemo(
    () => ({
      DayButton: (props: React.ComponentProps<typeof CalendarDayButton>) => {
        const intensity = getIntensityForDate(props.day.date);
        const extraClass = HEATMAP_CLASS_MAP[intensity];
        return <CalendarDayButton {...props} className={cn(extraClass, props.className)} />;
      },
    }),
    [getIntensityForDate],
  );

  const updateBookingStatus = useCallback(
    async (bookingId: string, targetStatus: 'completed' | 'no_show') => {
      try {
        const response = await fetch(`/api/ops/bookings/${bookingId}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: targetStatus }),
        });

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data?.error ?? 'Unable to update booking');
        }

        toast.success(targetStatus === 'completed' ? 'Marked as show' : 'Marked as no show');
        router.refresh();
      } catch (error) {
        console.error('[ops] failed to update booking status', error);
        toast.error('Could not update status. Please try again.');
        throw error;
      }
    },
    [router],
  );

  const emptyState =
    summary.bookings.length === 0
      ? 'No bookings scheduled for today.'
      : 'No bookings match this filter. Reset to view all reservations.';

  return (
    <Card className="border-border/60">
      <CardHeader className="gap-6 border-b border-border/60 pb-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex flex-col gap-1">
          <CardTitle className="text-2xl font-semibold text-foreground">Today’s bookings</CardTitle>
          <CardDescription className="text-base text-muted-foreground">
            {selectedDateReadable} · {restaurantName}
          </CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs font-medium text-muted-foreground">
          <Badge className="rounded-full border border-border/60 bg-background px-3 py-1 text-xs font-medium text-muted-foreground">
            Timezone: {summary.timezone}
          </Badge>
          <div className="flex items-center gap-2 rounded-full border border-border/60 bg-background px-3 py-1">
            <ClipboardList className="h-3.5 w-3.5" aria-hidden />
            <span>{summary.bookings.length} bookings on {summary.date}</span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-8">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex w-full flex-col items-center gap-3 text-center">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="flex h-11 w-full max-w-xs items-center justify-between rounded-full border-border/60 bg-background px-4 text-sm font-medium shadow-sm"
                  aria-label="Select service date"
                >
                  <span>{selectedDateReadable}</span>
                  <ChevronDown className="h-4 w-4" aria-hidden />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto overflow-hidden rounded-xl border border-border/60 bg-background p-3 shadow-lg" align="center" sideOffset={8}>
                <Calendar
                  mode="single"
                  captionLayout="dropdown"
                  selected={selectedDateObj}
                  onSelect={handleDateSelect}
                  initialFocus
                  components={calendarComponents}
                />
              </PopoverContent>
            </Popover>
            <p className="text-sm text-muted-foreground max-w-sm">
              Showing reservations for{' '}
              <span className="font-medium text-foreground">{selectedDateReadable}</span>.
            </p>
            <p className="sr-only" aria-live="polite">
              {isNavigating ? 'Loading bookings for selected date…' : `Bookings loaded for ${selectedDateReadable}.`}
            </p>
            <div className="flex items-center gap-3 text-[0.7rem] text-muted-foreground/80">
              <div className="flex items-center gap-1">
                <span className="h-2 w-6 rounded-full bg-emerald-600/80" aria-hidden />
                <span>Busy</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="h-2 w-6 rounded-full bg-emerald-300/70" aria-hidden />
                <span>Steady</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="h-2 w-6 rounded-full bg-emerald-100/60" aria-hidden />
                <span>Light</span>
              </div>
            </div>
          </div>

          <div className="grid w-full gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {stats.map((stat) => {
              const Icon = stat.icon;
              return (
                <div
                  key={stat.label}
                  className="flex flex-col gap-1 rounded-2xl border border-border/60 bg-background/80 px-5 py-4 shadow-sm"
                >
                  <div className="flex items-center justify-between text-[0.7rem] font-medium uppercase tracking-wide text-muted-foreground">
                    <span>{stat.label}</span>
                    {Icon ? <Icon className="h-3.5 w-3.5" aria-hidden /> : null}
                  </div>
                  <p className="text-3xl font-semibold tracking-tight text-foreground">{stat.value}</p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-sm font-medium text-muted-foreground">Schedule</h3>
          <ToggleGroup
            type="single"
            value={filter}
            onValueChange={(value) => {
              if (value) setFilter(value as BookingFilter);
            }}
            aria-label="Filter bookings by attendance status"
            className="flex-wrap justify-center gap-2 sm:justify-end"
          >
          {FILTER_OPTIONS.map(({ value, label }) => (
              <ToggleGroupItem
                key={value}
                value={value}
                className={cn(
                  'rounded-full border border-border/60 px-4 py-1 text-xs font-medium capitalize transition-colors data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground',
                )}
                aria-label={`Show ${label.toLowerCase()} bookings`}
              >
                {label}
                <span className="ml-1 text-xs text-muted-foreground">
                  ({filterCounts[value]})
                </span>
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>

        {bookingsWithAlerts.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border/60 bg-muted/10 px-4 py-6 text-center text-sm text-muted-foreground">
            <p>{emptyState}</p>
            {summary.bookings.length > 0 ? (
              <Button variant="ghost" size="sm" className="mt-3" onClick={() => setFilter('all')}>
                Reset filters
              </Button>
            ) : null}
          </div>
        ) : (
          <>
            <div className="md:hidden space-y-3">
              {bookingsWithAlerts.map((booking) => (
                <div
                  key={booking.id}
                  className="rounded-lg border border-border/60 bg-card/50 p-4 shadow-sm focus-within:ring-2 focus-within:ring-primary/40"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-base font-medium text-foreground">{booking.customerName}</p>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        {formatStatus(booking.status)}
                      </p>
                    </div>
                    <StatusBadge status={booking.status} />
                  </div>

                  <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-muted-foreground">Start</dt>
                      <dd className="font-medium text-foreground">{formatTime(booking.startTime)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-muted-foreground">Guests</dt>
                      <dd className="font-medium text-foreground">{booking.partySize}</dd>
                    </div>
                    <div className="col-span-2">
                      <dt className="text-xs uppercase tracking-wide text-muted-foreground">Reference</dt>
                      <dd className="font-medium text-foreground">{booking.reference ?? 'Not provided'}</dd>
                    </div>
                  </dl>

                  {booking.needsAttention ? (
                    <div className="mt-3 flex items-center gap-2 rounded-md border border-amber-300 bg-amber-100 px-3 py-2 text-sm text-amber-800">
                      <AlertTriangle className="h-4 w-4 flex-none" aria-hidden />
                      <span>Past start — confirm arrival with the floor team.</span>
                    </div>
                  ) : null}

                  <div className="mt-4">
                    <BookingDetailsDialog
                      booking={booking}
                      summary={summary}
                      onStatusChange={updateBookingStatus}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="hidden overflow-x-auto rounded-lg border border-border/60 md:block">
              <table className="w-full min-w-[720px] divide-y divide-border/60 text-left text-sm">
                <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-medium">Customer</th>
                    <th scope="col" className="px-4 py-3 font-medium">Start</th>
                    <th scope="col" className="px-4 py-3 font-medium">Guests</th>
                    <th scope="col" className="px-4 py-3 font-medium">Status</th>
                    <th scope="col" className="px-4 py-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {bookingsWithAlerts.map((booking) => (
                    <tr key={booking.id} className="bg-background/50 hover:bg-muted/30">
                      <td className="px-4 py-3 text-sm font-medium text-foreground">
                        <div className="flex flex-col">
                          <span>{booking.customerName}</span>
                          <span className="text-xs text-muted-foreground">
                            Ref: {booking.reference ?? 'N/A'}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-foreground">{formatTime(booking.startTime)}</td>
                      <td className="px-4 py-3 text-sm text-foreground">{booking.partySize}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <StatusBadge status={booking.status} />
                          {booking.needsAttention ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                              <AlertTriangle className="h-3 w-3" aria-hidden />
                              Past start
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <BookingDetailsDialog
                          booking={booking}
                          summary={summary}
                          onStatusChange={updateBookingStatus}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

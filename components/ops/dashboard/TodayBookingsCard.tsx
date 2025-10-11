'use client';

import { useCallback, useMemo, useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'react-hot-toast';
import {
  AlertTriangle,
  Ban,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Users,
  ChevronDown,
  Mail,
  Phone,
  Calendar as CalendarIcon,
  Clock,
} from 'lucide-react';

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
import { formatDateKey, formatDateReadable, formatTimeRange, getDateInTimezone, getTodayInTimezone } from '@/lib/utils/datetime';

import type { BookingHeatmap, TodayBookingsSummary, TodayBooking } from '@/server/ops/bookings';

type TodayBookingsCardProps = {
  summary: TodayBookingsSummary;
  restaurantName: string;
  selectedDate: string;
  heatmap: BookingHeatmap;
};

type BookingFilter = 'all' | 'completed' | 'no-show';

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

const FILTER_OPTIONS: { value: BookingFilter; label: string; assistive: string }[] = [
  { value: 'all', label: 'All', assistive: 'all bookings' },
  { value: 'completed', label: 'Shows', assistive: 'completed bookings' },
  { value: 'no-show', label: 'No shows', assistive: 'no-show bookings' },
];

const DIMMED_STATUSES = new Set(['completed', 'cancelled', 'no_show']);

const AVERAGE_DAILY_COVERS = 60;

type HeatIntensity = 'none' | 'faint' | 'low' | 'medium' | 'high';

const HEATMAP_CLASS_MAP: Record<HeatIntensity, string> = {
  none: '',
  faint: 'bg-emerald-100/70 text-emerald-900 hover:bg-emerald-100/90',
  low: 'bg-emerald-200/70 text-emerald-950 hover:bg-emerald-200/90',
  medium: 'bg-emerald-400/80 text-white hover:bg-emerald-400/90',
  high: 'bg-emerald-600/80 text-white hover:bg-emerald-600/90',
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

function isSystemCreatedBooking(booking: TodayBooking): boolean {
  if (booking.source === 'system') {
    return true;
  }

  const details = booking.details;
  if (details && typeof details === 'object' && 'created_by' in details) {
    const createdBy = (details as Record<string, unknown>).created_by;
    if (typeof createdBy === 'string') {
      return createdBy.toLowerCase() === 'system';
    }
  }

  return false;
}

function SystemBadge() {
  return (
    <span className="sr-chip border border-dashed border-border/60 bg-background text-[0.7rem] font-medium uppercase tracking-wide text-muted-foreground">
      Created by system
    </span>
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
      // surface handled upstream via toast
    } finally {
      setLoadingStatus(null);
    }
  };

  const isCancelled = booking.status === 'cancelled';
  const isProcessing = loadingStatus !== null;
  const disableShow = isCancelled || isProcessing || booking.status === 'completed';
  const disableNoShow = isCancelled || isProcessing || booking.status === 'no_show';

  const mailHref = booking.customerEmail ? `mailto:${booking.customerEmail}` : null;
  const phoneHref = booking.customerPhone ? `tel:${booking.customerPhone.replace(/[^+\d]/g, '')}` : null;
  const serviceDateReadable = formatDateReadable(summary.date, summary.timezone);
  const serviceTime = formatTimeRange(booking.startTime, booking.endTime, summary.timezone);
  const systemCreated = isSystemCreatedBooking(booking);

  const InfoTile = ({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) => (
    <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-muted/10 px-4 py-3">
      <Icon className="h-4 w-4 text-muted-foreground" aria-hidden />
      <div className="flex flex-col">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
        <span className="text-sm text-foreground">{value}</span>
      </div>
    </div>
  );

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
      <DialogContent className="max-w-3xl">
        <DialogHeader className="space-y-4 border-b border-border/60 pb-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <DialogTitle className="text-xl font-semibold text-foreground">{booking.customerName}</DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                {serviceDateReadable} · {serviceTime}
              </DialogDescription>
            </div>
            <div className="flex items-center gap-2">
              {systemCreated ? <SystemBadge /> : null}
              <StatusBadge status={booking.status} />
            </div>
          </div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Booking reference
            <span className="ml-2 font-medium text-foreground">{booking.reference ?? 'Not provided'}</span>
          </p>
        </DialogHeader>

        <div className="grid gap-4 py-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <div className="space-y-6">
            <section className="space-y-3">
              <h4 className="text-sm font-semibold text-foreground">Contact actions</h4>
              <div className="flex flex-wrap gap-3">
                <Button asChild disabled={!mailHref} className="gap-2">
                  <a href={mailHref ?? '#'} aria-disabled={!mailHref}>
                    <Mail className="h-4 w-4" aria-hidden /> Email guest
                  </a>
                </Button>
                <Button asChild variant="secondary" disabled={!phoneHref} className="gap-2">
                  <a href={phoneHref ?? '#'} aria-disabled={!phoneHref}>
                    <Phone className="h-4 w-4" aria-hidden /> Call guest
                  </a>
                </Button>
              </div>
            </section>

            <section className="space-y-3">
              <h4 className="text-sm font-semibold text-foreground">Booking details</h4>
              <div className="grid gap-3 sm:grid-cols-2">
                <InfoTile icon={Clock} label="Time" value={serviceTime} />
                <InfoTile icon={Users} label="Guests" value={`${booking.partySize}`} />
                <InfoTile icon={CalendarIcon} label="Service date" value={serviceDateReadable} />
                <InfoTile icon={Mail} label="Contact email" value={booking.customerEmail ?? 'Not provided'} />
                <InfoTile icon={Phone} label="Contact phone" value={booking.customerPhone ?? 'Not provided'} />
              </div>
            </section>

            {booking.notes ? (
              <section className="space-y-2">
                <h4 className="text-sm font-semibold text-foreground">Notes from guest</h4>
                <p className="rounded-2xl border border-border/60 bg-muted/15 px-4 py-3 text-sm leading-relaxed text-foreground">
                  {booking.notes}
                </p>
              </section>
            ) : null}

            {booking.details ? (
              <section className="space-y-2">
                <h4 className="text-sm font-semibold text-foreground">Service metadata</h4>
                <pre className="max-h-48 overflow-auto rounded-2xl border border-border/60 bg-muted/15 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
                  {JSON.stringify(booking.details, null, 2)}
                </pre>
              </section>
            ) : null}
          </div>

          <aside className="space-y-4 rounded-3xl border border-border/60 bg-muted/10 px-4 py-5">
            <h4 className="text-sm font-semibold text-foreground">Status actions</h4>
            <p className="text-xs text-muted-foreground">
              Use these shortcuts to keep the team in sync once the guest arrives or is marked as a no-show.
            </p>
            <div className="flex flex-col gap-2">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="default"
                    className="w-full"
                    disabled={disableShow}
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
                    className="w-full"
                    disabled={disableNoShow}
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
          </aside>
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

  const todayKey = useMemo(() => getTodayInTimezone(summary.timezone), [summary.timezone]);
  const isUpcoming = useCallback(
    (booking: TodayBooking) => {
      if (summary.date !== todayKey) return false;
      if (!booking.startTime) return false;
      if (!UPCOMING_STATUSES.has(booking.status)) return false;
      const startMinutes = parseTimeToMinutes(booking.startTime);
      if (startMinutes === null || currentContext.minutes === null) return false;
      return startMinutes > currentContext.minutes;
    },
    [currentContext.minutes, summary.date, todayKey],
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
      completed: computedCounts.show,
      'no-show': computedCounts.noShow,
    }),
    [computedCounts.noShow, computedCounts.show, summary.bookings.length],
  );

  const filteredBookings = useMemo(() => {
    switch (filter) {
      case 'completed':
        return summary.bookings.filter((booking) => booking.status === 'completed');
      case 'no-show':
        return summary.bookings.filter((booking) => booking.status === 'no_show');
      default:
        return summary.bookings;
    }
  }, [filter, summary.bookings]);

  const isViewingToday = summary.date === todayKey;
  const isViewingFutureDate = summary.date > todayKey;
  const isViewingPastDate = summary.date < todayKey;

  const bookingsWithAlerts = useMemo(() => {
    return filteredBookings.map((booking) => {
      const startMinutes = parseTimeToMinutes(booking.startTime);
      const hasStarted =
        isViewingToday &&
        startMinutes !== null &&
        currentContext.minutes !== null &&
        currentContext.minutes >= startMinutes;
      const needsAttention = isViewingToday && hasStarted && ATTENTION_STATUSES.has(booking.status);
      const isDimmed =
        isViewingPastDate ||
        DIMMED_STATUSES.has(booking.status) ||
        (hasStarted && !ATTENTION_STATUSES.has(booking.status));
      return {
        ...booking,
        needsAttention,
        isDimmed,
      };
    });
  }, [currentContext.minutes, filteredBookings, isViewingPastDate, isViewingToday]);

  const stats = [
    { id: 'total', label: 'Total bookings', value: summary.totals.total, icon: CalendarDays },
    { id: 'upcoming', label: 'Upcoming', value: computedCounts.upcoming, icon: ClipboardList },
    { id: 'shows', label: 'Shows', value: computedCounts.show, icon: CheckCircle2 },
    { id: 'no-shows', label: 'No shows', value: computedCounts.noShow, icon: AlertTriangle },
    { id: 'cancelled', label: 'Cancelled', value: summary.totals.cancelled, icon: Ban },
    { id: 'covers', label: 'Covers', value: summary.totals.covers, icon: Users },
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
        const extraClass = !props.modifiers.selected ? HEATMAP_CLASS_MAP[intensity] : '';
        return <CalendarDayButton {...props} className={cn(extraClass, props.className)} />;
      },
    }),
    [getIntensityForDate],
  );

  const headerTitle = isViewingToday ? "Today’s bookings" : "Bookings overview";

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

  const hasAnyBookings = summary.bookings.length > 0;
  const emptyStateTitle = hasAnyBookings ? 'No bookings match this filter' : 'No bookings scheduled for today';
  const emptyStateDescription = hasAnyBookings
    ? 'Adjust your filters or choose another date to review upcoming reservations.'
    : 'As guests book tables, their reservations will appear here for your team.';

  return (
    <Card className="border-border/60 shadow-sm">
      <CardHeader className="space-y-6 border-b border-border/60 pb-[var(--sr-space-6)]">
        <div className="flex flex-col gap-[var(--sr-space-6)] lg:flex-row lg:items-start lg:justify-between">
          <div className="flex flex-col items-center gap-[var(--sr-space-3)] text-center lg:items-start lg:text-left">
            <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-primary/80">
              <span className="inline-flex h-2 w-2 rounded-full bg-primary" aria-hidden />
              <span>Service snapshot</span>
            </div>
            <div className="flex flex-col gap-[var(--sr-space-2)]">
              <CardTitle className="text-3xl font-semibold tracking-tight text-foreground">{headerTitle}</CardTitle>
              <CardDescription className="text-base text-muted-foreground">
                {selectedDateReadable} · {restaurantName}
              </CardDescription>
            </div>
            {!isViewingToday ? (
              <div className="sr-stack-inline-sm justify-center text-xs font-medium uppercase tracking-wide text-muted-foreground lg:justify-start">
                <span className="sr-chip border border-border/60 bg-muted/30">
                  {isViewingFutureDate ? 'Viewing future service' : 'Viewing past service'}
                </span>
                <span className="sr-only" role="status" aria-live="polite">
                  {isViewingFutureDate
                    ? `Future service selected for ${selectedDateReadable}.`
                    : `Past service selected for ${selectedDateReadable}.`}
                </span>
              </div>
            ) : null}
          </div>
          <div className="flex flex-col items-center gap-[var(--sr-space-3)] text-center lg:items-end lg:text-right">
            <div className="flex w-full max-w-xs flex-col gap-[var(--sr-space-2)]">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="h-11 justify-between rounded-[var(--sr-radius-lg)] border-border/60 px-[var(--sr-space-4)] shadow-sm"
                    aria-label="Select service date"
                  >
                    <span className="text-sm font-medium text-foreground">{selectedDateReadable}</span>
                    <ChevronDown className="h-4 w-4 text-muted-foreground" aria-hidden />
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-auto overflow-hidden rounded-[var(--sr-radius-lg)] border border-border/60 bg-background p-[var(--sr-space-4)] shadow-lg"
                  align="center"
                  sideOffset={10}
                >
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
              <p className="text-sm text-muted-foreground">
                Showing reservations for{' '}
                <span className="font-medium text-foreground">{selectedDateReadable}</span>.
              </p>
              <p className="sr-only" aria-live="polite">
                {isNavigating ? 'Loading bookings for selected date…' : `Bookings loaded for ${selectedDateReadable}.`}
              </p>
            </div>
            <div className="sr-stack-inline-sm justify-center text-xs font-medium text-muted-foreground lg:justify-end">
              <span className="sr-chip border border-border/60 bg-background/80">
                Timezone
                <span className="ml-[var(--sr-space-1)] text-foreground">{summary.timezone}</span>
              </span>
              <span className="sr-chip border border-border/60 bg-background/80">
                <ClipboardList className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                <span>
                  {summary.bookings.length} bookings on {summary.date}
                </span>
              </span>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-[var(--sr-space-8)]">
        <dl
          className="grid gap-[var(--sr-space-4)] sm:grid-cols-2 xl:grid-cols-3"
          aria-live="polite"
          aria-atomic="false"
        >
          {stats.map(({ id, label, value, icon: Icon }) => (
            <div
              key={id}
              className="flex flex-col justify-between gap-[var(--sr-space-3)] rounded-[var(--sr-radius-xl)] border border-border/60 bg-muted/10 px-[var(--sr-space-5)] py-[var(--sr-space-5)] shadow-sm transition-colors hover:border-primary/40"
            >
              <dt className="flex items-center gap-[var(--sr-space-3)] text-sm font-medium text-muted-foreground">
                {Icon ? (
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                ) : null}
                <span className="text-sm uppercase tracking-wide text-muted-foreground/90">{label}</span>
              </dt>
              <dd className="text-4xl font-semibold leading-none tracking-tight text-foreground">{value}</dd>
            </div>
          ))}
        </dl>

        <div className="flex flex-col gap-[var(--sr-space-2)] sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-sm font-medium text-muted-foreground">Schedule</h3>
          <ToggleGroup
            type="single"
            value={filter}
            onValueChange={(value) => {
              if (value) setFilter(value as BookingFilter);
            }}
            aria-label="Filter bookings by attendance status"
            className="flex-wrap justify-center gap-[var(--sr-space-2)] sm:justify-end"
          >
            {FILTER_OPTIONS.map(({ value, label, assistive }) => (
              <ToggleGroupItem
                key={value}
                value={value}
                className={cn(
                  'sr-chip border border-border/60 bg-background text-muted-foreground transition-colors data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground',
                )}
                aria-label={`Filter to ${assistive}`}
              >
                <span className="capitalize">{label}</span>
                <span className="ml-[var(--sr-space-1)] text-[0.7rem] text-muted-foreground">
                  ({filterCounts[value]})
                </span>
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>

        <p className="sr-only" aria-live="polite">
          Showing {bookingsWithAlerts.length} {bookingsWithAlerts.length === 1 ? 'booking' : 'bookings'} after filters.
        </p>

        {bookingsWithAlerts.length === 0 ? (
          <div
            className="sr-stack-sm items-center rounded-[var(--sr-radius-xl)] border border-dashed border-border/60 bg-muted/15 px-[var(--sr-space-5)] py-[var(--sr-space-6)] text-center"
            aria-live="polite"
          >
            <CalendarIcon className="h-8 w-8 text-muted-foreground/80" aria-hidden />
            <h4 className="text-base font-semibold text-foreground">{emptyStateTitle}</h4>
            <p className="max-w-xl text-sm text-muted-foreground">{emptyStateDescription}</p>
            {hasAnyBookings ? (
              <Button variant="ghost" size="sm" onClick={() => setFilter('all')}>
                Reset filters
              </Button>
            ) : null}
          </div>
        ) : (
          <>
            <div className="space-y-[var(--sr-space-3)] md:hidden">
              {bookingsWithAlerts.map((booking) => {
                const systemCreated = isSystemCreatedBooking(booking);
                const attentionHintId = booking.needsAttention ? `booking-${booking.id}-attention` : undefined;
                return (
                  <div
                    key={booking.id}
                    tabIndex={0}
                    aria-describedby={attentionHintId}
                    className={cn(
                      'sr-stack-sm rounded-[var(--sr-radius-lg)] border border-border/60 bg-card/60 p-[var(--sr-space-4)] shadow-sm transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                      booking.isDimmed ? 'opacity-60' : 'opacity-100',
                    )}
                  >
                    <div className="flex items-start justify-between gap-[var(--sr-space-2)]">
                      <div>
                        <p className="text-base font-medium text-foreground">{booking.customerName}</p>
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">
                          {formatStatus(booking.status)}
                        </p>
                      </div>
                      <div className="sr-stack-sm items-end">
                        {systemCreated ? <SystemBadge /> : null}
                        <StatusBadge status={booking.status} />
                      </div>
                    </div>

                    <dl className="grid grid-cols-2 gap-x-[var(--sr-space-3)] gap-y-[var(--sr-space-2)] text-sm">
                      <div>
                        <dt className="text-xs uppercase tracking-wide text-muted-foreground">Time</dt>
                        <dd className="font-medium text-foreground">
                          {formatTimeRange(booking.startTime, booking.endTime, summary.timezone)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs uppercase tracking-wide text-muted-foreground">Guests</dt>
                        <dd className="font-medium text-foreground">{booking.partySize}</dd>
                      </div>
                      <div className="col-span-2">
                        <dt className="text-xs uppercase tracking-wide text-muted-foreground">Reference</dt>
                        <dd className="font-medium text-foreground">{booking.reference ?? 'Not provided'}</dd>
                      </div>
                      <div className="col-span-2">
                        <dt className="text-xs uppercase tracking-wide text-muted-foreground">Notes</dt>
                        <dd className="text-sm text-muted-foreground">{booking.notes ?? '—'}</dd>
                      </div>
                    </dl>

                    {booking.needsAttention ? (
                      <div
                        id={attentionHintId}
                        className="sr-stack-inline-sm rounded-[var(--sr-radius-md)] border border-amber-300 bg-amber-100 px-[var(--sr-space-3)] py-[var(--sr-space-2)] text-sm text-amber-900"
                      >
                        <AlertTriangle className="h-4 w-4" aria-hidden />
                        <span>Past start — confirm arrival with the floor team.</span>
                      </div>
                    ) : null}

                    <div>
                      <BookingDetailsDialog
                        booking={booking}
                        summary={summary}
                        onStatusChange={updateBookingStatus}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="hidden overflow-x-auto rounded-[var(--sr-radius-lg)] border border-border/60 md:block">
              <table className="w-full min-w-[720px] divide-y divide-border/60 text-left text-sm">
                <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th scope="col" className="px-[var(--sr-space-4)] py-[var(--sr-space-3)] font-medium">Customer</th>
                    <th scope="col" className="px-[var(--sr-space-4)] py-[var(--sr-space-3)] font-medium">Time</th>
                    <th scope="col" className="px-[var(--sr-space-4)] py-[var(--sr-space-3)] font-medium">Guests</th>
                    <th scope="col" className="px-[var(--sr-space-4)] py-[var(--sr-space-3)] font-medium">Notes</th>
                    <th scope="col" className="px-[var(--sr-space-4)] py-[var(--sr-space-3)] font-medium">Status</th>
                    <th scope="col" className="px-[var(--sr-space-4)] py-[var(--sr-space-3)] font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {bookingsWithAlerts.map((booking) => {
                    const systemCreated = isSystemCreatedBooking(booking);
                    return (
                      <tr
                        key={booking.id}
                        className={cn(
                          'bg-background/50 transition-opacity hover:bg-muted/30',
                          booking.isDimmed ? 'opacity-70' : undefined,
                        )}
                      >
                        <td className="px-[var(--sr-space-4)] py-[var(--sr-space-3)] text-sm font-medium text-foreground">
                          <div className="sr-stack-sm">
                            <span>{booking.customerName}</span>
                            <span className="text-xs text-muted-foreground">
                              Ref: {booking.reference ?? 'N/A'}
                            </span>
                          </div>
                        </td>
                        <td className="px-[var(--sr-space-4)] py-[var(--sr-space-3)] text-sm text-foreground">
                          {formatTimeRange(booking.startTime, booking.endTime, summary.timezone)}
                        </td>
                        <td className="px-[var(--sr-space-4)] py-[var(--sr-space-3)] text-sm text-foreground">
                          {booking.partySize}
                        </td>
                        <td className="px-[var(--sr-space-4)] py-[var(--sr-space-3)] text-sm text-muted-foreground">
                          <span className="block max-w-[220px] truncate">{booking.notes ?? '—'}</span>
                        </td>
                        <td className="px-[var(--sr-space-4)] py-[var(--sr-space-3)]">
                          <div className="sr-stack-inline-sm">
                            {systemCreated ? <SystemBadge /> : null}
                            <StatusBadge status={booking.status} />
                            {booking.needsAttention ? (
                              <span className="sr-chip border border-amber-300 bg-amber-100 text-xs font-medium text-amber-900">
                                <AlertTriangle className="h-3 w-3" aria-hidden />
                                Past start
                              </span>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-[var(--sr-space-4)] py-[var(--sr-space-3)] text-right">
                          <BookingDetailsDialog
                            booking={booking}
                            summary={summary}
                            onStatusChange={updateBookingStatus}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

'use client';

import { format, parseISO } from 'date-fns';
import {
  AlertCircle,
  Calendar as CalendarIcon,
  CheckCircle2,
  Clock,
  ChevronLeft,
  ChevronRight,
  Filter,
  Info,
  LayoutDashboard,
  MapPin,
  RotateCw,
  Search,
  Timer,
  Users,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useOpsSession } from '@/contexts/ops-session';
import { useOpsTableTimeline } from '@/hooks/ops/useOpsTableTimeline';
import { isRealtimeFloorplanEnabled } from '@/lib/feature-flags/realtime';
import { cn } from '@/lib/utils';

import type {
  TableTimelineResponse,
  TableTimelineSegment,
  TableTimelineSegmentState,
} from '@/types/ops';
type SelectedSegment = {
  table: TableTimelineResponse['tables'][number]['table'];
  segment: TableTimelineSegment;
};

const SERVICE_OPTIONS: Array<{ value: 'all' | 'lunch' | 'dinner'; label: string }> = [
  { value: 'all', label: 'All services' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'dinner', label: 'Dinner' },
];

const STATUS_OPTIONS: Array<{
  value: TableTimelineSegmentState;
  label: string;
  dot: string;
  pill: string;
}> = [
  {
    value: 'reserved',
    label: 'Reserved',
    dot: 'bg-primary/10',
    pill: 'bg-primary/10 text-primary shadow-sm hover:bg-primary/10 hover:text-primary',
  },
  {
    value: 'hold',
    label: 'Hold',
    dot: 'bg-primary/10',
    pill: 'bg-primary/10 text-foreground shadow-sm hover:bg-primary/10 hover:text-foreground',
  },
  {
    value: 'available',
    label: 'Available',
    dot: 'bg-muted/40',
    pill: 'border border-border bg-background text-foreground hover:bg-background hover:text-foreground',
  },
  {
    value: 'out_of_service',
    label: 'Out of service',
    dot: 'bg-muted/40',
    pill: 'bg-muted/40 text-muted-foreground shadow-sm hover:bg-muted hover:text-muted-foreground',
  },
];

const DEFAULT_STATUS_FILTERS: TableTimelineSegmentState[] = [
  'reserved',
  'hold',
  'available',
  'out_of_service',
];

const STATUS_META: Record<
  TableTimelineSegmentState,
  {
    label: string;
    bg: string;
    border: string;
    text: string;
    chip: string;
    muted: string;
  }
> = {
  reserved: {
    label: 'Reserved',
    bg: 'bg-primary/10',
    border: 'border-primary/30',
    text: 'text-primary',
    chip: 'bg-primary/10 text-primary',
    muted: 'text-primary',
  },
  hold: {
    label: 'Hold',
    bg: 'bg-primary/10',
    border: 'border-primary/30',
    text: 'text-primary',
    chip: 'bg-primary/10 text-foreground',
    muted: 'text-primary',
  },
  available: {
    label: 'Available',
    bg: 'bg-background',
    border: 'border-border',
    text: 'text-foreground',
    chip: 'bg-muted text-foreground',
    muted: 'text-muted-foreground',
  },
  out_of_service: {
    label: 'Out of service',
    bg: 'bg-muted/40',
    border: 'border-border',
    text: 'text-foreground',
    chip: 'bg-muted/40 text-muted-foreground',
    muted: 'text-muted-foreground',
  },
};

const TIME_SLOTS = Array.from({ length: 12 }, (_, idx) => {
  const hour = 17 + Math.floor(idx / 2);
  const minutes = idx % 2 === 0 ? '00' : '30';
  return `${hour}:${minutes}`;
});

const SLOT_WIDTH_PX = 120;
const START_HOUR = 17;

function parseHHMM(time: string) {
  const [hours, minutes] = time.split(':').map((part) => Number(part));
  return { hours, minutes };
}

function minutesSinceStart(time: string) {
  const { hours, minutes } = parseHHMM(time);
  return (hours - START_HOUR) * 60 + minutes;
}

function timeToPositionPx(time: string) {
  return (minutesSinceStart(time) / 30) * SLOT_WIDTH_PX;
}

function toHHMM(timestamp: string) {
  const date = new Date(timestamp);
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

function clampToServiceWindow(value: number, start: string, end: string) {
  return Math.min(Math.max(value, timeToPositionPx(start)), timeToPositionPx(end));
}

export function TableTimelineClient() {
  const { activeRestaurantId, activeMembership } = useOpsSession();
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const [service, setService] = useState<'all' | 'lunch' | 'dinner'>('all');
  const [search, setSearch] = useState('');
  const [selectedSegment, setSelectedSegment] = useState<SelectedSegment | null>(null);
  const [statusFilters, setStatusFilters] =
    useState<TableTimelineSegmentState[]>(DEFAULT_STATUS_FILTERS);
  const [actionState, setActionState] = useState<{ releasing: boolean; error: string | null }>({
    releasing: false,
    error: null,
  });
  const [now, setNow] = useState<Date>(() => new Date());
  const timelineScrollRef = useRef<HTMLDivElement | null>(null);

  const timelineQuery = useOpsTableTimeline({
    restaurantId: activeRestaurantId,
    date: selectedDate,
    zoneId: selectedZone,
    service,
  });

  const timeline = timelineQuery.data ?? null;

  useEffect(() => {
    if (timeline && !selectedDate) {
      setSelectedDate(timeline.date);
    }
  }, [timeline, selectedDate]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!timeline?.window?.start || !timeline?.window?.end) return;
    const viewport = timelineScrollRef.current;
    if (!viewport) return;

    const start = toHHMM(timeline.window.start);
    const end = toHHMM(timeline.window.end);
    const nowHHMM = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    const nowPx = clampToServiceWindow(timeToPositionPx(nowHHMM), start, end);
    const desired = Math.max(0, nowPx - viewport.clientWidth / 2);
    viewport.scrollLeft = desired;
    // only on initial timeline load
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeline?.window?.start, timeline?.window?.end]);

  const zones = useMemo(() => timeline?.summary?.zones ?? [], [timeline?.summary?.zones]);
  const statusFilterSet = useMemo(
    () => new Set<TableTimelineSegmentState>(statusFilters),
    [statusFilters],
  );
  const filteredTables = useMemo(() => {
    if (!timeline) return [];
    const query = search.trim().toLowerCase();
    return timeline.tables.filter((row) => {
      const matchesSearch =
        !query ||
        String(row.table.tableNumber ?? '')
          .toLowerCase()
          .includes(query) ||
        (row.table.zoneName ?? '').toLowerCase().includes(query);
      const hasVisibleSegments = row.segments.some((segment) => statusFilterSet.has(segment.state));
      return matchesSearch && hasVisibleSegments;
    });
  }, [timeline, search, statusFilterSet]);

  const selectedZoneName = useMemo(() => {
    if (!selectedZone) return null;
    const match = zones.find((zone) => zone.id === selectedZone);
    return match?.name ?? null;
  }, [selectedZone, zones]);

  const toggleStatusFilter = (status: TableTimelineSegmentState) => {
    setStatusFilters((prev) => {
      const next = prev.includes(status)
        ? prev.filter((value) => value !== status)
        : [...prev, status];
      return next.length > 0 ? next : DEFAULT_STATUS_FILTERS;
    });
  };

  const handleReleaseHold = async (holdId: string, bookingId: string | null) => {
    if (!holdId || !bookingId) {
      setActionState({
        releasing: false,
        error: 'Cannot release hold without a booking reference.',
      });
      return;
    }
    setActionState({ releasing: true, error: null });
    try {
      const response = await fetch('/api/staff/manual/hold', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ holdId, bookingId }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || 'Unable to release hold');
      }
      await timelineQuery.refetch();
      setSelectedSegment(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to release hold';
      setActionState({ releasing: false, error: message });
      return;
    }
    setActionState({ releasing: false, error: null });
  };

  if (!activeMembership || !activeRestaurantId) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Select a restaurant to view table capacity timeline.
        </CardContent>
      </Card>
    );
  }

  const displayDate = selectedDate ? parseISO(selectedDate) : null;

  return (
    <TooltipProvider>
      <div className="min-h-[calc(100dvh-3rem)] bg-background pb-12">
        <nav className="sticky top-0 z-30 border-b border-border/60 bg-background/90 backdrop-blur">
          <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-4 px-4 py-3 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary p-2 text-primary-foreground shadow-sm">
                <LayoutDashboard className="h-5 w-5" />
              </div>
              <div className="space-y-0.5">
                <h1 className="text-lg font-semibold text-foreground">Capacity Timeline</h1>
                <p className="text-xs text-muted-foreground">
                  {service === 'all' ? 'All services' : service === 'lunch' ? 'Lunch' : 'Dinner'}
                  {selectedZoneName ? ` • ${selectedZoneName}` : ''}
                  {timeline?.window?.start && timeline?.window?.end
                    ? ` • ${formatTime(timeline.window.start)}–${formatTime(timeline.window.end)}`
                    : ''}
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  aria-label="Find table"
                  placeholder="Find table…"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="h-10 w-full pl-9 sm:w-72"
                />
              </div>

              <Button
                variant="outline"
                size="icon"
                aria-label="Filters"
                className="h-10 w-10"
                disabled
              >
                <Filter className="h-4 w-4" />
              </Button>

              <Separator orientation="vertical" className="hidden h-8 sm:block" />

              <div className="flex items-center rounded-lg bg-muted p-1">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Previous day"
                  className="h-8 w-8"
                  disabled
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="ghost"
                      className={cn(
                        'h-8 px-2 text-xs font-semibold',
                        !displayDate && 'text-muted-foreground',
                      )}
                      aria-label="Select date"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
                      {displayDate ? format(displayDate, 'PPP') : 'Pick a date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="p-0" align="end">
                    <Calendar
                      mode="single"
                      selected={displayDate ?? undefined}
                      onSelect={(date) => setSelectedDate(date ? format(date, 'yyyy-MM-dd') : null)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Next day"
                  className="h-8 w-8"
                  disabled
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </nav>

        <main className="mx-auto w-full max-w-[1600px] space-y-6 px-4 py-6 sm:px-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard icon={Users} label="Current Occupancy" value="—" color="bg-primary/10" />
            <StatCard icon={Timer} label="Avg. Turn Time" value="—" color="bg-primary/10" />
            <StatCard
              icon={CheckCircle2}
              label="Upcoming Arrivals"
              value="—"
              color="bg-primary/10"
            />
            <StatCard
              icon={AlertCircle}
              label="Table Conflicts"
              value="—"
              color="bg-destructive/10"
            />
          </div>

          <div className="flex flex-col gap-6 lg:flex-row">
            <div className="min-w-0 flex-1">
              <Card className="overflow-hidden">
                <CardContent className="p-0">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 bg-muted/20 p-4">
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedZone(null)}
                        aria-pressed={!selectedZone}
                        className={cn(
                          'h-auto rounded-full px-4 py-1.5 text-xs font-semibold transition-colors',
                          !selectedZone
                            ? 'bg-foreground text-background hover:bg-foreground hover:text-background'
                            : 'bg-muted text-muted-foreground hover:bg-muted/70',
                        )}
                      >
                        All Zones
                      </Button>
                      {zones.map((zone) => (
                        <Button
                          key={zone.id}
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedZone(zone.id)}
                          aria-pressed={selectedZone === zone.id}
                          className={cn(
                            'h-auto rounded-full px-4 py-1.5 text-xs font-semibold transition-colors',
                            selectedZone === zone.id
                              ? 'bg-foreground text-background hover:bg-foreground hover:text-background'
                              : 'bg-muted text-muted-foreground hover:bg-muted/70',
                          )}
                        >
                          {zone.name || 'Unnamed zone'}
                        </Button>
                      ))}
                    </div>

                    <div className="hidden flex-wrap items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground md:flex">
                      {STATUS_OPTIONS.filter((option) => option.value !== 'available').map(
                        (option) => (
                          <div key={option.value} className="flex items-center gap-1.5">
                            <span className={cn('h-2.5 w-2.5 rounded-full', option.dot)} />
                            {option.label}
                          </div>
                        ),
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 border-b border-border/60 px-4 py-3 text-xs text-muted-foreground">
                    <div className="min-w-[220px]">
                      <Label htmlFor="timeline-service" className="sr-only">
                        Service
                      </Label>
                      <Select
                        value={service}
                        onValueChange={(value) => setService(value as 'all' | 'lunch' | 'dinner')}
                      >
                        <SelectTrigger id="timeline-service" className="h-9">
                          <SelectValue placeholder="All services" />
                        </SelectTrigger>
                        <SelectContent>
                          {SERVICE_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                        Status
                      </span>
                      {STATUS_OPTIONS.map((option) => {
                        const active = statusFilters.includes(option.value);
                        return (
                          <Button
                            key={option.value}
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleStatusFilter(option.value)}
                            aria-pressed={active}
                            className={cn(
                              'h-auto rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                              active
                                ? option.pill
                                : 'bg-muted text-foreground border border-border hover:border-primary/40',
                            )}
                          >
                            <span
                              className={cn(
                                'h-2.5 w-2.5 rounded-full',
                                option.dot,
                                !active && 'opacity-60',
                              )}
                            />
                            {option.label}
                          </Button>
                        );
                      })}
                    </div>

                    <div className="ml-auto flex items-center gap-2">
                      <span>
                        Last updated{' '}
                        {timelineQuery.dataUpdatedAt
                          ? new Date(timelineQuery.dataUpdatedAt).toLocaleTimeString()
                          : '—'}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => timelineQuery.refetch()}
                        disabled={timelineQuery.isFetching}
                      >
                        <RotateCw
                          className={cn('mr-2 h-4 w-4', timelineQuery.isFetching && 'animate-spin')}
                        />
                        Refresh
                      </Button>
                    </div>
                  </div>

                  {timelineQuery.isLoading ? (
                    <TimelineSkeleton />
                  ) : timeline ? (
                    <PrototypeTimelineGrid
                      timeline={timeline}
                      tables={filteredTables}
                      onSelectSegment={(table, segment) => setSelectedSegment({ table, segment })}
                      now={now}
                      scrollRef={timelineScrollRef}
                    />
                  ) : (
                    <div className="p-6">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <AlertCircle className="h-4 w-4" />
                        Unable to load table timeline. Please try again.
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between gap-3 border-t border-border/60 bg-muted/20 px-4 py-3 text-[11px] text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Info className="h-4 w-4" />
                      Drag blocks to reassign tables. Right-click for quick actions.
                    </div>
                    <div className="hidden sm:block">
                      Live updates {isRealtimeEnabled() ? 'on' : 'polling'}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="w-full shrink-0 space-y-4 lg:w-96">
              <Card>
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold">Action Required</h3>
                    <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold text-destructive dark:bg-destructive/10 dark:text-destructive">
                      — Alerts
                    </span>
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">
                    Alerts will appear here once live data is loaded.
                  </p>
                  <Button className="mt-4 w-full" variant="secondary" disabled>
                    View All Notifications
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-5">
                  <h3 className="text-sm font-semibold">Capacity Breakdown</h3>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Breakdown will be computed from table inventory and bookings.
                  </p>
                  <div className="mt-4 space-y-4">
                    {[
                      { label: '2-Tops', current: 0, total: 0 },
                      { label: '4-Tops', current: 0, total: 0 },
                      { label: '6+ Tops', current: 0, total: 0 },
                    ].map((item) => (
                      <div key={item.label} className="space-y-1.5">
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">{item.label}</span>
                          <span className="font-semibold text-foreground">
                            {item.total ? `${item.current}/${item.total}` : '—'}
                          </span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full bg-primary"
                            style={{
                              width: item.total ? `${(item.current / item.total) * 100}%` : '0%',
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          <SegmentDialog
            selected={selectedSegment}
            onClose={() => {
              setActionState({ releasing: false, error: null });
              setSelectedSegment(null);
            }}
            onReleaseHold={handleReleaseHold}
            actionState={actionState}
          />
        </main>
      </div>
    </TooltipProvider>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: typeof Users;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div className={cn('rounded-lg p-2', color, 'bg-opacity-10')}>
          <Icon className={cn('h-5 w-5', color.replace('bg-', 'text-'))} />
        </div>
      </div>
      <div className="mt-3 text-2xl font-semibold text-foreground">{value}</div>
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
    </div>
  );
}

function isRealtimeEnabled() {
  return isRealtimeFloorplanEnabled();
}

function TimelineSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-24 w-full rounded-xl" />
      <Skeleton className="h-80 w-full rounded-xl" />
    </div>
  );
}

function PrototypeTimelineGrid({
  timeline,
  tables,
  onSelectSegment,
  now,
  scrollRef,
}: {
  timeline: TableTimelineResponse;
  tables: TableTimelineResponse['tables'];
  onSelectSegment: (
    table: TableTimelineResponse['tables'][number]['table'],
    segment: TableTimelineSegment,
  ) => void;
  now: Date;
  scrollRef: React.MutableRefObject<HTMLDivElement | null>;
}) {
  if (!timeline.window.start || !timeline.window.end) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        Timeline window is unavailable for the selected date.
      </div>
    );
  }

  const windowStartHHMM = toHHMM(timeline.window.start);
  const windowEndHHMM = toHHMM(timeline.window.end);
  const widthPx = Math.max(1, timeToPositionPx(windowEndHHMM) - timeToPositionPx(windowStartHHMM));
  const nowHHMM = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  const nowPx =
    clampToServiceWindow(timeToPositionPx(nowHHMM), windowStartHHMM, windowEndHHMM) -
    timeToPositionPx(windowStartHHMM);

  return (
    <div className="flex flex-col">
      <div className="sticky top-0 z-20 flex border-b border-border bg-muted/20">
        <div className="w-48 shrink-0 border-r border-border px-4 py-3">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Table / Cap
          </div>
        </div>
        <div className="min-w-0 flex-1 overflow-hidden">
          <div className="flex" style={{ width: `${TIME_SLOTS.length * SLOT_WIDTH_PX}px` }}>
            {TIME_SLOTS.map((slot) => (
              <div
                key={slot}
                className="shrink-0 border-r border-border/40 px-3 py-3 text-center text-xs font-medium text-muted-foreground"
                style={{ width: SLOT_WIDTH_PX }}
              >
                {slot}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div ref={scrollRef} className="relative overflow-x-auto">
        <div className="min-w-fit">
          {tables.map((row) => (
            <PrototypeTableRow
              key={row.table.id}
              table={row.table}
              segments={row.segments}
              windowStart={windowStartHHMM}
              windowEnd={windowEndHHMM}
              timelineWidthPx={widthPx}
              nowPx={nowPx}
              onSelect={(segment) => onSelectSegment(row.table, segment)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function PrototypeTableRow({
  table,
  segments,
  windowStart,
  windowEnd,
  timelineWidthPx,
  nowPx,
  onSelect,
}: {
  table: TableTimelineResponse['tables'][number]['table'];
  segments: TableTimelineSegment[];
  windowStart: string;
  windowEnd: string;
  timelineWidthPx: number;
  nowPx: number;
  onSelect: (segment: TableTimelineSegment) => void;
}) {
  return (
    <div className="group flex border-b border-border/40 transition-colors hover:bg-muted/20">
      <div className="w-48 shrink-0 border-r border-border px-4 py-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-foreground">Table {table.tableNumber}</div>
            <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <MapPin className="h-3 w-3" />
              <span className="truncate">{table.zoneName ?? 'No zone'}</span>
            </div>
          </div>
          <span className="rounded-md bg-muted px-2 py-1 text-[10px] font-semibold text-muted-foreground">
            Cap {table.capacity}
          </span>
        </div>
      </div>

      <div
        className="relative h-14 flex-1"
        style={{ minWidth: `${TIME_SLOTS.length * SLOT_WIDTH_PX}px` }}
      >
        <div className="absolute inset-0 flex">
          {TIME_SLOTS.map((slot) => (
            <div
              key={slot}
              className="h-full shrink-0 border-r border-border/30"
              style={{ width: SLOT_WIDTH_PX }}
              aria-hidden
            />
          ))}
        </div>

        <div
          className="absolute inset-y-0 z-20 w-px bg-destructive/10"
          style={{ left: `${nowPx}px` }}
          aria-hidden
        >
          <div className="absolute -top-1 -left-1 h-2 w-2 rounded-full bg-destructive/10 shadow" />
        </div>

        {segments
          .filter((segment) => segment.state !== 'available')
          .map((segment, idx) => (
            <PrototypeReservationBlock
              key={`${segment.start}-${segment.end}-${idx}`}
              segment={segment}
              windowStart={windowStart}
              windowEnd={windowEnd}
              timelineWidthPx={timelineWidthPx}
              onClick={() => onSelect(segment)}
            />
          ))}
      </div>
    </div>
  );
}

function PrototypeReservationBlock({
  segment,
  windowStart,
  windowEnd,
  timelineWidthPx,
  onClick,
}: {
  segment: TableTimelineSegment;
  windowStart: string;
  windowEnd: string;
  timelineWidthPx: number;
  onClick: () => void;
}) {
  const state = segment.state;
  const statusStyle: Record<TableTimelineSegmentState, string> = {
    reserved: 'bg-primary/10 text-primary border-primary/30',
    hold: 'bg-primary/10 text-foreground border-primary/30',
    available: 'bg-muted text-muted-foreground border-border',
    out_of_service: 'bg-muted/40 text-muted-foreground border-border',
  };

  const start = toHHMM(segment.start);
  const end = toHHMM(segment.end);

  const left =
    clampToServiceWindow(timeToPositionPx(start), windowStart, windowEnd) -
    timeToPositionPx(windowStart);
  const right =
    clampToServiceWindow(timeToPositionPx(end), windowStart, windowEnd) -
    timeToPositionPx(windowStart);
  const width = Math.max(0, right - left);
  if (width <= 0) return null;

  const customerLabel = segment.booking?.customerName ?? STATUS_META[state].label;
  const partySize = segment.booking?.partySize ?? null;

  return (
    <Button
      variant="ghost"
      onClick={onClick}
      className={cn(
        'absolute top-2 h-10 flex-col items-stretch justify-start gap-0 rounded-lg border-l-4 px-3 py-0 text-left shadow-sm transition hover:brightness-110',
        statusStyle[state],
      )}
      style={{ left, width: Math.min(width, timelineWidthPx - left) }}
      aria-label={`${customerLabel} ${start}–${end}`}
    >
      <div className="flex items-center justify-between gap-2 overflow-hidden">
        <span className="truncate text-[11px] font-semibold">{customerLabel}</span>
        {partySize ? (
          <span className="flex items-center gap-1 text-[10px] opacity-80">
            <Users className="h-3 w-3" /> {partySize}
          </span>
        ) : null}
      </div>
      <div className="truncate text-[10px] opacity-80">
        {start} – {end}
      </div>
    </Button>
  );
}

function SegmentDialog({
  selected,
  onClose,
  onReleaseHold,
  actionState,
}: {
  selected: SelectedSegment | null;
  onClose: () => void;
  onReleaseHold: (holdId: string, bookingId: string | null) => void;
  actionState: { releasing: boolean; error: string | null };
}) {
  if (!selected) return null;

  const { table, segment } = selected;
  const start = formatTime(segment.start);
  const end = formatTime(segment.end);
  const durationMinutes = Math.max(
    Math.round((new Date(segment.end).getTime() - new Date(segment.start).getTime()) / 60000),
    0,
  );
  const holdId = segment.hold?.id ?? null;
  const bookingId = segment.hold?.bookingId ?? segment.booking?.id ?? null;
  const meta = STATUS_META[segment.state];

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-lg font-semibold text-foreground">
              T{table.tableNumber}
            </div>
            <div className="space-y-1 text-left">
              <DialogTitle>Table {table.tableNumber}</DialogTitle>
              <DialogDescription className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4" />
                {start} – {end}
                {durationMinutes ? ` (${durationMinutes}m)` : ''}
              </DialogDescription>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4" />
            <span>{table.zoneName ?? 'No zone'}</span>
            <span className="text-border">•</span>
            <Users className="h-4 w-4" />
            <span>{table.capacity} seats</span>
          </div>
        </DialogHeader>

        <div className={cn('rounded-xl border p-4', meta.bg, meta.border)}>
          <div className="flex items-start gap-3">
            <Badge className={cn('flex-shrink-0', meta.chip)}>{meta.label}</Badge>
            <div className="space-y-1 text-sm">
              {segment.booking ? (
                <>
                  <p className="font-semibold text-foreground">
                    {segment.booking.customerName ?? 'Guest'}
                  </p>
                  <p className="text-muted-foreground">
                    Party of {segment.booking.partySize} · {segment.booking.status}
                  </p>
                </>
              ) : segment.state === 'hold' ? (
                <>
                  <p className="font-semibold text-foreground">Table is on hold</p>
                  <p className="text-muted-foreground">
                    Linked booking ID: {bookingId ?? 'unknown'}
                  </p>
                </>
              ) : segment.state === 'out_of_service' ? (
                <>
                  <p className="font-semibold text-foreground">Out of service</p>
                  <p className="text-muted-foreground">Temporarily unavailable</p>
                </>
              ) : (
                <>
                  <p className="font-semibold text-foreground">Available slot</p>
                  <p className="text-muted-foreground">Ready to be assigned</p>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          {segment.booking ? (
            <Button asChild className="flex-1">
              <a href={`/bookings?query=${encodeURIComponent(segment.booking.customerName ?? '')}`}>
                View booking
                <ChevronRight className="ml-2 h-4 w-4" />
              </a>
            </Button>
          ) : null}
          {segment.state === 'hold' ? (
            <Button
              className="flex-1"
              variant="outline"
              disabled={!holdId || !bookingId || actionState.releasing}
              onClick={() => holdId && onReleaseHold(holdId, bookingId)}
            >
              {actionState.releasing ? 'Releasing hold…' : 'Release hold'}
            </Button>
          ) : null}
          {segment.state === 'available' ? (
            <Button className="flex-1" variant="secondary" disabled>
              Create booking
            </Button>
          ) : null}
        </div>
        {actionState.error ? <p className="text-xs text-destructive">{actionState.error}</p> : null}
      </DialogContent>
    </Dialog>
  );
}

function formatTime(date: string) {
  return new Date(date).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

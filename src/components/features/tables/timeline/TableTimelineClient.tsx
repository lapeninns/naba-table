'use client';

import { useEffect, useMemo, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useOpsSession } from '@/contexts/ops-session';
import { useOpsTableTimeline } from '@/hooks/ops/useOpsTableTimeline';
import { cn } from '@/lib/utils';

import type { TableTimelineResponse, TableTimelineSegment, TableTimelineSegmentState } from '@/types/ops';

import { AlertCircle, Calendar as CalendarIcon, ChevronRight, Clock, MapPin, RotateCw, Search, Users } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

type SelectedSegment = {
  table: TableTimelineResponse['tables'][number]['table'];
  segment: TableTimelineSegment;
};

type HourMarker = {
  time: number;
  label: string;
  offset: number;
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
    { value: 'reserved', label: 'Reserved', dot: 'bg-emerald-500', pill: 'bg-emerald-600 text-white shadow-sm' },
    { value: 'hold', label: 'Hold', dot: 'bg-amber-500', pill: 'bg-amber-500 text-slate-950 shadow-sm' },
    { value: 'available', label: 'Available', dot: 'bg-slate-300', pill: 'bg-white border border-border text-foreground' },
    { value: 'out_of_service', label: 'Out of service', dot: 'bg-slate-500', pill: 'bg-slate-500 text-white shadow-sm' },
  ];

const DEFAULT_STATUS_FILTERS: TableTimelineSegmentState[] = ['reserved', 'hold', 'available', 'out_of_service'];

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
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    text: 'text-emerald-900',
    chip: 'bg-emerald-500 text-white',
    muted: 'text-emerald-700',
  },
  hold: {
    label: 'Hold',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    text: 'text-amber-900',
    chip: 'bg-amber-500 text-slate-950',
    muted: 'text-amber-700',
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
    bg: 'bg-slate-100',
    border: 'border-slate-300',
    text: 'text-slate-900',
    chip: 'bg-slate-500 text-white',
    muted: 'text-slate-700',
  },
};

export function TableTimelineClient() {
  const { activeRestaurantId, activeMembership } = useOpsSession();
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const [service, setService] = useState<'all' | 'lunch' | 'dinner'>('all');
  const [search, setSearch] = useState('');
  const [selectedSegment, setSelectedSegment] = useState<SelectedSegment | null>(null);
  const [statusFilters, setStatusFilters] = useState<TableTimelineSegmentState[]>(DEFAULT_STATUS_FILTERS);
  const [actionState, setActionState] = useState<{ releasing: boolean; error: string | null }>({
    releasing: false,
    error: null,
  });
  const [now, setNow] = useState<Date>(() => new Date());

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

  const zones = timeline?.summary?.zones ?? [];
  const statusFilterSet = useMemo(() => new Set<TableTimelineSegmentState>(statusFilters), [statusFilters]);
  const filteredTables = useMemo(() => {
    if (!timeline) return [];
    const query = search.trim().toLowerCase();
    return timeline.tables.filter((row) => {
      const matchesSearch =
        !query ||
        row.table.tableNumber.toLowerCase().includes(query) ||
        (row.table.zoneName ?? '').toLowerCase().includes(query);
      const hasVisibleSegments = row.segments.some((segment) => statusFilterSet.has(segment.state));
      return matchesSearch && hasVisibleSegments;
    });
  }, [timeline, search, statusFilterSet]);

  const toggleStatusFilter = (status: TableTimelineSegmentState) => {
    setStatusFilters((prev) => {
      const next = prev.includes(status) ? prev.filter((value) => value !== status) : [...prev, status];
      return next.length > 0 ? next : DEFAULT_STATUS_FILTERS;
    });
  };

  const handleReleaseHold = async (holdId: string, bookingId: string | null) => {
    if (!holdId || !bookingId) {
      setActionState({ releasing: false, error: 'Cannot release hold without a booking reference.' });
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

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Capacity</p>
            <h1 className="text-3xl font-semibold text-foreground">Table timeline</h1>
            <p className="text-sm text-muted-foreground">
              Monitor table availability across services with live holds and bookings.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <span>
              Last updated {timelineQuery.dataUpdatedAt ? new Date(timelineQuery.dataUpdatedAt).toLocaleTimeString() : '—'}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => timelineQuery.refetch()}
              disabled={timelineQuery.isFetching}
            >
              <RotateCw className={cn('mr-2 h-4 w-4', timelineQuery.isFetching && 'animate-spin')} />
              Refresh
            </Button>
          </div>
        </div>

        <Card>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-4">
              <div className="space-y-1">
                <Label htmlFor="timeline-date">Service date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      id="timeline-date"
                      variant="outline"
                      className={cn('w-full justify-start text-left font-normal', !selectedDate && 'text-muted-foreground')}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {selectedDate ? format(parseISO(selectedDate), 'PPP') : 'Pick a date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={selectedDate ? parseISO(selectedDate) : undefined}
                      onSelect={(date) => setSelectedDate(date ? format(date, 'yyyy-MM-dd') : null)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-1">
                <Label htmlFor="timeline-zone">Zone</Label>
                <Select value={selectedZone ?? 'all'} onValueChange={(value) => setSelectedZone(value === 'all' ? null : value)}>
                  <SelectTrigger id="timeline-zone">
                    <SelectValue placeholder="All zones" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All zones</SelectItem>
                    {zones.map((zone) => (
                      <SelectItem key={zone.id} value={zone.id}>
                        {zone.name || 'Unnamed zone'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="timeline-service">Service</Label>
                <Select value={service} onValueChange={(value) => setService(value as 'all' | 'lunch' | 'dinner')}>
                  <SelectTrigger id="timeline-service">
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
              <div className="space-y-1">
                <Label htmlFor="timeline-search">Search</Label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="timeline-search"
                    placeholder="Search by table number or zone"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Status</span>
              <div className="flex flex-wrap gap-2">
                {STATUS_OPTIONS.map((option) => {
                  const active = statusFilters.includes(option.value);
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => toggleStatusFilter(option.value)}
                      aria-pressed={active}
                      className={cn(
                        'flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                        active ? option.pill : 'bg-muted text-foreground border border-border hover:border-primary/40'
                      )}
                    >
                      <span className={cn('h-2.5 w-2.5 rounded-full', option.dot, !active && 'opacity-60')} />
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        {timelineQuery.isLoading ? (
          <TimelineSkeleton />
        ) : timeline ? (
          <div className="space-y-4">
            <ServiceSummary summary={timeline.summary} />
            <Card className="overflow-hidden">
              <CardContent className="p-0">
                <RevampedTimelineGrid
                  timeline={timeline}
                  tables={filteredTables}
                  statusFilterSet={statusFilterSet}
                  onSelectSegment={(table, segment) => setSelectedSegment({ table, segment })}
                  now={now}
                />
              </CardContent>
            </Card>
          </div>
        ) : (
          <Card>
            <CardContent className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
              <AlertCircle className="h-4 w-4" />
              Unable to load table timeline. Please try again.
            </CardContent>
          </Card>
        )}

        <SegmentDialog
          selected={selectedSegment}
          onClose={() => {
            setActionState({ releasing: false, error: null });
            setSelectedSegment(null);
          }}
          onReleaseHold={handleReleaseHold}
          actionState={actionState}
        />
      </div>
    </TooltipProvider>
  );
}

function TimelineSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-24 w-full rounded-xl" />
      <Skeleton className="h-80 w-full rounded-xl" />
    </div>
  );
}

function ServiceSummary({ summary }: { summary: TableTimelineResponse['summary'] }) {
  if (!summary) return null;
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card>
        <CardContent className="space-y-1 py-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Tables</p>
          <p className="text-2xl font-semibold text-foreground">{summary.totalTables}</p>
          <p className="text-xs text-muted-foreground">{summary.totalCapacity} seats · {summary.availableTables} available</p>
        </CardContent>
      </Card>
      {summary.serviceCapacities.map((service) => (
        <Card key={service.key}>
          <CardContent className="space-y-1 py-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{service.label}</p>
            <p className="text-2xl font-semibold text-foreground">{service.capacity} seats</p>
            <p className="text-xs text-muted-foreground">
              {service.tablesConsidered} tables · {service.turnsPerTable} turns · {service.seatsPerTurn} seats/turn
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function RevampedTimelineGrid({
  timeline,
  tables,
  onSelectSegment,
  statusFilterSet,
  now,
}: {
  timeline: TableTimelineResponse;
  tables: TableTimelineResponse['tables'];
  onSelectSegment: (table: TableTimelineResponse['tables'][number]['table'], segment: TableTimelineSegment) => void;
  statusFilterSet: Set<TableTimelineSegmentState>;
  now: Date;
}) {
  const windowStart = timeline.window.start ? new Date(timeline.window.start).getTime() : null;
  const windowEnd = timeline.window.end ? new Date(timeline.window.end).getTime() : null;
  const duration = windowStart !== null && windowEnd !== null ? Math.max(windowEnd - windowStart, 1) : 1;
  const hourMarkers = useMemo(() => buildHourMarkers(windowStart, windowEnd, duration), [windowStart, windowEnd, duration]);
  const nowOffset = useMemo(() => getNowOffset(windowStart, windowEnd, now), [windowStart, windowEnd, now]);
  const visibleCount = tables.length;
  const totalCount = timeline.tables.length;

  if (windowStart === null || windowEnd === null) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        Timeline window is unavailable for the selected date.
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="sticky top-0 z-10 bg-card/95 backdrop-blur-sm">
        <div className="flex h-14 items-center border-b border-border/60">
          <div className="w-60 shrink-0 border-r border-border/60 px-4">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tables</span>
          </div>
          <div className="relative flex-1">
            {hourMarkers.map((marker, index) => (
              <div
                key={`${marker.label}-${index}`}
                className="absolute inset-y-0 flex flex-col items-center"
                style={{ left: `${marker.offset}%` }}
              >
                <div className="h-full w-px bg-border/70" aria-hidden />
                <div className="absolute top-2 -translate-x-1/2 rounded bg-card px-1 text-[11px] font-medium text-muted-foreground">
                  {marker.label}
                </div>
              </div>
            ))}
            {nowOffset !== null ? (
              <div className="absolute inset-y-0" style={{ left: `${nowOffset}%` }} aria-label="Current time">
                <div className="h-full w-px bg-primary" />
                <div className="absolute -top-1.5 left-1/2 -translate-x-1/2">
                  <div className="h-3 w-3 rounded-full border-2 border-background bg-primary shadow-md" />
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-b border-border/60 bg-muted/30 px-4 py-2 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">Showing {visibleCount} of {totalCount} tables</span>
        <span className="text-border">•</span>
        <span>Window {formatTime(timeline.window.start)} – {formatTime(timeline.window.end)}</span>
        {timeline.services?.length ? <ServiceChips services={timeline.services} /> : null}
      </div>

      <ScrollArea className="h-[520px] md:h-[calc(100vh-320px)]" type="always">
        {tables.length > 0 ? (
          <div className="min-w-[1200px]">
            {tables.map((row) => (
              <div
                key={row.table.id}
                className="flex border-b border-border/40 transition-colors hover:bg-muted/40"
              >
                <TableInfoCell table={row.table} />
                <div className="relative flex-1 p-3">
                  <div className="absolute inset-3 -z-10">
                    {hourMarkers.map((marker, index) => (
                      <div
                        key={`${marker.label}-${index}`}
                        className="absolute inset-y-0 w-px bg-border/40"
                        style={{ left: `${marker.offset}%` }}
                        aria-hidden
                      />
                    ))}
                    {nowOffset !== null ? (
                      <div className="absolute inset-y-0 w-px bg-primary/70" style={{ left: `${nowOffset}%` }} aria-hidden />
                    ) : null}
                  </div>

                  <div className="relative h-16">
                    {row.segments.map((segment, index) => {
                      const { offset, width } = getSegmentPosition(segment, windowStart, windowEnd);
                      if (width <= 0) return null;
                      const isVisible = statusFilterSet.has(segment.state);
                      return (
                        <TimelineSegment
                          key={`${segment.start}-${segment.end}-${index}`}
                          segment={segment}
                          table={row.table}
                          offset={offset}
                          width={width}
                          isVisible={isVisible}
                          onClick={() => onSelectSegment(row.table, segment)}
                        />
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex h-64 items-center justify-center text-muted-foreground">
            <div className="text-center">
              <Search className="mx-auto h-12 w-12 text-border" />
              <p className="mt-4 font-medium text-foreground">No tables found</p>
              <p className="text-sm">Try adjusting your filters</p>
            </div>
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

function TableInfoCell({ table }: { table: TableTimelineResponse['tables'][number]['table'] }) {
  return (
    <div className="w-60 shrink-0 border-r border-border/60 p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted text-lg font-semibold text-foreground">
          T{table.tableNumber}
        </div>
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-1.5 text-sm text-foreground">
            <Users className="h-3.5 w-3.5" />
            <span className="font-medium">{table.capacity} seats</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground truncate">
            <MapPin className="h-3 w-3" />
            <span className="truncate">{table.zoneName ?? 'No zone'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function TimelineSegment({
  segment,
  table,
  offset,
  width,
  isVisible,
  onClick,
}: {
  segment: TableTimelineSegment;
  table: TableTimelineResponse['tables'][number]['table'];
  offset: number;
  width: number;
  isVisible: boolean;
  onClick: () => void;
}) {
  const meta = STATUS_META[segment.state];
  const label = buildSegmentLabel(segment, table.tableNumber);
  const clickable = segment.state !== 'available';
  const durationMinutes = Math.max(
    Math.round((new Date(segment.end).getTime() - new Date(segment.start).getTime()) / 60000),
    0,
  );

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={clickable ? onClick : undefined}
          disabled={!clickable}
          aria-label={label}
          className={cn(
            'absolute top-1/2 flex h-12 -translate-y-1/2 items-center overflow-hidden rounded-lg border px-3 text-left text-xs font-medium shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
            meta.bg,
            meta.border,
            meta.text,
            clickable ? 'cursor-pointer' : 'cursor-default',
            !isVisible && 'opacity-30',
          )}
          style={{ left: `${offset}%`, width: `${width}%` }}
        >
          <div className="flex w-full items-center gap-2 truncate">
            {segment.booking ? (
              <Badge className={cn('flex-shrink-0', meta.chip)}>{segment.booking.partySize}</Badge>
            ) : null}
            <div className="min-w-0 flex-1 truncate">
              <p className="truncate text-xs font-semibold leading-tight">
                {segment.booking?.customerName ?? meta.label}
              </p>
              {width > 8 ? (
                <p className={cn('truncate text-[11px] leading-tight', meta.muted)}>
                  {formatTime(segment.start)} – {formatTime(segment.end)}
                  {durationMinutes ? ` · ${durationMinutes}m` : ''}
                </p>
              ) : null}
            </div>
            {segment.state === 'available' ? <PlusIndicator /> : null}
          </div>
        </button>
      </TooltipTrigger>
      <TooltipContent className="w-64">
        <div className="space-y-1 text-left">
          <p className="font-semibold text-foreground">{meta.label}</p>
          <p className="text-xs text-muted-foreground">{formatTime(segment.start)} – {formatTime(segment.end)}</p>
          {segment.booking ? (
            <p className="text-xs text-muted-foreground">
              {segment.booking.customerName ?? 'Guest'} · Party {segment.booking.partySize} · {segment.booking.status}
            </p>
          ) : null}
          {segment.state === 'hold' && segment.hold ? (
            <p className="text-xs text-muted-foreground">Hold linked to booking {segment.hold.bookingId ?? 'unknown'}</p>
          ) : null}
          {segment.state === 'available' ? (
            <p className="text-xs text-muted-foreground">Available slot</p>
          ) : null}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

function PlusIndicator() {
  return (
    <span className="ml-auto inline-flex h-6 w-6 items-center justify-center rounded-md border border-dashed border-border/60 text-xs text-muted-foreground">
      +
    </span>
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
    <Dialog open onOpenChange={(next) => { if (!next) onClose(); }}>
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
                  <p className="font-semibold text-foreground">{segment.booking.customerName ?? 'Guest'}</p>
                  <p className="text-muted-foreground">Party of {segment.booking.partySize} · {segment.booking.status}</p>
                </>
              ) : segment.state === 'hold' ? (
                <>
                  <p className="font-semibold text-foreground">Table is on hold</p>
                  <p className="text-muted-foreground">Linked booking ID: {bookingId ?? 'unknown'}</p>
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

function ServiceChips({ services }: { services: TableTimelineResponse['services'] }) {
  if (!services?.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {services.map((service) => (
        <span
          key={service.key}
          className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2 py-1 text-[11px] font-medium text-foreground"
        >
          <span className="uppercase text-[10px] tracking-wide text-muted-foreground">{service.label}</span>
          <span className="text-muted-foreground">{formatTime(service.start)} – {formatTime(service.end)}</span>
        </span>
      ))}
    </div>
  );
}

function buildHourMarkers(windowStart: number | null, windowEnd: number | null, duration: number): HourMarker[] {
  if (windowStart === null || windowEnd === null) return [];
  const markers: HourMarker[] = [
    {
      time: windowStart,
      label: new Date(windowStart).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
      offset: 0,
    },
  ];
  let current = new Date(windowStart);
  current.setMinutes(0, 0, 0);

  while (current.getTime() <= windowEnd) {
    if (current.getTime() >= windowStart) {
      markers.push({
        time: current.getTime(),
        label: current.toLocaleTimeString([], { hour: 'numeric' }),
        offset: ((current.getTime() - windowStart) / duration) * 100,
      });
    }
    current = new Date(current.getTime() + 60 * 60 * 1000);
  }

  markers.push({
    time: windowEnd,
    label: new Date(windowEnd).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
    offset: 100,
  });

  return markers;
}

function getNowOffset(windowStart: number | null, windowEnd: number | null, now: Date) {
  if (windowStart === null || windowEnd === null) return null;
  const nowTime = now.getTime();
  if (nowTime < windowStart || nowTime > windowEnd) return null;
  return ((nowTime - windowStart) / (windowEnd - windowStart)) * 100;
}

function getSegmentPosition(segment: TableTimelineSegment, windowStart: number, windowEnd: number) {
  const startMs = new Date(segment.start).getTime();
  const endMs = new Date(segment.end).getTime();
  const clampedStart = Math.max(startMs, windowStart);
  const clampedEnd = Math.min(endMs, windowEnd);
  const duration = Math.max(windowEnd - windowStart, 1);
  const offset = ((clampedStart - windowStart) / duration) * 100;
  const width = Math.max(((clampedEnd - clampedStart) / duration) * 100, 0);
  return { offset, width };
}

function buildSegmentLabel(segment: TableTimelineSegment, tableNumber: string) {
  const start = formatTime(segment.start);
  const end = formatTime(segment.end);
  if (segment.booking) {
    return `Table ${tableNumber} reserved for ${segment.booking.customerName ?? 'guest'} (${segment.booking.partySize}) from ${start} to ${end}`;
  }
  if (segment.state === 'hold') {
    return `Table ${tableNumber} held from ${start} to ${end}`;
  }
  if (segment.state === 'out_of_service') {
    return `Table ${tableNumber} unavailable`;
  }
  return `Table ${tableNumber} available from ${start} to ${end}`;
}

function formatTime(date: string) {
  return new Date(date).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

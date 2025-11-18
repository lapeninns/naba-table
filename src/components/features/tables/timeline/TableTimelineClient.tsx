'use client';

import { useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useOpsSession } from '@/contexts/ops-session';
import { useOpsTableTimeline } from '@/hooks/ops/useOpsTableTimeline';
import { cn } from '@/lib/utils';

import type { TableTimelineResponse, TableTimelineSegment, TableTimelineSegmentState } from '@/types/ops';

const SERVICE_OPTIONS: Array<{ value: 'all' | 'lunch' | 'dinner'; label: string }> = [
  { value: 'all', label: 'All services' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'dinner', label: 'Dinner' },
];

const STATUS_OPTIONS: Array<{ value: TableTimelineSegmentState; label: string }> = [
  { value: 'reserved', label: 'Reserved' },
  { value: 'hold', label: 'Hold' },
  { value: 'available', label: 'Available' },
  { value: 'out_of_service', label: 'Out of service' },
];

const DEFAULT_STATUS_FILTERS: TableTimelineSegmentState[] = ['reserved', 'hold', 'available', 'out_of_service'];

type SelectedSegment = {
  table: TableTimelineResponse['tables'][number]['table'];
  segment: TableTimelineSegment;
};

type TimeTick = {
  label: string;
  offset: number;
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

  const zones = timeline?.summary?.zones ?? [];
  const statusFilterSet = useMemo(() => new Set<TableTimelineSegmentState>(statusFilters), [statusFilters]);
  const filteredTables = useMemo(() => {
    if (!timeline) return [];
    const query = search.trim().toLowerCase();
    if (!query) {
      return timeline.tables.filter((row) => row.segments.some((segment) => statusFilterSet.has(segment.state)));
    }
    return timeline.tables.filter((row) => {
      const zoneMatch = row.table.zoneName?.toLowerCase().includes(query) ?? false;
      const numberMatch = row.table.tableNumber.toLowerCase().includes(query);
      const statusMatch = row.segments.some((segment) => statusFilterSet.has(segment.state));
      return (zoneMatch || numberMatch) && statusMatch;
    });
  }, [timeline, search, statusFilterSet]);

  const handleStatusChange = (values: string[]) => {
    if (values.length === 0) {
      setStatusFilters(DEFAULT_STATUS_FILTERS);
      return;
    }
    setStatusFilters(values as TableTimelineSegmentState[]);
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
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-2xl border border-border/40 bg-card/60 p-4 shadow-sm md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Restaurant</p>
          <p className="text-lg font-semibold text-foreground">{activeMembership.restaurantName}</p>
        </div>
        <div className="grid w-full gap-3 md:grid-cols-4">
          <div className="space-y-1">
            <Label htmlFor="timeline-date">Service date</Label>
            <Input
              id="timeline-date"
              type="date"
              value={selectedDate ?? ''}
              onChange={(event) => setSelectedDate(event.target.value || null)}
            />
          </div>
          <div className="space-y-1">
            <Label>Zone</Label>
            <Select value={selectedZone ?? 'all'} onValueChange={(value) => setSelectedZone(value === 'all' ? null : value)}>
              <SelectTrigger>
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
            <Label>Service</Label>
            <ToggleGroup
              type="single"
              value={service}
              onValueChange={(value) => value && setService(value as 'all' | 'lunch' | 'dinner')}
              aria-label="Select service window"
            >
              {SERVICE_OPTIONS.map((option) => (
                <ToggleGroupItem key={option.value} value={option.value} aria-label={option.label}>
                  {option.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
          <div className="space-y-1">
            <Label>Status filter</Label>
            <ToggleGroup
              type="multiple"
              value={statusFilters}
              onValueChange={handleStatusChange}
              aria-label="Filter by timeline status"
            >
              {STATUS_OPTIONS.map((option) => (
                <ToggleGroupItem key={option.value} value={option.value} aria-label={option.label}>
                  {option.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4 rounded-2xl border border-border/40 bg-card/60 p-4 shadow-sm md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <Label htmlFor="timeline-search">Search tables</Label>
          <Input
            id="timeline-search"
            placeholder="Search by table number or zone"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>
            Last updated{' '}
            {timelineQuery.dataUpdatedAt ? new Date(timelineQuery.dataUpdatedAt).toLocaleTimeString() : '—'}
          </span>
          <Button variant="outline" size="sm" onClick={() => timelineQuery.refetch()} disabled={timelineQuery.isFetching}>
            Refresh
          </Button>
        </div>
      </div>

      {timelineQuery.isLoading ? (
        <TimelineSkeleton />
      ) : timeline ? (
        <div className="space-y-6">
          <ServiceSummary summary={timeline.summary} />
          <Legend />
          <TimelineGrid
            timeline={timeline}
            tables={filteredTables}
            onSelectSegment={(table, segment) => setSelectedSegment({ table, segment })}
            statusFilterSet={statusFilterSet}
          />
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
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
  );
}

function TimelineSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-24 w-full rounded-xl" />
      <Skeleton className="h-64 w-full rounded-xl" />
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
        </CardContent>
      </Card>
      {summary.serviceCapacities.map((service) => (
        <Card key={service.key}>
          <CardContent className="space-y-1 py-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{service.label}</p>
            <p className="text-2xl font-semibold text-foreground">{service.capacity} seats</p>
            <p className="text-xs text-muted-foreground">
              {service.tablesConsidered} tables · {service.turnsPerTable} turns
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function TimelineGrid({
  timeline,
  tables,
  onSelectSegment,
  statusFilterSet,
}: {
  timeline: TableTimelineResponse;
  tables: TableTimelineResponse['tables'];
  onSelectSegment: (table: TableTimelineResponse['tables'][number]['table'], segment: TableTimelineSegment) => void;
  statusFilterSet: Set<TableTimelineSegmentState>;
}) {
  const windowStart = timeline.window.start ? new Date(timeline.window.start).getTime() : null;
  const windowEnd = timeline.window.end ? new Date(timeline.window.end).getTime() : null;
  const duration = windowStart !== null && windowEnd !== null ? Math.max(windowEnd - windowStart, 1) : 1;
  const ticks = useMemo(() => buildTimeTicks(windowStart, windowEnd, 5), [windowStart, windowEnd]);
  const nowOffset = useMemo(() => getNowOffset(windowStart, windowEnd), [windowStart, windowEnd]);
  const hasTables = tables.length > 0;

  return (
    <div className="rounded-2xl border border-border/40 bg-card/80">
      <div className="grid grid-cols-[200px_minmax(0,1fr)] border-b border-border/40 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <span>Table</span>
        <div className="flex items-center gap-2">
          <span>Timeline</span>
        </div>
      </div>
      <div className="grid grid-cols-[200px_minmax(0,1fr)] items-center border-b border-border/30 px-4 py-3 text-xs text-muted-foreground">
        <span className="text-[11px] uppercase tracking-[0.08em]">Window</span>
        <TimelineScale ticks={ticks} nowOffset={nowOffset} />
      </div>
      <ScrollArea className="max-h-[640px]">
        {hasTables ? (
          <div>
            {tables.map((row) => (
              <div
                key={row.table.id}
                className="grid grid-cols-[200px_minmax(0,1fr)] items-center border-b border-border/15 px-4 py-4 text-sm"
              >
                <div className="space-y-1 pr-4">
                  <p className="font-medium text-foreground">Table {row.table.tableNumber}</p>
                  <p className="text-xs text-muted-foreground">
                    {row.table.capacity} seats · {row.table.zoneName ?? 'No zone'}
                  </p>
                </div>
                <div
                  className="relative"
                  aria-label={`Timeline for table ${row.table.tableNumber}`}
                  role="group"
                >
                  <div className="relative h-12 overflow-hidden rounded-lg border border-border/60 bg-muted/60">
                    <div className="pointer-events-none absolute inset-0">
                      {ticks.map((tick, index) => (
                        <div
                          key={`${tick.label}-${index}`}
                          className="absolute inset-y-0 w-px bg-border/60"
                          style={{ left: `${tick.offset}%` }}
                          aria-hidden
                        />
                      ))}
                      {nowOffset !== null ? (
                        <div
                          className="absolute inset-y-0 w-px bg-primary/70"
                          style={{ left: `${nowOffset}%` }}
                          aria-hidden
                        />
                      ) : null}
                    </div>
                    {row.segments.map((segment, index) => {
                      const startMs = new Date(segment.start).getTime();
                      const endMs = new Date(segment.end).getTime();
                      const offset = ((startMs - (windowStart ?? startMs)) / duration) * 100;
                      const width = Math.max(((endMs - startMs) / duration) * 100, 0);
                      const label = buildSegmentLabel(segment, row.table.tableNumber);
                      const isActiveState = statusFilterSet.has(segment.state);
                      const stateClass = getSegmentClasses(segment.state);
                      return (
                        <button
                          key={`${segment.start}-${segment.end}-${index}`}
                          type="button"
                          className={cn(
                            'absolute top-1/2 flex h-7 -translate-y-1/2 items-center overflow-hidden rounded-full text-xs font-medium shadow-sm transition-[opacity,transform] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
                            stateClass,
                            width < 2 ? 'px-0' : 'px-3',
                            segment.state === 'available' ? 'cursor-default' : 'cursor-pointer',
                            isActiveState ? 'opacity-100' : 'opacity-35',
                          )}
                          style={{ left: `${offset}%`, width: `${width}%` }}
                          onClick={() => (segment.state === 'available' ? null : onSelectSegment(row.table, segment))}
                          aria-label={label}
                          disabled={segment.state === 'available'}
                        >
                          {segment.booking?.customerName
                            ? truncate(segment.booking.customerName, 18)
                            : segment.state === 'available'
                              ? 'Available'
                              : segment.state}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="px-4 py-8 text-sm text-muted-foreground">No tables match the current filters.</div>
        )}
      </ScrollArea>
    </div>
  );
}

function buildSegmentLabel(segment: TableTimelineSegment, tableNumber: string) {
  const start = new Date(segment.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const end = new Date(segment.end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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

function truncate(value: string, max: number) {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
}

function buildTimeTicks(windowStart: number | null, windowEnd: number | null, divisions = 5): TimeTick[] {
  if (windowStart === null || windowEnd === null || windowEnd <= windowStart) return [];
  const ticks: TimeTick[] = [];
  const step = (windowEnd - windowStart) / divisions;
  for (let index = 0; index <= divisions; index += 1) {
    const timestamp = windowStart + step * index;
    ticks.push({
      label: new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      offset: (index / divisions) * 100,
    });
  }
  return ticks;
}

function getNowOffset(windowStart: number | null, windowEnd: number | null) {
  if (windowStart === null || windowEnd === null) return null;
  const now = Date.now();
  if (now < windowStart || now > windowEnd) return null;
  return ((now - windowStart) / (windowEnd - windowStart)) * 100;
}

function getSegmentClasses(state: TableTimelineSegmentState) {
  switch (state) {
    case 'reserved':
      return 'bg-emerald-600 text-white';
    case 'hold':
      return 'bg-amber-500 text-slate-950';
    case 'out_of_service':
      return 'bg-slate-500 text-white';
    case 'available':
    default:
      return 'bg-background text-foreground/80 border border-border/60 shadow-none';
  }
}

function TimelineScale({ ticks, nowOffset }: { ticks: TimeTick[]; nowOffset: number | null }) {
  return (
    <div className="relative flex h-10 items-center overflow-hidden rounded-lg border border-border/50 bg-muted/60 px-2">
      {ticks.map((tick, index) => (
        <div key={`${tick.label}-${index}`} className="absolute inset-y-0" style={{ left: `${tick.offset}%` }}>
          <div className="absolute inset-y-0 w-px bg-border/70" aria-hidden />
          <span className="absolute left-1/2 top-2 -translate-x-1/2 text-[11px] font-medium text-foreground">{tick.label}</span>
        </div>
      ))}
      {nowOffset !== null ? (
        <div
          className="absolute inset-y-0 w-px bg-primary"
          style={{ left: `${nowOffset}%` }}
          aria-label="Current time"
        />
      ) : null}
    </div>
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
  const open = Boolean(selected);
  const start = selected ? new Date(selected.segment.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
  const end = selected ? new Date(selected.segment.end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
  const holdId = selected?.segment.hold?.id ?? null;
  const bookingId = selected?.segment.hold?.bookingId ?? selected?.segment.booking?.id ?? null;

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent>
        {selected ? (
          <>
            <DialogHeader>
              <DialogTitle>Table {selected.table.tableNumber}</DialogTitle>
              <DialogDescription>
                {start} – {end}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              {selected.segment.booking ? (
                <div>
                  <p className="text-sm font-semibold text-foreground">{selected.segment.booking.customerName ?? 'Guest'}</p>
                  <p className="text-sm text-muted-foreground">
                    Party of {selected.segment.booking.partySize} · Status {selected.segment.booking.status}
                  </p>
                </div>
              ) : selected.segment.state === 'hold' && holdId ? (
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-foreground">Table is on hold</p>
                  <p className="text-sm text-muted-foreground">
                    Linked booking ID: {bookingId ?? 'unknown'}
                  </p>
                </div>
              ) : selected.segment.state === 'hold' ? (
                <p className="text-sm text-muted-foreground">Table is held for a pending assignment.</p>
              ) : (
                <p className="text-sm text-muted-foreground">Table is unavailable.</p>
              )}
            </div>
            {selected.segment.booking ? (
              <div className="flex gap-2">
                <Button asChild className="flex-1">
                  <a href={`/ops/bookings?query=${selected.segment.booking.customerName ?? ''}`}>View booking</a>
                </Button>
              </div>
            ) : selected.segment.state === 'hold' ? (
              <div className="space-y-2">
                <Button
                  className="w-full"
                  variant="outline"
                  disabled={!holdId || !bookingId || actionState.releasing}
                  onClick={() => holdId && onReleaseHold(holdId, bookingId)}
                >
                  {actionState.releasing ? 'Releasing hold…' : 'Release hold'}
                </Button>
                {actionState.error ? <p className="text-xs text-destructive">{actionState.error}</p> : null}
                {!bookingId ? (
                  <p className="text-xs text-muted-foreground">Cannot release without a booking reference.</p>
                ) : null}
              </div>
            ) : null}
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
      <LegendItem color="bg-emerald-500" label="Reserved" />
      <LegendItem color="bg-amber-500" label="Hold" />
      <LegendItem color="bg-slate-400" label="Out of service" />
      <LegendItem color="bg-background/40 border border-border/60 text-foreground/70" label="Available" />
    </div>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className={cn('h-3 w-3 rounded-full', color)} aria-hidden />
      <span>{label}</span>
    </span>
  );
}

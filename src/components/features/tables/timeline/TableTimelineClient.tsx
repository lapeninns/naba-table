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

import type { TableTimelineResponse, TableTimelineSegment } from '@/types/ops';

const SERVICE_OPTIONS: Array<{ value: 'all' | 'lunch' | 'dinner'; label: string }> = [
  { value: 'all', label: 'All services' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'dinner', label: 'Dinner' },
];

type SelectedSegment = {
  table: TableTimelineResponse['tables'][number]['table'];
  segment: TableTimelineSegment;
};

export function TableTimelineClient() {
  const { activeRestaurantId, activeMembership } = useOpsSession();
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const [service, setService] = useState<'all' | 'lunch' | 'dinner'>('all');
  const [search, setSearch] = useState('');
  const [selectedSegment, setSelectedSegment] = useState<SelectedSegment | null>(null);

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
  const filteredTables = useMemo(() => {
    if (!timeline) return [];
    const query = search.trim().toLowerCase();
    if (!query) {
      return timeline.tables;
    }
    return timeline.tables.filter((row) => {
      const zoneMatch = row.table.zoneName?.toLowerCase().includes(query) ?? false;
      const numberMatch = row.table.tableNumber.toLowerCase().includes(query);
      return zoneMatch || numberMatch;
    });
  }, [timeline, search]);

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
        <div className="grid w-full gap-3 md:grid-cols-3">
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
            <Select value={service} onValueChange={(value: 'all' | 'lunch' | 'dinner') => setService(value)}>
              <SelectTrigger>
                <SelectValue />
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
          <TimelineGrid
            timeline={timeline}
            tables={filteredTables}
            onSelectSegment={(table, segment) => setSelectedSegment({ table, segment })}
          />
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Unable to load table timeline. Please try again.
          </CardContent>
        </Card>
      )}

      <SegmentDialog selected={selectedSegment} onClose={() => setSelectedSegment(null)} />
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
}: {
  timeline: TableTimelineResponse;
  tables: TableTimelineResponse['tables'];
  onSelectSegment: (table: TableTimelineResponse['tables'][number]['table'], segment: TableTimelineSegment) => void;
}) {
  const windowStart = timeline.window.start ? new Date(timeline.window.start).getTime() : null;
  const windowEnd = timeline.window.end ? new Date(timeline.window.end).getTime() : null;
  const duration = windowStart !== null && windowEnd !== null ? Math.max(windowEnd - windowStart, 1) : 1;

  return (
    <div className="rounded-2xl border border-border/40 bg-card/80">
      <div className="grid grid-cols-[200px_minmax(0,1fr)] border-b border-border/40 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <span>Table</span>
        <div className="flex items-center gap-2">
          <span>Timeline</span>
        </div>
      </div>
      <ScrollArea className="max-h-[600px]">
        <div>
          {tables.map((row) => (
            <div key={row.table.id} className="grid grid-cols-[200px_minmax(0,1fr)] border-b border-border/20 px-4 py-3 text-sm">
              <div className="space-y-1">
                <p className="font-medium text-foreground">Table {row.table.tableNumber}</p>
                <p className="text-xs text-muted-foreground">
                  {row.table.capacity} seats · {row.table.zoneName ?? 'No zone'}
                </p>
              </div>
              <div className="relative" aria-label={`Timeline for table ${row.table.tableNumber}`}>
                <div className="h-10 w-full rounded-full bg-muted" />
                {row.segments.map((segment, index) => {
                  const startMs = new Date(segment.start).getTime();
                  const endMs = new Date(segment.end).getTime();
                  const offset = ((startMs - (windowStart ?? startMs)) / duration) * 100;
                  const width = Math.max(((endMs - startMs) / duration) * 100, 0);
                  const colorClass = segment.state === 'reserved'
                    ? 'bg-emerald-500'
                    : segment.state === 'hold'
                      ? 'bg-amber-500'
                      : segment.state === 'out_of_service'
                        ? 'bg-slate-400'
                        : 'bg-background/40';
                  const label = buildSegmentLabel(segment, row.table.tableNumber);
                  return (
                    <button
                      key={`${segment.start}-${segment.end}-${index}`}
                      type="button"
                      className={cn(
                        'absolute top-1/2 h-6 -translate-y-1/2 rounded-full text-xs font-medium text-white shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
                        colorClass,
                        width < 2 ? 'px-0' : 'px-2',
                        segment.state === 'available' ? 'cursor-default text-foreground/70' : 'cursor-pointer',
                      )}
                      style={{ left: `${offset}%`, width: `${width}%` }}
                      onClick={() => segment.state === 'available' ? null : onSelectSegment(row.table, segment)}
                      aria-label={label}
                      disabled={segment.state === 'available'}
                    >
                      {segment.booking?.customerName ? truncate(segment.booking.customerName, 14) : segment.state}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
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

function SegmentDialog({ selected, onClose }: { selected: SelectedSegment | null; onClose: () => void }) {
  const open = Boolean(selected);
  const start = selected ? new Date(selected.segment.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
  const end = selected ? new Date(selected.segment.end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

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
            ) : null}
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

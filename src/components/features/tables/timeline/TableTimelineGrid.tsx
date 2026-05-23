'use client';

import { MapPin, Users } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

import {
  clampToServiceWindow,
  SLOT_WIDTH_PX,
  STATUS_META,
  TIME_SLOTS,
  timeToPositionPx,
  toHHMM,
} from './tableTimelineDomain';

import type {
  TableTimelineResponse,
  TableTimelineSegment,
  TableTimelineSegmentState,
} from '@/types/ops';
import type { MutableRefObject } from 'react';

export function TimelineSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-24 w-full rounded-xl" />
      <Skeleton className="h-80 w-full rounded-xl" />
    </div>
  );
}

export function TableTimelineGrid({
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
  scrollRef: MutableRefObject<HTMLDivElement | null>;
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
            <TableTimelineRow
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

function TableTimelineRow({
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
          className="absolute inset-y-0 z-20 w-px bg-rose-500"
          style={{ left: `${nowPx}px` }}
          aria-hidden
        >
          <div className="absolute -top-1 -left-1 h-2 w-2 rounded-full bg-rose-500 shadow" />
        </div>

        {segments
          .filter((segment) => segment.state !== 'available')
          .map((segment, idx) => (
            <ReservationBlock
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

function ReservationBlock({
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
    reserved: 'bg-blue-600 text-white border-blue-700',
    hold: 'bg-amber-500 text-slate-950 border-amber-600',
    available: 'bg-muted text-muted-foreground border-border',
    out_of_service: 'bg-slate-500 text-white border-slate-600',
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
      type="button"
      variant="ghost"
      onClick={onClick}
      className={cn(
        'absolute top-2 h-10 justify-start rounded-lg border-l-4 px-3 text-left shadow-sm transition hover:brightness-110',
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

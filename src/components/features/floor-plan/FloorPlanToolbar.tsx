'use client';

import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Hourglass,
  Loader2,
  Move,
  PencilRuler,
  RefreshCw,
  TriangleAlert,
} from 'lucide-react';
import { DateTime } from 'luxon';
import Link from 'next/link';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Heading } from '@/components/ui/typography';
import { opsHref } from '@/lib/url/opsHref';
import { cn } from '@/lib/utils';

import { isLiveDate, isShowingNow, servicesForToolbar } from './model/floorPlanState';
import {
  MINUTE_MS,
  addDaysToDate,
  formatClock,
  formatDuration,
  formatLongDate,
  formatShortDate,
} from './model/floorPlanTime';

import type { FloorServiceFilter } from './model/floorPlanTypes';
import type { FloorPlanController, FloorView, StatFilter } from './useFloorPlanController';

/** Settings page where admins arrange the saved floor layout. */
export const FLOOR_LAYOUT_SETTINGS_HREF = opsHref('/settings/restaurant/table-layout');

const segmentClass =
  'h-8 min-h-0 min-w-0 px-3 text-sm data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow-sm';

function relativeLabel(fp: FloorPlanController): string {
  const { snapshot, ctx, today } = fp;
  if (!snapshot) return '';
  if (snapshot.date < today) return 'Past date · read-only';
  if (snapshot.date > today) return 'Planning view';
  if (isShowingNow(snapshot, ctx)) return 'Now';
  return ctx.atMs > ctx.nowMs
    ? `In ${formatDuration(ctx.atMs - ctx.nowMs)}`
    : `${formatDuration(ctx.nowMs - ctx.atMs)} ago · read-only`;
}

function CoversHistogram({ fp }: { fp: FloorPlanController }) {
  const { snapshot, serviceWindow: w } = fp;
  if (!snapshot || !w) return null;
  const seats =
    snapshot.tables.filter((t) => !t.outOfService).reduce((s, t) => s + t.capacity, 0) || 1;
  const bookings = snapshot.bookings.filter(
    (b) =>
      b.startMs >= w.startMs &&
      b.startMs < w.endMs &&
      b.status !== 'cancelled' &&
      b.status !== 'no_show',
  );
  const bars: Array<{ total: number; arrived: number }> = [];
  for (let m = w.startMs; m < w.endMs; m += 15 * MINUTE_MS) {
    const mid = m + 7.5 * MINUTE_MS;
    const at = bookings.filter((b) => b.startMs <= mid && mid < b.endMs);
    bars.push({
      total: at.reduce((s, b) => s + b.partySize, 0),
      arrived: at
        .filter((b) => b.status === 'checked_in' || b.status === 'completed')
        .reduce((s, b) => s + b.partySize, 0),
    });
  }
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-2.5 bottom-3 top-0 flex items-end gap-px"
    >
      {bars.map((bar, i) => {
        const h = Math.max(6, Math.min(100, (bar.total / seats) * 100));
        return (
          <span key={i} className="flex h-full flex-1 flex-col justify-end">
            <i
              className="block bg-muted-foreground/20"
              style={{ height: `${bar.total ? (h * (bar.total - bar.arrived)) / bar.total : h}%` }}
            />
            <i
              className="block bg-primary/40"
              style={{ height: `${bar.total ? (h * bar.arrived) / bar.total : 0}%` }}
            />
          </span>
        );
      })}
    </div>
  );
}

function TimeScrubber({ fp }: { fp: FloorPlanController }) {
  const { snapshot, serviceWindow: w, ctx } = fp;
  if (!snapshot || !w) return null;
  const span = w.endMs - w.startMs;
  const value = Math.max(
    w.startMs,
    Math.min(w.endMs, Math.round(ctx.atMs / (5 * MINUTE_MS)) * 5 * MINUTE_MS),
  );
  const nowIn = isLiveDate(snapshot, ctx) && ctx.nowMs >= w.startMs && ctx.nowMs <= w.endMs;
  const ticks: number[] = [];
  for (let h = Math.ceil(w.startMs / 3_600_000) * 3_600_000; h <= w.endMs; h += 3_600_000)
    ticks.push(h);
  const rel = relativeLabel(fp);
  const showingNow = isShowingNow(snapshot, ctx);

  return (
    <div className="flex min-w-0 flex-1 basis-full items-center gap-3 sm:basis-0">
      <div className="w-24 shrink-0 leading-tight">
        <span className="block font-mono text-base font-semibold">
          {formatClock(ctx.atMs, fp.timezone)}
        </span>
        <span className="block truncate text-xs text-muted-foreground">{rel}</span>
      </div>
      <div className="relative h-12 min-w-0 flex-1">
        <CoversHistogram fp={fp} />
        {nowIn ? (
          <span
            aria-hidden
            className="absolute bottom-3 top-0 w-0.5 bg-destructive"
            style={{ left: `calc(10px + (100% - 20px) * ${(ctx.nowMs - w.startMs) / span})` }}
          />
        ) : null}
        <div
          aria-hidden
          className="absolute inset-x-2.5 bottom-0 hidden h-3 font-mono text-[10px] text-muted-foreground sm:block"
        >
          {ticks.map((t) => (
            <span
              key={t}
              className="absolute -translate-x-1/2 whitespace-nowrap"
              style={{ left: `${((t - w.startMs) / span) * 100}%` }}
            >
              {formatClock(t, fp.timezone)}
            </span>
          ))}
        </div>
        <Slider
          className="absolute inset-x-0 bottom-3"
          min={w.startMs}
          max={w.endMs}
          step={5 * MINUTE_MS}
          value={value}
          onValueChange={fp.actions.scrubTo}
          aria-label="Time in service"
          aria-valuetext={`${formatClock(ctx.atMs, fp.timezone)}, ${rel}`}
        />
      </div>
      <Button size="sm" variant="outline" disabled={showingNow} onClick={fp.actions.goToNow}>
        Now
      </Button>
    </div>
  );
}

function DatePicker({ fp }: { fp: FloorPlanController }) {
  const [open, setOpen] = useState(false);
  const isToday = fp.date === fp.today;
  const go = (next: string) => fp.actions.goToDate(next === fp.today ? null : next);
  return (
    <div className="flex items-center gap-1">
      <Button
        size="icon-sm"
        variant="outline"
        aria-label="Previous day"
        onClick={() => go(addDaysToDate(fp.date, -1))}
      >
        <ChevronLeft />
      </Button>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            size="sm"
            variant="outline"
            aria-label={`Date: ${formatLongDate(fp.date)}${isToday ? ', today' : ''}`}
          >
            <CalendarDays aria-hidden />
            <span>{formatShortDate(fp.date)}</span>
            {isToday ? <Badge variant="secondary">Today</Badge> : null}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-2">
          <Calendar
            mode="single"
            selected={DateTime.fromISO(fp.date).toJSDate()}
            onSelect={(day) => {
              if (!day) return;
              go(DateTime.fromJSDate(day).toISODate() ?? fp.date);
              setOpen(false);
            }}
          />
          <div className="flex gap-2 p-1">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                go(fp.today);
                setOpen(false);
              }}
            >
              Today
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                go(addDaysToDate(fp.today, 1));
                setOpen(false);
              }}
            >
              Tomorrow
            </Button>
          </div>
        </PopoverContent>
      </Popover>
      <Button
        size="icon-sm"
        variant="outline"
        aria-label="Next day"
        onClick={() => go(addDaysToDate(fp.date, 1))}
      >
        <ChevronRight />
      </Button>
    </div>
  );
}

/** In the toolbar, not over the canvas: the narrow-screen sheet and the phone list can't hide it. */
function LayoutSaveBar({ fp }: { fp: FloorPlanController }) {
  const n = fp.dirtyIds.length;
  const failed = Object.keys(fp.saveErrors).length;
  if (fp.mode !== 'arrange' || (!n && !failed)) return null;
  return (
    <div
      role="region"
      aria-label="Unsaved layout"
      className="flex flex-wrap items-center gap-2 rounded-lg border bg-card px-3 py-1.5 text-sm"
    >
      <b>
        {n} unsaved layout {n === 1 ? 'change' : 'changes'}
      </b>
      <Button
        size="sm"
        variant="ghost"
        disabled={fp.isSavingLayout}
        onClick={fp.actions.discardLayout}
      >
        Discard
      </Button>
      <Button
        size="sm"
        disabled={fp.isSavingLayout || n === 0}
        onClick={() => void fp.actions.saveLayout()}
      >
        {fp.isSavingLayout ? <Loader2 className="animate-spin" aria-hidden /> : null}
        {fp.isSavingLayout ? 'Saving layout…' : 'Save layout'}
      </Button>
      {failed ? (
        <p role="alert" className="flex w-full items-center gap-1.5 text-destructive">
          <TriangleAlert className="size-4" aria-hidden />
          {failed} {failed === 1 ? 'table wasn’t' : 'tables weren’t'} saved:{' '}
          {Object.values(fp.saveErrors)[0]} Try again.
        </p>
      ) : null}
    </div>
  );
}

export function FloorPlanToolbar({ fp }: { fp: FloorPlanController }) {
  const { snapshot, data, mode } = fp;
  const services = snapshot ? servicesForToolbar(snapshot) : [];
  const arrange = mode === 'arrange';
  const updated = data.updatedAt ? formatClock(data.updatedAt, fp.timezone) : null;

  return (
    <div className="shrink-0 space-y-2 border-b bg-background px-[var(--pg-gutter,1rem)] py-3">
      <div className="flex flex-wrap items-center gap-2">
        {arrange ? (
          // The settings chrome owns the Floor layout heading; no service controls here.
          <>
            <LayoutSaveBar fp={fp} />
            <span className="flex-1" />
          </>
        ) : (
          <>
            <Heading as="h1" variant="title" className="mr-2">
              Floor plan
            </Heading>
            <DatePicker fp={fp} />
            {services.length > 1 ? (
              <ToggleGroup
                type="single"
                value={fp.service}
                onValueChange={(v) => v && fp.actions.chooseService(v as FloorServiceFilter)}
                aria-label="Service"
                className="rounded-lg bg-muted p-0.5"
              >
                {services.map((s) => (
                  <ToggleGroupItem key={s.key} value={s.key} className={segmentClass}>
                    {s.label}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            ) : null}
            <span className="flex-1" />
            <ToggleGroup
              type="single"
              value={fp.view}
              onValueChange={(v) => v && fp.actions.setView(v as FloorView)}
              aria-label="View"
              className="hidden rounded-lg bg-muted p-0.5 sm:flex"
            >
              <ToggleGroupItem value="plan" className={segmentClass}>
                Plan
              </ToggleGroupItem>
              <ToggleGroupItem value="timeline" className={segmentClass}>
                Timeline
              </ToggleGroupItem>
            </ToggleGroup>
            {fp.canArrange ? (
              <Button asChild size="sm" variant="outline" className="hidden sm:inline-flex">
                <Link href={FLOOR_LAYOUT_SETTINGS_HREF}>
                  <PencilRuler aria-hidden />
                  Edit layout
                </Link>
              </Button>
            ) : null}
          </>
        )}
        <div role="status" className="flex items-center gap-1 text-xs text-muted-foreground">
          <span>{data.isRefreshing ? 'Refreshing…' : updated ? `Updated ${updated}` : ''}</span>
          <Button
            size="sm"
            variant="ghost"
            disabled={data.isRefreshing || data.status === 'loading'}
            onClick={() => void fp.actions.refresh()}
            aria-label={arrange ? 'Refresh tables' : 'Refresh bookings'}
          >
            <RefreshCw className={cn(data.isRefreshing && 'animate-spin')} aria-hidden />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        </div>
      </div>
      {snapshot && data.status === 'ready' ? (
        <div className="flex flex-wrap items-center gap-3">
          {arrange ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Move className="size-4" aria-hidden />
              <span>
                <b className="text-foreground">Arranging the layout.</b> Drag tables within their
                zone. Arrow keys nudge, R rotates 15°. Bookings are not affected.
              </span>
            </p>
          ) : fp.serviceWindow ? (
            <TimeScrubber fp={fp} />
          ) : null}
          {snapshot.zones.length > 1 ? (
            <Select value={fp.zoneFilter} onValueChange={fp.actions.setZoneFilter}>
              <SelectTrigger className="h-8 w-40" aria-label="Zone">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All zones</SelectItem>
                {[...snapshot.zones]
                  .sort((a, b) => a.sortOrder - b.sortOrder)
                  .map((z) => (
                    <SelectItem key={z.id} value={z.id}>
                      {z.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function FloorPlanSummary({ fp }: { fp: FloorPlanController }) {
  const { counts, needs, ctx, snapshot } = fp;
  if (!counts || !snapshot || fp.mode !== 'service') return null;
  const when = isShowingNow(snapshot, ctx) ? 'now' : `at ${formatClock(ctx.atMs, fp.timezone)}`;
  const items: Array<{
    key: StatFilter;
    label: string;
    value: React.ReactNode;
    detail: React.ReactNode;
    aria: string;
    warn?: boolean;
  }> = [
    {
      key: 'seated',
      label: 'Covers seated',
      value: (
        <>
          {counts.seatedCovers}
          <small className="ml-1 text-sm font-normal text-muted-foreground">
            / {counts.expectedCovers}
          </small>
        </>
      ),
      detail: (
        <span className="mt-1 block h-1 overflow-hidden rounded-full bg-border">
          <span
            className="block h-full rounded-full bg-primary"
            style={{
              width: `${counts.expectedCovers ? Math.round((counts.seatedCovers / counts.expectedCovers) * 100) : 0}%`,
            }}
          />
        </span>
      ),
      aria: `${counts.seatedCovers} of ${counts.expectedCovers} expected covers seated`,
    },
    {
      key: 'free',
      label: `Tables free ${when}`,
      value: counts.freeTables,
      detail: `${counts.freeSeats} seats open`,
      aria: `${counts.freeTables} tables free ${when}, ${counts.freeSeats} seats`,
    },
    {
      key: 'awaiting',
      label: 'Awaiting a table',
      value: counts.awaiting,
      detail: needs.length
        ? `${counts.awaitingCovers} covers · first ${formatClock(needs[0]!.startMs, fp.timezone)}`
        : 'Everyone has a table',
      aria: `${counts.awaiting} bookings awaiting a table`,
    },
    {
      key: 'over',
      label: 'Over time',
      value: (
        <span className="flex items-center gap-1">
          {counts.overTables.length ? <Hourglass className="size-5" aria-hidden /> : null}
          {counts.overTables.length}
        </span>
      ),
      detail: counts.overTables.length ? counts.overTables.join(', ') : 'None',
      aria: `${counts.overTables.length} tables over time${counts.overTables.length ? `: ${counts.overTables.join(', ')}` : ''}`,
      warn: counts.overTables.length > 0,
    },
  ];

  return (
    <div
      role="group"
      aria-label="Service summary. Each figure filters the plan."
      className="grid shrink-0 grid-cols-2 gap-2 border-b px-[var(--pg-gutter,1rem)] py-2 md:grid-cols-4"
    >
      {items.map((item) => {
        const on = fp.statFilter === item.key;
        return (
          <Button
            key={item.key}
            variant="outline"
            aria-pressed={on}
            aria-label={`${item.aria}. ${on ? 'Filter on. Select to clear.' : 'Select to filter the plan.'}`}
            onClick={() => fp.actions.setStatFilter(on ? null : item.key)}
            className={cn(
              'h-auto flex-col items-stretch gap-0 whitespace-normal px-3 py-2 text-left font-normal',
              on && 'border-primary bg-primary/5 ring-2 ring-primary/20',
              item.warn && 'border-destructive/50 text-destructive',
            )}
          >
            <span className="truncate text-xs text-muted-foreground">{item.label}</span>
            <span className="text-xl font-semibold tabular-nums">{item.value}</span>
            <span className="truncate text-xs text-muted-foreground">{item.detail}</span>
          </Button>
        );
      })}
    </div>
  );
}

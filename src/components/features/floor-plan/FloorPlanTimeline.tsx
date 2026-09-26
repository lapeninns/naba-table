'use client';

import { ChevronRight } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { matchesStatFilter } from './FloorPlanCanvas';
import { BOOKING_STATUS_LABELS, STATE_STYLES } from './floorPlanStyles';
import { compareTableNumbers } from './model/floorPlanLayout';
import {
  checkTableForBooking,
  inService,
  isLiveDate,
  tableNumbers,
  zoneSeatCounts,
} from './model/floorPlanState';
import { MINUTE_MS, formatClock } from './model/floorPlanTime';

import type { FloorPlanController } from './useFloorPlanController';

/** Gantt-style view: one row per table, bars for each booking this service. */
export function FloorPlanTimeline({ fp }: { fp: FloorPlanController }) {
  const { snapshot, serviceWindow: w, ctx } = fp;
  if (!snapshot || !w) return null;
  const span = w.endMs - w.startMs;
  const pct = (ms: number) => `${(((ms - w.startMs) / span) * 100).toFixed(3)}%`;
  const halfHours: number[] = [];
  for (
    let m = Math.ceil(w.startMs / (30 * MINUTE_MS)) * 30 * MINUTE_MS;
    m <= w.endMs;
    m += 30 * MINUTE_MS
  )
    halfHours.push(m);
  const live = isLiveDate(snapshot, ctx);
  const zones = [...snapshot.zones]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .filter((z) => fp.zoneFilter === 'all' || fp.zoneFilter === z.id);

  const grid = halfHours.map((m) => (
    <i
      key={m}
      aria-hidden
      className="absolute inset-y-0 w-px bg-border/70"
      style={{ left: pct(m) }}
    />
  ));
  const timeLine =
    ctx.atMs >= w.startMs && ctx.atMs <= w.endMs ? (
      <i
        aria-hidden
        className="absolute inset-y-0 z-10 w-0.5 bg-foreground"
        style={{ left: pct(ctx.atMs) }}
      />
    ) : null;

  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <div className="min-w-[760px] pb-4">
        <div className="sticky top-0 z-20 grid grid-cols-[96px_minmax(0,1fr)] border-b bg-background">
          <div className="px-3 py-2 text-xs font-medium text-muted-foreground">Table</div>
          <div className="relative h-8">
            {halfHours
              .filter((m) => m % (60 * MINUTE_MS) === 0)
              .map((m) => (
                <span
                  key={m}
                  className="absolute top-2 -translate-x-1/2 font-mono text-xs text-muted-foreground"
                  style={{ left: pct(m) }}
                >
                  {formatClock(m, fp.timezone)}
                </span>
              ))}
          </div>
        </div>
        {zones.map((zone) => {
          const seats = zoneSeatCounts(snapshot, fp.states, zone.id);
          const tables = snapshot.tables
            .filter((t) => t.zoneId === zone.id && matchesStatFilter(fp, t))
            .sort(compareTableNumbers);
          if (tables.length === 0) return null;
          return (
            <section key={zone.id} aria-label={zone.name}>
              <h2 className="sticky left-0 bg-muted/50 px-3 py-1.5 text-xs font-semibold">
                {zone.name}{' '}
                <span className="font-normal text-muted-foreground">
                  {seats.seated} / {seats.seats} seated
                </span>
              </h2>
              {tables.map((table) => {
                const bookings = snapshot.bookings.filter(
                  (b) =>
                    b.tableIds.includes(table.id) && inService(b, w) && b.status !== 'cancelled',
                );
                return (
                  <div
                    key={table.id}
                    className={cn(
                      'grid grid-cols-[96px_minmax(0,1fr)] border-b',
                      fp.selectedTableId === table.id && 'bg-primary/5',
                    )}
                  >
                    <Button
                      variant="ghost"
                      className="h-10 min-h-0 justify-start rounded-none px-3 font-mono"
                      onClick={() => fp.actions.selectTable(table.id)}
                    >
                      {table.number}
                      <span className="font-sans text-xs font-normal text-muted-foreground">
                        {table.capacity}
                      </span>
                    </Button>
                    <div className={cn('relative h-10', table.outOfService && 'bg-muted/60')}>
                      {grid}
                      {bookings.map((b) => {
                        const over = b.status === 'checked_in' && live && ctx.nowMs > b.endMs;
                        const end = Math.min(w.endMs, over ? ctx.nowMs : b.endMs);
                        const start = Math.max(w.startMs, b.startMs);
                        const kind =
                          b.status === 'checked_in'
                            ? over
                              ? 'over'
                              : 'seated'
                            : b.status === 'completed'
                              ? 'seated'
                              : 'due';
                        return (
                          <Button
                            key={b.id}
                            variant="ghost"
                            onClick={() => fp.actions.focusBooking(b.id, table.id)}
                            aria-label={`${b.name}, ${b.partySize} guests, ${formatClock(b.startMs, fp.timezone)} to ${formatClock(b.endMs, fp.timezone)}, ${BOOKING_STATUS_LABELS[b.status] ?? b.status}${over ? ', over time' : ''}, table ${tableNumbers(snapshot, b.tableIds)}`}
                            className={cn(
                              'absolute top-1.5 h-7 min-h-0 min-w-0 justify-start overflow-hidden rounded-md px-2 text-xs font-medium',
                              STATE_STYLES[kind].bar,
                              (b.status === 'completed' || b.status === 'no_show') && 'opacity-45',
                              b.status === 'no_show' && 'line-through',
                            )}
                            style={{
                              left: pct(start),
                              width: `calc(${pct(end + w.startMs - start)} - 2px)`,
                            }}
                          >
                            <span className="truncate">
                              {b.name} · {b.partySize}
                            </span>
                          </Button>
                        );
                      })}
                      {timeLine}
                    </div>
                  </div>
                );
              })}
            </section>
          );
        })}
      </div>
    </div>
  );
}

/** Accessible list of tables by zone; the phone layout and the "List" toggle. */
export function FloorPlanList({ fp, withNeeds }: { fp: FloorPlanController; withNeeds: boolean }) {
  const { snapshot, serviceLayout, pick, ctx } = fp;
  if (!snapshot || !serviceLayout) return null;
  const refBooking = pick ? fp.bookingById.get(pick.bookingId) : null;
  const zones = [...snapshot.zones]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .filter((z) => fp.zoneFilter === 'all' || fp.zoneFilter === z.id);

  return (
    <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-[var(--pg-gutter,1rem)] py-3">
      {withNeeds && fp.needs.length ? (
        <p className="rounded-lg border bg-card p-3 text-sm">
          <b>{fp.needs.length}</b> {fp.needs.length === 1 ? 'booking needs' : 'bookings need'} a
          table. Open the panel below to assign.
        </p>
      ) : null}
      {zones.map((zone) => {
        const seats = zoneSeatCounts(snapshot, fp.states, zone.id);
        const tables = snapshot.tables
          .filter((t) => t.zoneId === zone.id && matchesStatFilter(fp, t))
          .sort(compareTableNumbers);
        return (
          <section key={zone.id} aria-label={zone.name} className="space-y-2">
            <h2 className="flex items-baseline gap-2 text-sm font-semibold">
              {zone.name}
              <span className="text-xs font-normal text-muted-foreground">
                {seats.seated} / {seats.seats} seated
              </span>
            </h2>
            <ul className="divide-y rounded-lg border bg-card">
              {tables.length === 0 ? (
                <li className="p-3 text-sm text-muted-foreground">No tables match this filter.</li>
              ) : null}
              {tables.map((table) => {
                const state = fp.states.get(table.id);
                if (!state) return null;
                const style = STATE_STYLES[state.kind];
                const Icon = style.icon;
                const fit = refBooking
                  ? checkTableForBooking(snapshot, table, refBooking, ctx, serviceLayout)
                  : null;
                const sub = [
                  `${table.capacity} seats`,
                  state.booking ? `${state.booking.name} · ${state.booking.partySize}` : '',
                  state.sub && state.sub !== state.booking?.name ? state.sub : '',
                  state.booking && state.booking.tableIds.length > 1
                    ? `Joined ${tableNumbers(snapshot, state.booking.tableIds)}`
                    : '',
                  fit ? (fit.ok ? fit.label : fit.reason) : '',
                ]
                  .filter(Boolean)
                  .join(' · ');
                return (
                  <li key={table.id}>
                    <Button
                      variant="ghost"
                      aria-current={fp.selectedTableId === table.id ? 'true' : undefined}
                      onClick={() => fp.actions.selectTable(table.id)}
                      className={cn(
                        'h-auto w-full justify-start gap-3 whitespace-normal rounded-none px-3 py-2.5 text-left font-normal',
                        fit && !fit.ok && 'opacity-55',
                      )}
                    >
                      <span
                        className={cn(
                          'grid size-10 shrink-0 place-items-center rounded-md border-2 font-mono text-sm font-semibold',
                          style.tile,
                        )}
                      >
                        {table.number}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span
                          className={cn('flex items-center gap-1 text-sm font-medium', style.tone)}
                        >
                          <Icon className="size-4" aria-hidden />
                          {state.text}
                        </span>
                        <span className="block text-xs text-muted-foreground">{sub}</span>
                      </span>
                      <ChevronRight className="text-muted-foreground" aria-hidden />
                    </Button>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

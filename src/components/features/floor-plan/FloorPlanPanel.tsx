'use client';

import {
  ChevronDown,
  ChevronUp,
  Combine,
  ExternalLink,
  GripVertical,
  Loader2,
  Move,
  RotateCcw,
  RotateCw,
  Scan,
  TriangleAlert,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

import { BOOKING_STATUS_LABELS, STATE_STYLES, TAG_ICONS, TAG_TONES } from './floorPlanStyles';
import {
  arrivingSoon,
  bestFitForBooking,
  bookingActions,
  bookingsOnTable,
  checkTableForBooking,
  inService,
  isLiveDate,
  tableNumbers,
} from './model/floorPlanState';
import { formatClock, formatShortDate } from './model/floorPlanTime';

import type { FloorBooking, FloorTable } from './model/floorPlanTypes';
import type { FloorPlanController } from './useFloorPlanController';

const FINAL = new Set(['cancelled', 'no_show', 'completed']);

function bookingHref(fp: FloorPlanController, booking: FloorBooking): string {
  const params = new URLSearchParams({ date: fp.date });
  if (booking.reference) params.set('query', booking.reference);
  else if (booking.tableIds[0]) {
    params.set('tableId', booking.tableIds[0]);
    params.set('time', formatClock(booking.startMs, fp.timezone));
  }
  return `/app/bookings?${params.toString()}`;
}

function Tags({ booking, withStatus = false }: { booking: FloorBooking; withStatus?: boolean }) {
  const showStatus = withStatus || booking.status === 'pending';
  if (!showStatus && booking.tags.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {showStatus ? (
        <Badge
          variant={booking.status === 'checked_in' ? 'default' : 'outline'}
          className="text-[11px]"
        >
          {BOOKING_STATUS_LABELS[booking.status] ?? booking.status}
        </Badge>
      ) : null}
      {booking.tags.map((tag, i) => {
        const Icon = TAG_ICONS[tag.kind];
        return (
          <Badge key={i} variant="outline" className={cn('gap-1 text-[11px]', TAG_TONES[tag.kind])}>
            <Icon className="size-3" aria-hidden />
            {tag.label}
          </Badge>
        );
      })}
    </div>
  );
}

function ErrorLine({ message }: { message: string | undefined }) {
  if (!message) return null;
  return (
    <p role="alert" className="flex items-start gap-1.5 text-sm text-destructive">
      <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>{message}</span>
    </p>
  );
}

/* ───────── drag a booking onto a table ───────── */

function useBookingDrag(fp: FloorPlanController) {
  const [ghost, setGhost] = useState<{ x: number; y: number } | null>(null);
  const { startDrag, dragOver, endDrag } = fp.actions;

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLElement>, bookingId: string) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      const fromGrip = Boolean((event.target as HTMLElement).closest('[data-grip]'));
      if ((event.target as HTMLElement).closest('button, a') && !fromGrip) return;
      // Touch drags only from the grip so the list still scrolls.
      if (event.pointerType !== 'mouse' && !fromGrip) return;
      const sx = event.clientX;
      const sy = event.clientY;
      let started = false;
      const onMove = (e: PointerEvent) => {
        if (!started) {
          if (Math.hypot(e.clientX - sx, e.clientY - sy) < 6) return;
          started = true;
          startDrag(bookingId);
        }
        setGhost({ x: e.clientX, y: e.clientY });
        const el = document.elementFromPoint(e.clientX, e.clientY);
        const tile = el?.closest<HTMLElement>('[data-table-id]');
        dragOver(tile?.dataset.tableId ?? null);
      };
      const onUp = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onUp);
        setGhost(null);
        if (started) endDrag();
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onUp);
    },
    [dragOver, endDrag, startDrag],
  );

  return { ghost, onPointerDown };
}

/* ───────── needs a table ───────── */

function NeedsRow({
  fp,
  booking,
  onDragStart,
}: {
  fp: FloorPlanController;
  booking: FloorBooking;
  onDragStart: (event: React.PointerEvent<HTMLElement>, bookingId: string) => void;
}) {
  const { snapshot, serviceLayout, ctx, readOnly } = fp;
  const pending = fp.pending.find((p) => p.bookingId === booking.id);
  const late = snapshot && isLiveDate(snapshot, ctx) && booking.startMs < ctx.nowMs;
  const best =
    !readOnly && !pending && snapshot && serviceLayout
      ? bestFitForBooking(snapshot, booking, ctx, serviceLayout)
      : null;
  const dragging = fp.drag?.bookingId === booking.id;

  return (
    <li
      className={cn(
        'grid grid-cols-[auto_minmax(0,1fr)] gap-x-2 gap-y-2 rounded-lg border bg-card p-2.5',
        !readOnly && !pending && 'cursor-grab',
        dragging && 'opacity-50',
      )}
      onPointerDown={readOnly || pending ? undefined : (event) => onDragStart(event, booking.id)}
    >
      <span
        data-grip
        aria-hidden
        className="row-span-2 grid w-5 touch-none place-items-center text-muted-foreground"
      >
        {readOnly ? null : <GripVertical className="size-4" />}
      </span>
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
          <span className="font-mono font-semibold">
            {formatClock(booking.startMs, fp.timezone)}
          </span>
          <span className="flex items-center gap-1 text-muted-foreground">
            <Users className="size-3.5" aria-hidden />
            {booking.partySize}
          </span>
          <span className="truncate font-medium">{booking.name}</span>
          {late ? (
            <Badge variant="outline" className="border-warning text-[11px]">
              Late
            </Badge>
          ) : null}
        </div>
        <Tags booking={booking} />
        {pending ? (
          <p role="status" className="flex items-center gap-1.5 text-xs text-primary">
            <Loader2 className="size-3.5 animate-spin" aria-hidden />
            Assigning to {snapshot ? tableNumbers(snapshot, pending.tableIds) : ''}…
          </p>
        ) : null}
      </div>
      {readOnly || pending ? null : (
        <div className="col-start-2 flex flex-wrap items-center gap-1.5">
          {best ? (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => fp.actions.quickAssign(booking.id)}
              aria-label={`Assign ${booking.name} to ${snapshot ? tableNumbers(snapshot, best.tableIds) : ''}, best fit, ${best.seats} seats`}
            >
              Assign <b>{snapshot ? tableNumbers(snapshot, best.tableIds) : ''}</b>
              <span className="text-xs font-normal text-muted-foreground">
                · {best.seats} seats
              </span>
            </Button>
          ) : (
            <span className="text-xs text-muted-foreground">
              No table free for {booking.partySize} at {formatClock(booking.startMs, fp.timezone)}
            </span>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => fp.actions.startPick(booking.id, 'assign')}
          >
            {best ? 'Other…' : 'See why…'}
          </Button>
        </div>
      )}
      <div className="col-start-2 empty:hidden">
        <ErrorLine message={fp.bookingErrors[booking.id]} />
      </div>
    </li>
  );
}

function NeedsList({
  fp,
  onDragStart,
  heading,
}: {
  fp: FloorPlanController;
  onDragStart: (event: React.PointerEvent<HTMLElement>, bookingId: string) => void;
  heading: boolean;
}) {
  const { needs, snapshot, readOnly } = fp;
  return (
    <section aria-label="Bookings that need a table" className="space-y-2">
      {heading ? (
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          Needs a table <CountBadge n={needs.length} />
        </h3>
      ) : null}
      {needs.length ? (
        <ul className="space-y-2">
          {needs.map((b) => (
            <NeedsRow key={b.id} fp={fp} booking={b} onDragStart={onDragStart} />
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">
          {snapshot?.tables.length
            ? 'Every booking in this service has a table.'
            : 'Add tables in settings before assigning bookings.'}
        </p>
      )}
      {needs.length && !readOnly ? (
        <p className="text-xs text-muted-foreground">
          Best fit is the table with the fewest spare seats. Drag a booking onto any table, or
          choose Other… from the keyboard.
        </p>
      ) : null}
    </section>
  );
}

function CountBadge({ n }: { n: number }) {
  return (
    <span className="grid h-5 min-w-5 place-items-center rounded-full bg-muted px-1.5 font-mono text-xs font-semibold text-muted-foreground">
      {n}
    </span>
  );
}

function Arriving({ fp }: { fp: FloorPlanController }) {
  const { snapshot, ctx } = fp;
  if (!snapshot) return null;
  const list = arrivingSoon(snapshot, fp.serviceWindow, ctx);
  if (!isLiveDate(snapshot, ctx) || fp.readOnly) return null;
  return (
    <section className="space-y-2" aria-label="Arriving soon">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        Arriving soon <CountBadge n={list.length} />
      </h3>
      {list.length ? (
        <ul className="divide-y">
          {list.map((b) => {
            const tableId = b.tableIds[0]!;
            const state = fp.states.get(tableId);
            const busy = fp.lifecycleBusy[b.id];
            return (
              <li key={b.id} className="flex items-center gap-2 py-2">
                <span className="w-11 shrink-0 font-mono text-sm font-semibold">
                  {formatClock(b.startMs, fp.timezone)}
                </span>
                <Button
                  variant="ghost"
                  className="h-auto min-w-0 flex-1 flex-col items-start gap-0.5 px-2 py-1 text-left font-normal"
                  onClick={() => fp.actions.focusBooking(b.id, tableId)}
                >
                  <span className="truncate text-sm font-semibold">
                    {b.name} · {b.partySize}
                  </span>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <span
                      className={cn(
                        'rounded px-1 font-mono text-foreground',
                        state && STATE_STYLES[state.kind].tile,
                        'border',
                      )}
                    >
                      {tableNumbers(snapshot, b.tableIds)}
                    </span>
                    {b.startMs < ctx.nowMs
                      ? `Late ${Math.round((ctx.nowMs - b.startMs) / 60_000)}m`
                      : null}
                    {b.tags.length ? ` · ${b.tags.map((t) => t.label).join(', ')}` : null}
                  </span>
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={Boolean(busy)}
                  onClick={() => void fp.actions.runLifecycle('check-in', b.id)}
                >
                  {busy === 'check-in' ? 'Checking in…' : 'Check in'}
                </Button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No one due in the next 45 minutes.</p>
      )}
    </section>
  );
}

/* ───────── selected table ───────── */

function MiniTimeline({ fp, table }: { fp: FloorPlanController; table: FloorTable }) {
  const { snapshot, serviceWindow: w, ctx } = fp;
  if (!snapshot || !w) return null;
  const span = w.endMs - w.startMs;
  const pct = (ms: number) => `${(((ms - w.startMs) / span) * 100).toFixed(2)}%`;
  const bookings = snapshot.bookings.filter(
    (b) => b.tableIds.includes(table.id) && inService(b, w) && b.status !== 'cancelled',
  );
  const hours: number[] = [];
  for (let h = Math.ceil(w.startMs / 3_600_000) * 3_600_000; h < w.endMs; h += 3_600_000)
    hours.push(h);
  return (
    <div
      role="img"
      aria-label={`${table.number} this service: ${bookings.length} ${bookings.length === 1 ? 'booking' : 'bookings'}`}
      className="relative h-9 rounded-md border bg-muted/40"
    >
      {bookings.map((b) => {
        const over = b.status === 'checked_in' && isLiveDate(snapshot, ctx) && ctx.nowMs > b.endMs;
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
          <span
            key={b.id}
            className={cn(
              'absolute top-1 h-4 rounded-sm',
              STATE_STYLES[kind].bar,
              (b.status === 'completed' || b.status === 'no_show') && 'opacity-40',
            )}
            style={{ left: pct(start), width: `calc(${pct(end + w.startMs - start)} - 2px)` }}
          />
        );
      })}
      {ctx.atMs >= w.startMs && ctx.atMs <= w.endMs ? (
        <i
          className="absolute inset-y-0 w-0.5 bg-foreground"
          style={{ left: pct(ctx.atMs) }}
          aria-hidden
        />
      ) : null}
      {hours.map((h) => (
        <span
          key={h}
          className="absolute bottom-0 -translate-x-1/2 font-mono text-[10px] text-muted-foreground"
          style={{ left: pct(h) }}
        >
          {formatClock(h, fp.timezone).slice(0, 2)}
        </span>
      ))}
    </div>
  );
}

function focusedBooking(fp: FloorPlanController, table: FloorTable): FloorBooking | null {
  const { snapshot, ctx } = fp;
  if (!snapshot) return null;
  const explicit = fp.focusBookingId ? fp.bookingById.get(fp.focusBookingId) : null;
  if (explicit) return explicit;
  const state = fp.states.get(table.id);
  if (state?.booking) return state.booking;
  return (
    bookingsOnTable(snapshot, table.id).find(
      (b) => inService(b, fp.serviceWindow) && b.startMs >= ctx.atMs && !FINAL.has(b.status),
    ) ?? null
  );
}

function SelectedTableBody({
  fp,
  table,
  onDragStart,
}: {
  fp: FloorPlanController;
  table: FloorTable;
  onDragStart: (event: React.PointerEvent<HTMLElement>, bookingId: string) => void;
}) {
  const { snapshot, ctx, serviceLayout } = fp;
  const state = fp.states.get(table.id);
  if (!snapshot || !state || !serviceLayout) return null;
  const style = STATE_STYLES[state.kind];
  const Icon = style.icon;
  const zone = snapshot.zones.find((z) => z.id === table.zoneId);
  const all = snapshot.bookings
    .filter((b) => b.tableIds.includes(table.id) && inService(b, fp.serviceWindow))
    .sort((a, b) => a.startMs - b.startMs);
  const fb = focusedBooking(fp, table);

  if (fp.reverseTableId === table.id) {
    return (
      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Bookings that need a table</h3>
        <ul className="space-y-1.5">
          {fp.needs.map((b) => {
            const fit = checkTableForBooking(snapshot, table, b, ctx, serviceLayout);
            return (
              <li key={b.id}>
                {fit.ok ? (
                  <Button
                    variant="outline"
                    className="h-auto w-full justify-start gap-2 py-2 text-left font-normal"
                    onClick={() => fp.actions.assignHere(b.id, table.id)}
                  >
                    <b className="font-mono">{formatClock(b.startMs, fp.timezone)}</b>
                    <span className="min-w-0 flex-1 truncate">
                      {b.name} · {b.partySize}
                    </span>
                    <span className="text-xs text-success">{fit.label}</span>
                  </Button>
                ) : (
                  <p className="flex gap-2 rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground">
                    <b className="font-mono">{formatClock(b.startMs, fp.timezone)}</b>
                    <span>
                      {b.name} · {b.partySize}: {fit.reason}
                    </span>
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    );
  }

  return (
    <>
      <div className={cn('flex flex-wrap items-center gap-1.5 text-sm', style.tone)}>
        <Icon className="size-4" aria-hidden />
        <b>{state.text}</b>
        {state.sub ? <span className="text-muted-foreground">· {state.sub}</span> : null}
      </div>
      {table.outOfService ? (
        <p className="rounded-md border bg-muted/50 p-2 text-sm text-muted-foreground">
          Not bookable. {table.notes || 'No reason recorded.'} Put it back in service from Tables
          settings.
        </p>
      ) : null}
      {fb ? <ErrorLine message={fp.bookingErrors[fb.id]} /> : null}
      <MiniTimeline fp={fp} table={table} />
      <section className="space-y-1.5">
        <h3 className="flex items-baseline justify-between text-sm font-semibold">
          This service
          <span className="text-xs font-normal text-muted-foreground">
            {all.length ? `${all.length} ${all.length === 1 ? 'booking' : 'bookings'}` : ''}
          </span>
        </h3>
        {all.length ? (
          <ul className="space-y-1.5">
            {all.map((b) => (
              <li key={b.id}>
                <Button
                  variant="outline"
                  aria-pressed={fb?.id === b.id}
                  onClick={() => fp.actions.focusBooking(b.id)}
                  className={cn(
                    'h-auto w-full flex-col items-stretch gap-1 px-3 py-2 text-left font-normal whitespace-normal',
                    fb?.id === b.id && 'border-primary ring-2 ring-primary/20',
                    FINAL.has(b.status) && 'opacity-60',
                  )}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="font-mono text-sm font-semibold">
                      {formatClock(b.startMs, fp.timezone)}–{formatClock(b.endMs, fp.timezone)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {b.partySize} of{' '}
                      {b.tableIds.reduce(
                        (sum, id) => sum + (fp.tableById.get(id)?.capacity ?? 0),
                        0,
                      )}{' '}
                      seats
                    </span>
                  </span>
                  <span className="text-sm font-medium">
                    {b.name}
                    {b.tableIds.length > 1 ? ` · joined ${tableNumbers(snapshot, b.tableIds)}` : ''}
                  </span>
                  <Tags booking={b} withStatus />
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            No bookings on {table.number} this service.
          </p>
        )}
      </section>
      {fb && fb.tableIds.length > 1 ? (
        <p className="flex gap-2 rounded-md border bg-muted/40 p-2 text-sm text-muted-foreground">
          <Combine className="mt-0.5 size-4 shrink-0" aria-hidden />
          Joined with{' '}
          {tableNumbers(
            snapshot,
            fb.tableIds.filter((id) => id !== table.id),
          )}{' '}
          for {fb.name} · {fb.partySize}. Joins stay within {zone?.name ?? 'the zone'}.
        </p>
      ) : null}
      <Button asChild variant="link" size="sm" className="h-auto px-0">
        <Link href="/app/settings/tables">
          Edit table in settings <ExternalLink aria-hidden />
        </Link>
      </Button>
      <Separator />
      <NeedsList fp={fp} onDragStart={onDragStart} heading />
    </>
  );
}

function SelectedTableFooter({ fp, table }: { fp: FloorPlanController; table: FloorTable }) {
  const { snapshot, ctx } = fp;
  const state = fp.states.get(table.id);
  if (!snapshot || !state) return null;
  const fb = focusedBooking(fp, table);

  if (fp.reverseTableId === table.id) {
    return (
      <Button variant="outline" onClick={() => fp.actions.setReverseTableId(null)}>
        Back to {table.number}
      </Button>
    );
  }
  if (fp.readOnly) {
    return (
      <>
        <p className="text-sm text-muted-foreground">Past times are read-only.</p>
        {fb ? (
          <Button asChild variant="link" size="sm" className="h-auto px-0">
            <Link href={bookingHref(fp, fb)}>
              Open booking <ExternalLink aria-hidden />
            </Link>
          </Button>
        ) : null}
      </>
    );
  }
  if (!fb) {
    return (
      <div className="flex flex-wrap gap-2">
        {state.kind === 'free' && fp.needs.length ? (
          <Button variant="secondary" onClick={() => fp.actions.setReverseTableId(table.id)}>
            Assign a booking here…
          </Button>
        ) : null}
        {isLiveDate(snapshot, ctx) ? (
          <Button asChild variant="outline">
            <Link href="/app/new-bookings">
              <UserPlus aria-hidden />
              Seat a walk-in
            </Link>
          </Button>
        ) : null}
      </div>
    );
  }

  const can = bookingActions(snapshot, fb, ctx);
  const busy = fp.lifecycleBusy[fb.id];
  const pending = fp.pending.some((p) => p.bookingId === fb.id);
  const who = `${fb.name} · ${fb.partySize}`;
  const tables = tableNumbers(snapshot, fb.tableIds);
  return (
    <>
      {can.canCheckIn ? (
        <Button
          disabled={Boolean(busy) || pending}
          onClick={() => void fp.actions.runLifecycle('check-in', fb.id)}
        >
          {busy === 'check-in' ? 'Checking in…' : `Check in ${who}`}
        </Button>
      ) : can.canComplete && state.kind === 'over' ? (
        <Button
          disabled={Boolean(busy)}
          onClick={() => void fp.actions.runLifecycle('complete', fb.id)}
        >
          {busy === 'complete' ? 'Completing…' : `Complete booking · free ${tables}`}
        </Button>
      ) : null}
      <div className="flex flex-wrap gap-2 empty:hidden">
        {can.canComplete && state.kind !== 'over' ? (
          <Button
            variant="outline"
            disabled={Boolean(busy)}
            onClick={() => void fp.actions.runLifecycle('complete', fb.id)}
          >
            {busy === 'complete' ? 'Completing…' : 'Complete booking'}
          </Button>
        ) : null}
        {can.canMove ? (
          <Button
            variant="outline"
            disabled={pending}
            onClick={() => fp.actions.startPick(fb.id, 'move')}
          >
            <Move aria-hidden />
            Move to another table
          </Button>
        ) : null}
        {can.canUnassign ? (
          <Button
            variant="outline"
            disabled={pending}
            onClick={() => void fp.actions.unassign(fb.id)}
          >
            Unassign
          </Button>
        ) : null}
        {can.canNoShow ? (
          <Button
            variant="destructive"
            disabled={Boolean(busy)}
            onClick={() => fp.actions.confirmNoShow(fb.id)}
          >
            {busy === 'no-show' ? 'Marking no-show…' : 'Mark no-show'}
          </Button>
        ) : null}
      </div>
      <Button asChild variant="link" size="sm" className="h-auto justify-start px-0">
        <Link href={bookingHref(fp, fb)}>
          Open booking · {fb.name} <ExternalLink aria-hidden />
        </Link>
      </Button>
    </>
  );
}

/* ───────── pick a table ───────── */

function PickBody({ fp }: { fp: FloorPlanController }) {
  const { snapshot, serviceLayout, pick, ctx } = fp;
  const booking = pick ? fp.bookingById.get(pick.bookingId) : null;
  if (!snapshot || !serviceLayout || !booking) return null;
  const results = snapshot.tables
    .filter((t) => fp.zoneFilter === 'all' || t.zoneId === fp.zoneFilter)
    .sort((a, b) => a.number.localeCompare(b.number, 'en', { numeric: true }))
    .map((t) => ({ t, r: checkTableForBooking(snapshot, t, booking, ctx, serviceLayout) }));
  const ok = results.filter((x) => x.r.ok);
  const no = results.filter((x) => !x.r.ok);
  const zoneName = (id: string) => snapshot.zones.find((z) => z.id === id)?.name ?? '';
  return (
    <>
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        Can take it <CountBadge n={ok.length} />
      </h3>
      {ok.length ? (
        <ul className="space-y-1.5">
          {ok.map(({ t, r }) => (
            <li key={t.id}>
              <Button
                variant="outline"
                className="h-auto w-full justify-start gap-3 py-2 text-left font-normal"
                onClick={() => fp.actions.pickTable(t.id)}
              >
                <b className="font-mono">{t.number}</b>
                <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                  {zoneName(t.zoneId)} · {t.capacity} seats
                </span>
                <span className="text-xs font-semibold text-success">{r.ok ? r.label : ''}</span>
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">
          No table can take {booking.partySize} at {formatClock(booking.startMs, fp.timezone)}.
          Check the Timeline for a gap, or change the time in Bookings.
        </p>
      )}
      <details open={ok.length === 0} className="text-sm">
        <summary className="cursor-pointer font-medium">Can’t take it ({no.length})</summary>
        <ul className="mt-2 space-y-1">
          {no.map(({ t, r }) => (
            <li key={t.id} className="flex gap-2 text-muted-foreground">
              <b className="font-mono text-foreground">{t.number}</b>
              <span>{r.ok ? '' : r.reason}</span>
            </li>
          ))}
        </ul>
      </details>
    </>
  );
}

/* ───────── arrange ───────── */

function ArrangeBody({ fp }: { fp: FloorPlanController }) {
  const { snapshot, layout } = fp;
  if (!snapshot || !layout) return null;
  const table = fp.selectedTableId ? fp.tableById.get(fp.selectedTableId) : null;
  if (table) {
    const placed = layout.tables.get(table.id);
    const zone = snapshot.zones.find((z) => z.id === table.zoneId);
    const partners =
      table.mobility === 'movable'
        ? snapshot.tables.filter(
            (x) =>
              x.zoneId === table.zoneId &&
              x.id !== table.id &&
              x.mobility === 'movable' &&
              !x.outOfService,
          )
        : [];
    const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).replace('_', '-');
    return (
      <>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => fp.actions.rotateTable(table.id, -15)}>
            <RotateCcw aria-hidden />
            Rotate −15°
          </Button>
          <Button variant="outline" onClick={() => fp.actions.rotateTable(table.id, 15)}>
            <RotateCw aria-hidden />
            Rotate +15°
          </Button>
        </div>
        {placed ? (
          <p className="font-mono text-xs text-muted-foreground">
            x {Math.round(placed.relative.x)} · y {Math.round(placed.relative.y)} ·{' '}
            {placed.rotation}°
          </p>
        ) : null}
        {fp.saveErrors[table.id] ? (
          <ErrorLine message={`Not saved: ${fp.saveErrors[table.id]}`} />
        ) : null}
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-muted-foreground">Zone</dt>
          <dd>{zone?.name}</dd>
          <dt className="text-muted-foreground">Seats</dt>
          <dd>
            {table.capacity} · parties of {table.minParty}–{table.capacity}
          </dd>
          <dt className="text-muted-foreground">Category</dt>
          <dd>{cap(table.category)}</dd>
          <dt className="text-muted-foreground">Seating</dt>
          <dd>{cap(table.seatingType)}</dd>
          <dt className="text-muted-foreground">Mobility</dt>
          <dd>{table.mobility === 'fixed' ? 'Fixed' : 'Movable'}</dd>
          <dt className="text-muted-foreground">Status</dt>
          <dd>
            {table.outOfService ? 'Out of service' : table.bookable ? 'Active' : 'Turned off'}
          </dd>
        </dl>
        <p className="flex gap-2 rounded-md border bg-muted/40 p-2 text-sm text-muted-foreground">
          <Combine className="mt-0.5 size-4 shrink-0" aria-hidden />
          {table.mobility === 'fixed'
            ? 'Fixed tables are never joined.'
            : partners.length
              ? `Can be joined with ${partners.map((p) => p.number).join(', ')}, all in ${zone?.name}. Placing it next to a table in another zone doesn’t make them joinable.`
              : `No other movable tables in ${zone?.name}.`}
        </p>
        <Button asChild variant="link" size="sm" className="h-auto justify-start px-0">
          <Link href="/app/settings/tables">
            Edit in Tables settings <ExternalLink aria-hidden />
          </Link>
        </Button>
      </>
    );
  }
  const autos = [...layout.tables.values()].filter((p) => p.auto).length;
  return (
    <>
      {autos ? (
        <p className="flex gap-2 rounded-md border bg-muted/40 p-2 text-sm text-muted-foreground">
          <Scan className="mt-0.5 size-4 shrink-0" aria-hidden />
          {autos} {autos === 1 ? 'table has' : 'tables have'} no saved position, so{' '}
          {autos === 1 ? 'it was' : 'they were'} auto-placed in a tidy grid. Drag to adjust, then
          save.
        </p>
      ) : null}
      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Zones</h3>
        <ul className="space-y-1.5">
          {layout.zones.map((zone) => {
            const count = snapshot.tables.filter((t) => t.zoneId === zone.id).length;
            return (
              <li key={zone.id} className="flex items-center gap-2 rounded-lg border p-2.5">
                <span className="min-w-0 flex-1">
                  <b className="block text-sm">{zone.name}</b>
                  <span className="text-xs text-muted-foreground">{count} tables</span>
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => fp.actions.requestResetZone(zone.id)}
                >
                  Reset zone layout
                </Button>
              </li>
            );
          })}
        </ul>
      </section>
      <p className="flex gap-2 rounded-md border bg-muted/40 p-2 text-sm text-muted-foreground">
        <Combine className="mt-0.5 size-4 shrink-0" aria-hidden />
        Only movable tables in the same zone can be joined, up to 5 at a time. Tables that sit next
        to each other across a zone line are never joined.
      </p>
      <div className="grid gap-1.5 text-xs text-muted-foreground">
        <span>Tab selects a table</span>
        <span>Arrow keys nudge 8 px, with Shift 40 px</span>
        <span>R rotates +15°, Shift + R −15°</span>
      </div>
    </>
  );
}

/* ───────── panel shell ───────── */

type PanelParts = {
  peek: string;
  head: React.ReactNode;
  body: React.ReactNode;
  foot: React.ReactNode;
};

function panelParts(
  fp: FloorPlanController,
  onDragStart: (event: React.PointerEvent<HTMLElement>, bookingId: string) => void,
): PanelParts {
  const { data, snapshot, mode, pick } = fp;
  if (data.status !== 'ready' || !snapshot) {
    const arranging = mode === 'arrange';
    return {
      peek:
        data.status === 'error'
          ? arranging
            ? 'Tables unavailable'
            : 'Bookings unavailable'
          : 'Loading…',
      head: (
        <h2 className="text-base font-semibold">
          {arranging ? 'Arrange layout' : 'Needs a table'}
        </h2>
      ),
      body:
        data.status === 'error' ? (
          <p className="text-sm text-muted-foreground">
            {arranging
              ? 'Table details appear here once your tables load.'
              : 'Bookings appear here once the floor plan loads.'}
          </p>
        ) : (
          <div className="space-y-2" aria-busy="true">
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
          </div>
        ),
      foot: null,
    };
  }

  if (mode === 'arrange') {
    const table = fp.selectedTableId ? fp.tableById.get(fp.selectedTableId) : null;
    return {
      peek: table ? `${table.number} · arrange` : 'Arrange layout',
      head: table ? (
        <PanelHeading
          eyebrow="Arrange · details"
          title={table.number}
          onClose={fp.actions.closeSelection}
          badge={fp.layout?.tables.get(table.id)?.auto ? 'Auto-placed' : null}
        />
      ) : (
        <div>
          <h2 className="text-base font-semibold">Arrange layout</h2>
          <p className="text-xs text-muted-foreground">
            Position only. Capacity, zones and join rules live in Tables settings.
          </p>
        </div>
      ),
      body: <ArrangeBody fp={fp} />,
      foot: null,
    };
  }

  if (pick) {
    const b = fp.bookingById.get(pick.bookingId);
    return {
      peek: b
        ? `${pick.kind === 'move' ? 'Move' : 'Assign'} ${b.name} · ${b.partySize}`
        : 'Choose a table',
      head: b ? (
        <PanelHeading
          eyebrow={pick.kind === 'move' ? 'Move booking' : 'Assign a table'}
          title={`${b.name} · ${b.partySize}`}
          meta={`${formatClock(b.startMs, fp.timezone)}–${formatClock(b.endMs, fp.timezone)}${pick.kind === 'move' ? ` · now on ${tableNumbers(snapshot, b.tableIds)}` : ''}`}
          onClose={fp.actions.cancelPick}
          closeLabel="Cancel"
          autoFocus
        />
      ) : null,
      body: <PickBody fp={fp} />,
      foot: (
        <>
          <Button variant="outline" onClick={fp.actions.cancelPick}>
            Cancel
          </Button>
          <p className="text-xs text-muted-foreground">
            Or choose a highlighted table on the plan. Esc cancels.
          </p>
        </>
      ),
    };
  }

  const table = fp.selectedTableId ? fp.tableById.get(fp.selectedTableId) : null;
  if (table) {
    const state = fp.states.get(table.id);
    const zone = snapshot.zones.find((z) => z.id === table.zoneId);
    return {
      peek: `${table.number} · ${state?.text ?? ''}`,
      head: (
        <PanelHeading
          eyebrow={zone?.name ?? ''}
          title={table.number}
          meta={`${table.capacity} seats · parties of ${table.minParty}–${table.capacity} · ${table.mobility === 'fixed' ? 'Fixed' : 'Movable'}`}
          onClose={fp.actions.closeSelection}
          closeLabel="Close table details"
        />
      ),
      body: <SelectedTableBody fp={fp} table={table} onDragStart={onDragStart} />,
      foot: <SelectedTableFooter fp={fp} table={table} />,
    };
  }

  return {
    peek: `Needs a table (${fp.needs.length})`,
    head: (
      <div>
        <h2 className="flex items-center gap-2 text-base font-semibold">
          Needs a table <CountBadge n={fp.needs.length} />
        </h2>
        <p className="text-xs text-muted-foreground">
          {fp.service === 'all'
            ? 'All services'
            : snapshot.services.find((s) => s.key === fp.service)?.label}{' '}
          · {formatShortDate(snapshot.date)}
        </p>
      </div>
    ),
    body: (
      <>
        <NeedsList fp={fp} onDragStart={onDragStart} heading={false} />
        <Separator />
        <Arriving fp={fp} />
      </>
    ),
    foot: null,
  };
}

function PanelHeading({
  eyebrow,
  title,
  meta,
  badge,
  onClose,
  closeLabel = 'Close',
  autoFocus = false,
}: {
  eyebrow: string;
  title: string;
  meta?: string;
  badge?: string | null;
  onClose: () => void;
  closeLabel?: string;
  /** Move focus here when shown (pick mode), so keyboard users land on the choices. */
  autoFocus?: boolean;
}) {
  const ref = useRef<HTMLHeadingElement | null>(null);
  useEffect(() => {
    if (autoFocus) ref.current?.focus({ preventScroll: true });
  }, [autoFocus, title]);
  return (
    <div className="flex items-start gap-2">
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {eyebrow}
        </p>
        <h2
          ref={ref}
          tabIndex={-1}
          className="flex items-center gap-2 text-lg font-semibold outline-none"
        >
          <span className="truncate">{title}</span>
          {badge ? <Badge variant="outline">{badge}</Badge> : null}
        </h2>
        {meta ? <p className="font-mono text-xs text-muted-foreground">{meta}</p> : null}
      </div>
      <Button size="icon-sm" variant="ghost" aria-label={closeLabel} onClick={onClose}>
        <X />
      </Button>
    </div>
  );
}

export function FloorPlanPanel({
  fp,
  sheet,
  onSheetChange,
}: {
  fp: FloorPlanController;
  sheet: 'peek' | 'open';
  onSheetChange: (next: 'peek' | 'open') => void;
}) {
  const drag = useBookingDrag(fp);
  const parts = panelParts(fp, drag.onPointerDown);
  const dragBooking = fp.drag ? fp.bookingById.get(fp.drag.bookingId) : null;

  return (
    <>
      <aside
        aria-label="Bookings and table details"
        data-sheet={sheet}
        className={cn(
          'flex min-h-0 flex-col border-t bg-card',
          'max-[1099px]:absolute max-[1099px]:inset-x-0 max-[1099px]:bottom-0 max-[1099px]:z-30 max-[1099px]:rounded-t-xl max-[1099px]:shadow-lg',
          sheet === 'open'
            ? 'max-[1099px]:h-[min(70%,560px)] max-md:h-[min(75dvh,560px)]'
            : 'max-[1099px]:h-14',
          // Phones scroll the page, so pin the sheet to the screen above the bottom nav.
          'max-md:fixed max-md:bottom-[calc(env(safe-area-inset-bottom,0px)+4rem)]',
          'min-[1100px]:w-[340px] min-[1100px]:shrink-0 min-[1100px]:border-l min-[1100px]:border-t-0',
        )}
      >
        <Button
          variant="ghost"
          aria-expanded={sheet === 'open'}
          onClick={() => onSheetChange(sheet === 'open' ? 'peek' : 'open')}
          className="h-14 w-full shrink-0 justify-between rounded-none border-b px-4 min-[1100px]:hidden"
        >
          <b className="truncate">{parts.peek}</b>
          {sheet === 'open' ? <ChevronDown aria-hidden /> : <ChevronUp aria-hidden />}
          <span className="sr-only">{sheet === 'open' ? 'Collapse' : 'Expand'} panel</span>
        </Button>
        <div
          className={cn('flex min-h-0 flex-1 flex-col', sheet === 'peek' && 'max-[1099px]:hidden')}
        >
          <div className="shrink-0 border-b p-4">{parts.head}</div>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">{parts.body}</div>
          {parts.foot ? (
            <div className="flex shrink-0 flex-col gap-2 border-t bg-card p-4">{parts.foot}</div>
          ) : null}
        </div>
      </aside>
      {drag.ghost && dragBooking ? (
        <div
          aria-hidden
          className="pointer-events-none fixed z-50 flex -translate-x-1/2 -translate-y-[130%] items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-sm font-medium shadow-lg"
          style={{ left: drag.ghost.x, top: drag.ghost.y }}
        >
          <Users className="size-4" />
          {dragBooking.partySize} · {dragBooking.name} ·{' '}
          <span className="font-mono">{formatClock(dragBooking.startMs, fp.timezone)}</span>
        </div>
      ) : null}
    </>
  );
}

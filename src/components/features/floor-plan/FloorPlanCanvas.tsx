'use client';

import { Info, List, Maximize, Minus, Move, Plus } from 'lucide-react';
import { useCallback, useMemo, useRef } from 'react';

import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

import { KEY_STATES, STATE_STYLES } from './floorPlanStyles';
import { FloorPlanTableTile, type ZoomTier } from './FloorPlanTableTile';
import { SNAP, boxAround, rotatedSize, snapToGrid } from './model/floorPlanLayout';
import {
  checkTableForBooking,
  isPlanningDate,
  tableNumbers,
  zoneSeatCounts,
} from './model/floorPlanState';
import { formatClock, formatLongDate } from './model/floorPlanTime';
import { useCanvasViewport } from './useCanvasViewport';

import type { FitResult } from './model/floorPlanState';
import type { FloorTable } from './model/floorPlanTypes';
import type { FloorPlanController } from './useFloorPlanController';

function tierFor(scale: number): ZoomTier {
  if (scale < 0.7) return 'min';
  if (scale < 0.88) return 'mid';
  return 'full';
}

function useFitMap(fp: FloorPlanController): Map<string, FitResult> | null {
  const { snapshot, serviceLayout, pick, drag, ctx, bookingById } = fp;
  const bookingId = pick?.bookingId ?? drag?.bookingId ?? null;
  return useMemo(() => {
    const booking = bookingId ? bookingById.get(bookingId) : null;
    if (!snapshot || !serviceLayout || !booking) return null;
    return new Map(
      snapshot.tables.map((t) => [
        t.id,
        checkTableForBooking(snapshot, t, booking, ctx, serviceLayout),
      ]),
    );
  }, [bookingById, bookingId, ctx, serviceLayout, snapshot]);
}

export function matchesStatFilter(fp: FloorPlanController, table: FloorTable): boolean {
  const state = fp.states.get(table.id);
  if (!fp.statFilter || !state) return true;
  if (fp.statFilter === 'seated') return ['seated', 'over', 'booked'].includes(state.kind);
  if (fp.statFilter === 'free') return state.kind === 'free';
  if (fp.statFilter === 'over') return state.kind === 'over';
  if (fp.statFilter === 'awaiting' && fp.snapshot && fp.serviceLayout) {
    const { snapshot, serviceLayout, ctx } = fp;
    return fp.needs.some((b) => checkTableForBooking(snapshot, table, b, ctx, serviceLayout).ok);
  }
  return true;
}

function Banner({ fp }: { fp: FloorPlanController }) {
  const { snapshot, pick, drag, mode, readOnly, ctx, bookingById, actions, today } = fp;
  if (!snapshot) return null;
  let body: React.ReactNode = null;
  if (pick) {
    const b = bookingById.get(pick.bookingId);
    if (b) {
      body = (
        <>
          <span>
            <b>
              {pick.kind === 'move' ? 'Move' : 'Assign'} {b.name} · {b.partySize}
            </b>{' '}
            <span className="font-mono">{formatClock(b.startMs, fp.timezone)}</span> · choose a
            highlighted table
          </span>
          <Button size="sm" variant="outline" onClick={actions.cancelPick}>
            Cancel
          </Button>
        </>
      );
    }
  } else if (drag) {
    const b = bookingById.get(drag.bookingId);
    if (b) {
      body = (
        <span>
          Drop{' '}
          <b>
            {b.name} · {b.partySize}
          </b>{' '}
          on a highlighted table. Dimmed tables can’t take it.
        </span>
      );
    }
  } else if (mode === 'service' && snapshot.date < today) {
    body = (
      <>
        <span>
          <b>{formatLongDate(snapshot.date)}</b> has passed. The plan is read-only.
        </span>
        <Button size="sm" variant="ghost" onClick={actions.goToNow}>
          Back to today
        </Button>
      </>
    );
  } else if (mode === 'service' && readOnly) {
    body = (
      <>
        <span>
          <b>Viewing {formatClock(ctx.atMs, fp.timezone)}</b>, earlier today. Read-only: actions are
          hidden.
        </span>
        <Button size="sm" variant="ghost" onClick={actions.goToNow}>
          Back to now
        </Button>
      </>
    );
  } else if (mode === 'service' && isPlanningDate(snapshot, ctx)) {
    body = (
      <span>
        <b>Planning {formatLongDate(snapshot.date)}.</b> Assign and move bookings now; check-in
        opens on the day.
      </span>
    );
  }
  if (!body) return null;
  return (
    <div className="pointer-events-none absolute inset-x-3 top-3 z-20 flex justify-center">
      <div
        role="status"
        className="pointer-events-auto flex max-w-full flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border bg-card px-3 py-1.5 text-sm shadow-md"
      >
        {body}
      </div>
    </div>
  );
}

function CanvasControls({
  fp,
  scale,
  fitted,
  onFit,
  onZoom,
}: {
  fp: FloorPlanController;
  scale: number;
  fitted: boolean;
  onFit: () => void;
  onZoom: (factor: number) => void;
}) {
  return (
    <div className="absolute bottom-3 right-3 z-20 flex flex-wrap items-center justify-end gap-2">
      <div className="flex gap-1 rounded-lg border bg-card p-1 shadow-sm">
        <Popover>
          <PopoverTrigger asChild>
            <Button size="sm" variant="ghost">
              <Info aria-hidden />
              Key
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-72 space-y-2 text-sm">
            {KEY_STATES.map((kind) => {
              const s = STATE_STYLES[kind];
              const Icon = s.icon;
              return (
                <div key={kind} className="flex items-center gap-2">
                  <span className={cn('size-3 rounded-sm', s.swatch)} aria-hidden />
                  <Icon className={cn('size-4', s.tone)} aria-hidden />
                  <span>{kind === 'due' ? 'Due soon (or late)' : s.label}</span>
                </div>
              );
            })}
            <div className="flex items-center gap-2">
              <span
                className="size-3 rounded-sm border-2 border-dashed border-primary"
                aria-hidden
              />
              <span>Joined tables, labelled “T3 + T4”</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Zoomed out, tables show their number and state. Select one for full detail.
            </p>
            <p className="text-xs text-muted-foreground">N now · F fit · + − zoom · Esc cancel</p>
          </PopoverContent>
        </Popover>
        <Button
          size="sm"
          variant="ghost"
          aria-pressed={fp.listOn}
          onClick={() => fp.actions.setListOn(!fp.listOn)}
        >
          <List aria-hidden />
          List
        </Button>
      </div>
      <div
        role="group"
        aria-label="Zoom"
        className="flex gap-1 rounded-lg border bg-card p-1 shadow-sm"
      >
        <Button size="icon-sm" variant="ghost" aria-label="Zoom out" onClick={() => onZoom(0.8)}>
          <Minus />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          aria-label="Zoom to fit"
          onClick={onFit}
          className="min-w-16 font-mono"
        >
          <Maximize aria-hidden />
          {fitted ? 'Fit' : `${Math.round(scale * 100)}%`}
        </Button>
        <Button size="icon-sm" variant="ghost" aria-label="Zoom in" onClick={() => onZoom(1.25)}>
          <Plus />
        </Button>
      </div>
    </div>
  );
}

export function FloorPlanCanvas({ fp }: { fp: FloorPlanController }) {
  const { snapshot, layout, states, mode, zoneFilter, drag, pick, selectedTableId } = fp;
  const arrange = mode === 'arrange';
  const fitMap = useFitMap(fp);
  const refBookingId = pick?.bookingId ?? drag?.bookingId ?? null;
  const refBooking = refBookingId ? fp.bookingById.get(refBookingId) : null;

  const bounds = useMemo(() => {
    if (!layout) return null;
    const zone = zoneFilter !== 'all' ? layout.zoneById.get(zoneFilter) : null;
    if (zone) return { x: zone.x - 8, y: zone.y - 8, w: zone.w + 16, h: zone.h + 16 };
    return { x: 0, y: 0, w: layout.width, h: layout.height };
  }, [layout, zoneFilter]);
  const { viewportRef, view, isPanning, fit, zoomBy, onBackgroundPointerDown } =
    useCanvasViewport(bounds);
  const tier = tierFor(view.scale);

  const tableDrag = useRef<{
    id: string;
    sx: number;
    sy: number;
    ox: number;
    oy: number;
    moved: boolean;
  } | null>(null);
  const suppressClick = useRef(false);

  const onTablePointerDown = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>, table: FloorTable) => {
      if (!arrange || (event.pointerType === 'mouse' && event.button !== 0)) return;
      const placed = layout?.tables.get(table.id);
      if (!placed) return;
      event.stopPropagation();
      tableDrag.current = {
        id: table.id,
        sx: event.clientX,
        sy: event.clientY,
        ox: placed.relative.x,
        oy: placed.relative.y,
        moved: false,
      };
      const rotation = placed.rotation;
      const onMove = (e: PointerEvent) => {
        const d = tableDrag.current;
        if (!d) return;
        const dx = e.clientX - d.sx;
        const dy = e.clientY - d.sy;
        if (!d.moved && Math.hypot(dx, dy) < 4) return;
        d.moved = true;
        fp.actions.setSelectedTableId(table.id);
        fp.actions.placeTable(table, {
          x: snapToGrid(d.ox + dx / view.scale),
          y: snapToGrid(d.oy + dy / view.scale),
          rotation,
        });
      };
      const onUp = () => {
        if (tableDrag.current?.moved) {
          suppressClick.current = true;
          window.setTimeout(() => {
            suppressClick.current = false;
          }, 50);
        }
        tableDrag.current = null;
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onUp);
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onUp);
    },
    [arrange, fp.actions, layout, view.scale],
  );

  const onActivate = useCallback(
    (tableId: string) => {
      if (suppressClick.current) return;
      if (arrange) fp.actions.setSelectedTableId(tableId);
      else fp.actions.selectTable(tableId);
    },
    [arrange, fp.actions],
  );

  const onTableKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>, table: FloorTable) => {
      const dir: Record<string, [number, number]> = {
        ArrowLeft: [-1, 0],
        ArrowRight: [1, 0],
        ArrowUp: [0, -1],
        ArrowDown: [0, 1],
      };
      const d = dir[event.key];
      if (arrange && fp.canArrange) {
        if (d) {
          event.preventDefault();
          const step = event.shiftKey ? SNAP * 5 : SNAP;
          fp.actions.setSelectedTableId(table.id);
          fp.actions.nudgeTable(table.id, d[0] * step, d[1] * step);
          return;
        }
        if (event.key === 'r' || event.key === 'R') {
          event.preventDefault();
          fp.actions.setSelectedTableId(table.id);
          fp.actions.rotateTable(table.id, event.shiftKey ? -15 : 15);
        }
        return;
      }
      if (!d || !layout || !snapshot) return;
      // Spatial navigation: nearest table in the arrow's direction.
      event.preventDefault();
      const me = layout.tables.get(table.id);
      if (!me) return;
      let best: string | null = null;
      let bestScore = Infinity;
      for (const other of snapshot.tables) {
        if (other.id === table.id) continue;
        const p = layout.tables.get(other.id);
        if (!p) continue;
        const vx = p.x - me.x;
        const vy = p.y - me.y;
        const along = vx * d[0] + vy * d[1];
        if (along <= 4) continue;
        const score = along + Math.abs(vx * d[1] + vy * d[0]) * 2;
        if (score < bestScore) {
          bestScore = score;
          best = other.id;
        }
      }
      if (best)
        viewportRef.current?.querySelector<HTMLButtonElement>(`[data-table-id="${best}"]`)?.focus();
    },
    [arrange, fp.actions, fp.canArrange, layout, snapshot, viewportRef],
  );

  if (!snapshot || !layout) return null;

  const zoneNames = new Map(snapshot.zones.map((z) => [z.id, z.name]));
  const groups: Array<{ id: string; label: string; x: number; y: number; w: number; h: number }> =
    [];
  if (!arrange) {
    const seen = new Set<string>();
    for (const table of snapshot.tables) {
      const state = states.get(table.id);
      const b = state?.booking;
      if (
        !b ||
        b.tableIds.length < 2 ||
        seen.has(b.id) ||
        !['seated', 'over', 'due', 'late', 'booked'].includes(state.kind)
      )
        continue;
      seen.add(b.id);
      const boxes = b.tableIds.flatMap((id) => {
        const p = layout.tables.get(id);
        const t = fp.tableById.get(id);
        return p && t ? [boxAround(p.x, p.y, rotatedSize(t, p.rotation))] : [];
      });
      if (boxes.length < 2) continue;
      const x1 = Math.min(...boxes.map((q) => q.x1)) - 6;
      const y1 = Math.min(...boxes.map((q) => q.y1)) - 16;
      const x2 = Math.max(...boxes.map((q) => q.x2)) + 6;
      const y2 = Math.max(...boxes.map((q) => q.y2)) + 16;
      groups.push({
        id: b.id,
        label: tableNumbers(snapshot, b.tableIds),
        x: x1,
        y: y1,
        w: x2 - x1,
        h: y2 - y1,
      });
    }
  }

  return (
    <div className="relative min-h-0 flex-1 overflow-hidden">
      <div
        ref={viewportRef}
        role="group"
        aria-label={`Floor plan, ${snapshot.tables.length} tables. Arrow keys move between tables.${arrange ? ' Arrange mode.' : ''}`}
        className={cn(
          'absolute inset-0 touch-none select-none overflow-hidden bg-muted/40',
          isPanning ? 'cursor-grabbing' : 'cursor-grab',
        )}
        onPointerDown={(event) => {
          if ((event.target as HTMLElement).closest('[data-table-id]')) return;
          onBackgroundPointerDown(event, () => {
            if (selectedTableId && !pick) fp.actions.closeSelection();
          });
        }}
      >
        <div
          className="absolute left-0 top-0 origin-top-left"
          style={{
            width: layout.width,
            height: layout.height,
            transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
          }}
        >
          {layout.zones.map((zone) => {
            const seats = zoneSeatCounts(snapshot, states, zone.id);
            const mov = snapshot.tables.filter(
              (t) => t.zoneId === zone.id && t.mobility === 'movable' && !t.outOfService,
            ).length;
            return (
              <div
                key={zone.id}
                className={cn(
                  'absolute rounded-xl border bg-background/80 shadow-xs',
                  zoneFilter !== 'all' && zoneFilter !== zone.id && 'opacity-35',
                  arrange && 'border-dashed',
                )}
                style={{ left: zone.x, top: zone.y, width: zone.w, height: zone.h }}
              >
                <div className="flex h-10 items-center gap-2 border-b px-3 text-xs text-muted-foreground">
                  <b className="text-sm text-foreground">{zone.name}</b>
                  {arrange ? (
                    <span className="truncate">
                      {mov >= 2
                        ? `${mov} movable tables here can be joined`
                        : 'No joining here: fixed tables'}
                    </span>
                  ) : (
                    <>
                      <span>
                        {seats.seated} / {seats.seats} seated
                      </span>
                      <span className="h-1 w-16 overflow-hidden rounded-full bg-border" aria-hidden>
                        <span
                          className="block h-full rounded-full bg-primary"
                          style={{
                            width: `${seats.seats ? Math.round((seats.seated / seats.seats) * 100) : 0}%`,
                          }}
                        />
                      </span>
                    </>
                  )}
                </div>
              </div>
            );
          })}
          {groups.map((g) => (
            <div
              key={g.id}
              aria-hidden
              className="pointer-events-none absolute rounded-2xl border-2 border-dashed border-primary/60 bg-primary/5"
              style={{ left: g.x, top: g.y, width: g.w, height: g.h }}
            >
              <span className="absolute -top-2.5 left-3 rounded-full bg-primary px-2 text-[11px] font-semibold text-primary-foreground">
                {g.label}
              </span>
            </div>
          ))}
          {snapshot.tables.map((table) => {
            const placed = layout.tables.get(table.id);
            const state = states.get(table.id);
            if (!placed || !state) return null;
            const fitResult = fitMap?.get(table.id) ?? null;
            return (
              <FloorPlanTableTile
                key={table.id}
                table={table}
                placed={placed}
                state={state}
                zoneName={zoneNames.get(table.zoneId) ?? ''}
                arrange={arrange}
                tier={tier}
                atMs={fp.ctx.atMs}
                selected={selectedTableId === table.id && !fitResult}
                dimmed={
                  (!arrange && !fitResult && !matchesStatFilter(fp, table)) ||
                  (zoneFilter !== 'all' && table.zoneId !== zoneFilter)
                }
                flash={fp.flashTableId === table.id}
                hovered={drag?.overTableId === table.id}
                fit={fitResult}
                isSource={Boolean(refBooking?.tableIds.includes(table.id))}
                onPointerDown={arrange ? onTablePointerDown : undefined}
                onActivate={onActivate}
                onKeyDown={onTableKeyDown}
              />
            );
          })}
        </div>
      </div>
      <Banner fp={fp} />
      {arrange && fp.selectedTableId ? (
        <p className="pointer-events-none absolute right-3 top-3 z-10 flex items-center gap-1.5 rounded-md border bg-card px-2 py-1 text-xs text-muted-foreground shadow-sm">
          <Move className="size-3.5" aria-hidden /> Drag, or use arrow keys. R rotates.
        </p>
      ) : null}
      <CanvasControls fp={fp} scale={view.scale} fitted={view.fit} onFit={fit} onZoom={zoomBy} />
    </div>
  );
}

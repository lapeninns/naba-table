'use client';

import { Armchair, Lock } from 'lucide-react';
import { memo } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { STATE_STYLES, TAG_ICONS, TAG_TONES } from './floorPlanStyles';
import { rotatedSize, tableSize } from './model/floorPlanLayout';

import type { PlacedTable } from './model/floorPlanLayout';
import type { FitResult, TableState } from './model/floorPlanState';
import type { FloorTable } from './model/floorPlanTypes';

export type ZoomTier = 'full' | 'mid' | 'min';

type TableTileProps = {
  table: FloorTable;
  placed: PlacedTable;
  state: TableState;
  zoneName: string;
  arrange: boolean;
  tier: ZoomTier;
  atMs: number;
  selected: boolean;
  dimmed: boolean;
  flash: boolean;
  hovered: boolean;
  /** Result of checking this table against the booking being placed, if any. */
  fit: FitResult | null;
  /** This table currently holds the booking being moved. */
  isSource: boolean;
  onPointerDown?: (event: React.PointerEvent<HTMLButtonElement>, table: FloorTable) => void;
  onActivate: (tableId: string) => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLButtonElement>, table: FloorTable) => void;
};

function Chairs({ table, occupied }: { table: FloorTable; occupied: number }) {
  const { w, h } = tableSize(table);
  if (table.seatingType === 'booth' || table.seatingType === 'sofa') {
    const on = occupied > 0 ? 'bg-primary/50' : 'bg-muted-foreground/25';
    return (
      <>
        <span aria-hidden className={cn('absolute inset-x-2 -top-3 h-2 rounded-full', on)} />
        {table.seatingType === 'booth' ? (
          <span aria-hidden className={cn('absolute inset-x-2 -bottom-3 h-2 rounded-full', on)} />
        ) : null}
      </>
    );
  }
  const n = table.capacity;
  const stool = table.seatingType === 'high_top';
  const chairs: Array<{ left: number; top: number; rotate: number }> = [];
  if (table.shape === 'round') {
    for (let i = 0; i < n; i += 1) {
      const a = (i / n) * Math.PI * 2 - Math.PI / 2;
      const r = w / 2 + 7;
      chairs.push({
        left: w / 2 + r * Math.cos(a),
        top: h / 2 + r * Math.sin(a),
        rotate: (a * 180) / Math.PI + 90,
      });
    }
  } else {
    const top = Math.ceil(n / 2);
    const bottom = n - top;
    const cx = (i: number, k: number) => w * (0.5 + (i - (k - 1) / 2) * (0.8 / k));
    for (let i = 0; i < top; i += 1) chairs.push({ left: cx(i, top), top: -7, rotate: 0 });
    for (let j = 0; j < bottom; j += 1)
      chairs.push({ left: cx(j, bottom), top: h + 7, rotate: 180 });
  }
  return (
    <>
      {chairs.map((chair, i) => (
        <span
          key={i}
          aria-hidden
          className={cn(
            'absolute -translate-x-1/2 -translate-y-1/2 border',
            stool ? 'size-3 rounded-full' : 'h-2.5 w-4 rounded-sm',
            i < occupied
              ? 'border-primary/60 bg-primary/40'
              : 'border-muted-foreground/30 bg-muted',
          )}
          style={{ left: chair.left, top: chair.top, rotate: `${chair.rotate}deg` }}
        />
      ))}
    </>
  );
}

function occupiedChairs(table: FloorTable, state: TableState, tableCaps: number): number {
  const booking = state.booking;
  if (!booking || !(state.kind === 'seated' || state.kind === 'over')) return 0;
  return Math.min(
    table.capacity,
    Math.round((booking.partySize * table.capacity) / Math.max(tableCaps, 1)),
  );
}

function ariaLabel(props: TableTileProps): string {
  const { table, state, zoneName, arrange, placed, fit } = props;
  if (arrange) {
    return `Table ${table.number}, ${table.capacity} seats, ${zoneName}, ${table.mobility}${placed.auto ? ', auto-placed' : ''}. Arrow keys move it, R rotates.`;
  }
  const booking = state.booking;
  const parts = [
    `Table ${table.number}, ${table.capacity} seats, ${zoneName}. ${state.text}${state.sub ? `, ${state.sub}` : ''}.`,
  ];
  if (booking) {
    parts.push(
      `${booking.name}, ${booking.partySize} guests${booking.tags.length ? `, ${booking.tags.map((t) => t.label).join(', ')}` : ''}.`,
    );
  }
  if (fit)
    parts.push(
      fit.ok ? `Can take this booking: ${fit.label}.` : `Can’t take this booking: ${fit.reason}`,
    );
  return parts.join(' ');
}

function TableTileInner(props: TableTileProps) {
  const {
    table,
    placed,
    state,
    arrange,
    tier,
    atMs,
    selected,
    dimmed,
    flash,
    hovered,
    fit,
    isSource,
  } = props;
  const size = rotatedSize(table, placed.rotation);
  const base = tableSize(table);
  const style = STATE_STYLES[arrange ? 'booked' : state.kind];
  const Icon = style.icon;
  const booking = state.booking;
  const joinedCaps = booking ? booking.tableIds.length * table.capacity : table.capacity;
  const showMeter =
    !arrange &&
    booking &&
    (state.kind === 'seated' || state.kind === 'over') &&
    booking.status === 'checked_in';
  const meterPct = showMeter
    ? state.kind === 'over'
      ? 100
      : Math.max(
          4,
          Math.min(
            100,
            ((atMs - (booking.checkedInAtMs ?? booking.startMs)) /
              (booking.endMs - booking.startMs)) *
              100,
          ),
        )
    : 0;
  const labelWidth =
    table.shape === 'round'
      ? base.w * 0.8
      : placed.rotation % 180 === 0
        ? base.w - 12
        : placed.rotation % 90 === 0
          ? base.h - 10
          : Math.min(base.w, base.h) * 0.9;

  return (
    <Button
      type="button"
      variant="ghost"
      data-table-id={table.id}
      aria-label={ariaLabel(props)}
      aria-current={selected ? 'true' : undefined}
      onPointerDown={
        props.onPointerDown ? (event) => props.onPointerDown?.(event, table) : undefined
      }
      onClick={() => props.onActivate(table.id)}
      onKeyDown={(event) => props.onKeyDown(event, table)}
      className={cn(
        'group absolute block min-h-0 min-w-0 whitespace-normal rounded-none bg-transparent p-0 font-normal tracking-normal hover:bg-transparent active:translate-y-0 active:scale-100',
        'focus-visible:ring-0 [&:focus-visible>span:first-child>span:first-child]:ring-[3px] [&:focus-visible>span:first-child>span:first-child]:ring-ring/40',
        arrange ? 'cursor-grab touch-none active:cursor-grabbing' : 'cursor-pointer',
        dimmed && 'opacity-35',
        fit && !fit.ok && !isSource && 'opacity-40',
      )}
      style={{
        left: placed.x - size.w / 2,
        top: placed.y - size.h / 2,
        width: size.w,
        height: size.h,
      }}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2"
        style={{
          width: base.w,
          height: base.h,
          translate: '-50% -50%',
          rotate: `${placed.rotation}deg`,
        }}
      >
        <span
          className={cn(
            'absolute inset-0 border-2 shadow-sm transition-colors',
            table.shape === 'round' ? 'rounded-full' : 'rounded-lg',
            style.tile,
            arrange && placed.auto && 'border-dashed',
            selected && 'ring-[3px] ring-primary/60',
            fit?.ok && 'ring-[3px] ring-success/70',
            hovered && fit?.ok && 'ring-4 ring-success',
            hovered && fit && !fit.ok && 'ring-4 ring-destructive/60',
            isSource && 'ring-[3px] ring-primary/40 ring-offset-2 ring-offset-background',
            flash && 'animate-pulse ring-4 ring-destructive',
          )}
        />
        {tier !== 'min' ? (
          <Chairs table={table} occupied={arrange ? 0 : occupiedChairs(table, state, joinedCaps)} />
        ) : null}
      </span>
      <span
        className="pointer-events-none absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-0.5 text-center leading-tight"
        style={{ maxWidth: Math.round(labelWidth) }}
      >
        <span className="flex items-center gap-1 font-mono text-sm font-semibold text-foreground">
          {table.number}
          <small className="flex items-center gap-0.5 text-[11px] font-medium text-muted-foreground">
            {table.mobility === 'fixed' && arrange ? (
              <Lock className="size-3" />
            ) : (
              <Armchair className="size-3" />
            )}
            {table.capacity}
          </small>
        </span>
        {arrange ? (
          <span className="text-[11px] text-muted-foreground">
            {placed.auto ? 'Auto-placed' : table.mobility === 'fixed' ? 'Fixed' : 'Movable'}
            {placed.rotation ? ` · ${placed.rotation}°` : ''}
          </span>
        ) : (
          <>
            <span
              className={cn('flex max-w-full items-center gap-1 text-xs font-medium', style.tone)}
            >
              <Icon className="size-3.5 shrink-0" aria-hidden />
              <span className="truncate">{tier === 'full' ? state.text : state.short}</span>
            </span>
            {tier === 'full' && state.sub ? (
              <span className="max-w-full truncate text-[11px] text-muted-foreground">
                {state.sub}
              </span>
            ) : null}
            {showMeter && tier !== 'min' ? (
              <span className="mt-0.5 h-1 w-12 overflow-hidden rounded-full bg-border">
                <span
                  className={cn(
                    'block h-full rounded-full',
                    state.kind === 'over' ? 'bg-destructive' : 'bg-primary',
                  )}
                  style={{ width: `${meterPct.toFixed(0)}%` }}
                />
              </span>
            ) : null}
          </>
        )}
      </span>
      {!arrange &&
      booking &&
      booking.tags.length > 0 &&
      ['seated', 'over', 'due', 'late', 'booked'].includes(state.kind) ? (
        <span aria-hidden className="pointer-events-none absolute -right-1.5 -top-1.5 flex gap-0.5">
          {booking.tags.slice(0, 2).map((tag, i) => {
            const TagIcon = TAG_ICONS[tag.kind];
            return (
              <span
                key={i}
                className={cn(
                  'grid size-5 place-items-center rounded-full border bg-card',
                  TAG_TONES[tag.kind],
                )}
              >
                <TagIcon className="size-3" />
              </span>
            );
          })}
        </span>
      ) : null}
      {fit?.ok ? (
        <span className="pointer-events-none absolute -bottom-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-success px-2 py-0.5 text-[11px] font-semibold text-success-foreground shadow-sm">
          {fit.label}
        </span>
      ) : null}
    </Button>
  );
}

export const FloorPlanTableTile = memo(TableTileInner);

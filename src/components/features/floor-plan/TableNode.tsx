'use client';

import { useRef } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { toMs } from './domain/timeSelection';
import { touchHitPadding } from './domain/touchTargets';
import { SERVICE_STATE_META } from './domain/types';
import { formatClock } from './format';
import { nodeDotClass, nodeSurfaceClass } from './serviceStateStyles';
import { FLOOR_FOCUS_RING } from './styles';

import type { ProjectedTable } from './domain/project';
import type { FloorPlanNode } from './useFloorPlanState';

export type TableNodeProps = {
  node: FloorPlanNode;
  projected: ProjectedTable;
  /** Movable + admin: mouse/pen drag to rearrange. Touch is always select-only. */
  draggable: boolean;
  timezone: string;
  /** Current canvas zoom — used to size the coarse-pointer touch target back up to 44px. */
  scale: number;
  /** True on coarse (touch) pointers; gates the unscaled hit-target expander. */
  coarsePointer: boolean;
  onSelect: (id: string) => void;
  onDragMoveClient: (id: string, clientX: number, clientY: number) => void;
  onDragCommit: (id: string) => void;
};

type PointerIntent = { mode: 'select' | 'drag'; moved: boolean; startX: number; startY: number };

function nodeMeta(node: FloorPlanNode, timezone: string): string {
  const { state, booking } = node.resolved;
  const meta = SERVICE_STATE_META[state];
  if (meta.occupied && booking) {
    return booking.customerName ?? `${node.table.capacity} cov`;
  }
  if (meta.booked) {
    const startMs = toMs(booking?.startAt);
    return startMs !== null ? formatClock(startMs, timezone) : 'Held';
  }
  return `${node.table.capacity} cov`;
}

/** A single table on the floor map: semantic status tint, status dot, drag-to-move. */
export function TableNode({
  node,
  projected,
  draggable,
  timezone,
  scale,
  coarsePointer,
  onSelect,
  onDragMoveClient,
  onDragCommit,
}: TableNodeProps) {
  const intentRef = useRef<PointerIntent | null>(null);
  const { table, resolved } = node;
  const meta = SERVICE_STATE_META[resolved.state];
  const isOverdue = resolved.state === 'overdue';

  // Coarse-pointer (touch) hit target: grow an unscaled, transparent expander inside the button
  // until the tile clears 44px on screen, without changing the visible tile geometry.
  const touchPadX = coarsePointer ? touchHitPadding(projected.w, scale) : 0;
  const touchPadY = coarsePointer ? touchHitPadding(projected.h, scale) : 0;
  const showTouchTarget = touchPadX > 0 || touchPadY > 0;

  function handlePointerDown(event: React.PointerEvent<HTMLButtonElement>) {
    if (!draggable) return; // non-movable: native click selects (touch, mouse, and keyboard)
    const isTouch = event.pointerType === 'touch';
    if (isTouch) {
      // Touch is select-only — a host never silently rearranges a table by tapping/dragging it.
      // Don't preventDefault/capture so a vertical swipe can still scroll the page (pan-y).
      intentRef.current = {
        mode: 'select',
        moved: false,
        startX: event.clientX,
        startY: event.clientY,
      };
      return;
    }
    // Mouse/pen: start a potential drag-to-move (admin rearrange).
    event.preventDefault();
    event.stopPropagation();
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      /* ignore */
    }
    intentRef.current = {
      mode: 'drag',
      moved: false,
      startX: event.clientX,
      startY: event.clientY,
    };
  }

  function handlePointerMove(event: React.PointerEvent<HTMLButtonElement>) {
    const intent = intentRef.current;
    if (!intent || intent.mode !== 'drag') return; // touch select-only ignores movement entirely
    if (!intent.moved) {
      if (Math.hypot(event.clientX - intent.startX, event.clientY - intent.startY) <= 5) return;
      intent.moved = true;
    }
    onDragMoveClient(table.id, event.clientX, event.clientY);
  }

  function handlePointerUp() {
    const intent = intentRef.current;
    intentRef.current = null;
    if (!intent) return;
    if (intent.mode === 'drag' && intent.moved) {
      onDragCommit(table.id);
    } else {
      onSelect(table.id);
    }
  }

  function handlePointerCancel() {
    intentRef.current = null;
  }

  return (
    <Button
      variant="ghost"
      type="button"
      aria-label={`Table ${table.tableNumber}, ${table.capacity} seats, ${meta.label}${
        node.isSelected ? ', selected' : ''
      }`}
      aria-pressed={node.isSelected}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onClick={(event) => {
        // Pointer interactions select via handlePointerUp; this also handles keyboard
        // activation (Enter/Space → click with detail === 0), which produces no pointer
        // events — without it, movable tables would be keyboard-inoperable.
        if (!draggable || event.detail === 0) onSelect(table.id);
      }}
      className={cn(
        // `pan-y pinch-zoom` (not `touch-none`) lets a swipe that starts on a tile still scroll
        // the page / pinch-zoom the map on phones; at lg the canvas ancestor forces `none` so a
        // desktop touchscreen still hands touch to JS.
        'absolute box-border flex h-auto select-none flex-col items-center justify-center gap-px border p-[3px] shadow-sm transition-[box-shadow,transform] [touch-action:pan-y_pinch-zoom] hover:z-10 hover:shadow-md',
        FLOOR_FOCUS_RING,
        nodeSurfaceClass(resolved.state),
        node.isSelected &&
          'z-10 -translate-y-px border-primary shadow-md ring-2 ring-primary ring-offset-2 ring-offset-background',
        node.dimmed && 'opacity-30',
        resolved.outOfService && 'opacity-50',
        draggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer',
      )}
      style={{
        left: projected.left,
        top: projected.top,
        width: projected.w,
        height: projected.h,
        borderRadius: projected.r,
      }}
    >
      {showTouchTarget ? (
        <span
          aria-hidden
          data-floor-touch-target
          // Unscaled hit-area expander: extends the button's tappable region to ≥44px on screen
          // without distorting the visible tile. Transparent; clicks bubble to the button.
          className="absolute z-0 [touch-action:pan-y_pinch-zoom]"
          style={{ left: -touchPadX, top: -touchPadY, right: -touchPadX, bottom: -touchPadY }}
        />
      ) : null}
      <span
        aria-hidden
        className={cn(
          'absolute right-1 top-1 z-10 h-2 w-2 rounded-full ring-1 ring-card',
          nodeDotClass(resolved.state),
          isOverdue && 'motion-safe:animate-pulse',
        )}
      />
      <span className="relative z-10 text-[13px] font-semibold leading-none tabular-nums">
        {table.tableNumber}
      </span>
      <span className="relative z-10 max-w-full truncate text-[8.5px] leading-none text-muted-foreground">
        {nodeMeta(node, timezone)}
      </span>
    </Button>
  );
}

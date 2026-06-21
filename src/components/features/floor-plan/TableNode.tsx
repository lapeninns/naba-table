'use client';

import { useRef } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { tableGeom } from './domain/layout';
import { toMs } from './domain/timeSelection';
import { SERVICE_STATE_META } from './domain/types';
import { formatClock } from './format';
import { nodeSurfaceClass, stateDotClass } from './serviceStateStyles';

import type { FloorPlanNode } from './useFloorPlanState';

export type TableNodeProps = {
  node: FloorPlanNode;
  editMode: boolean;
  timezone: string;
  getCanvasRect: () => DOMRect | null;
  onSelect: (id: string) => void;
  onPreviewDrag: (id: string, xPercent: number, yPercent: number) => void;
  onCommitDrag: (id: string) => void;
};

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

/** A single table on the floor: shape by category/seating, colour + dot by state, drag in edit mode. */
export function TableNode({
  node,
  editMode,
  timezone,
  getCanvasRect,
  onSelect,
  onPreviewDrag,
  onCommitDrag,
}: TableNodeProps) {
  const dragRef = useRef<{ moved: boolean } | null>(null);
  const geom = tableGeom(node.table);
  const { table, resolved, position } = node;
  const movable = editMode && table.mobility === 'movable' && !resolved.outOfService;

  if (!position) return null;

  const meta = SERVICE_STATE_META[resolved.state];

  function handlePointerDown(event: React.PointerEvent<HTMLButtonElement>) {
    if (!movable) return;
    event.preventDefault();
    event.stopPropagation();
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      /* ignore */
    }
    dragRef.current = { moved: false };
  }

  function handlePointerMove(event: React.PointerEvent<HTMLButtonElement>) {
    if (!dragRef.current) return;
    const rect = getCanvasRect();
    if (!rect || rect.width === 0 || rect.height === 0) return;
    dragRef.current.moved = true;
    const xPercent = ((event.clientX - rect.left) / rect.width) * 100;
    const yPercent = ((event.clientY - rect.top) / rect.height) * 100;
    onPreviewDrag(table.id, xPercent, yPercent);
  }

  function handlePointerUp() {
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag) return;
    if (drag.moved) {
      onCommitDrag(table.id);
    } else {
      onSelect(table.id);
    }
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
      onClick={() => {
        if (!movable) onSelect(table.id);
      }}
      className={cn(
        'absolute flex select-none flex-col items-center justify-center gap-0.5 border p-1 shadow-sm transition-[opacity,box-shadow,transform] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
        nodeSurfaceClass(resolved.state),
        node.isSelected && 'z-10 ring-2 ring-primary ring-offset-1',
        node.dimmed && 'opacity-25',
        resolved.outOfService && 'opacity-50',
        movable ? 'cursor-grab active:cursor-grabbing touch-none' : 'cursor-pointer',
      )}
      style={{
        left: `${position.xPercent}%`,
        top: `${position.yPercent}%`,
        width: geom.w,
        height: geom.h,
        borderRadius: geom.r,
        transform: `translate(-50%, -50%) rotate(${position.rotation}deg)`,
      }}
    >
      <span
        aria-hidden
        className={cn(
          'absolute right-1 top-1 h-2 w-2 rounded-full ring-2 ring-card',
          stateDotClass(resolved.state),
        )}
      />
      <span className="font-mono text-[13px] font-semibold leading-none tabular-nums">
        {table.tableNumber}
      </span>
      <span className="max-w-full truncate font-mono text-[8.5px] leading-none text-muted-foreground">
        {nodeMeta(node, timezone)}
      </span>
    </Button>
  );
}

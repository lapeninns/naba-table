'use client';

import { useCallback, useMemo } from 'react';

import { useMediaQuery } from '@/hooks/useMediaQuery';

import { joinHintLinks, projectLayout, toProjectInput, unprojectCenter } from './domain/project';
import { screenToContent } from './domain/viewport';
import { FloorPlanZoomControls } from './FloorPlanZoomControls';
import { JoinOverlay } from './JoinOverlay';
import { TableNode } from './TableNode';
import { useFloorPlanViewport } from './useFloorPlanViewport';
import { ZoneRegionsLayer } from './ZoneRegionsLayer';

import type { LayoutBounds } from './domain/layout';
import type { ProjectInputTable } from './domain/project';
import type { FloorPlanNode } from './useFloorPlanState';

export type FloorPlanCanvasProps = {
  nodes: FloorPlanNode[];
  joinGroups: { bookingId: string; tableIds: string[]; capacity: number }[];
  bounds: LayoutBounds;
  canEdit: boolean;
  timezone: string;
  /** Selected (party-holding) table + its combine candidates → dashed "could-join" hints. */
  joinHints?: { fromId: string; toIds: string[] } | null;
  onSelectTable: (id: string) => void;
  onPreviewDrag: (id: string, xPercent: number, yPercent: number) => void;
  onCommitDrag: (id: string) => void;
};

/** Subtle ink grid behind the room — semantic foreground at low alpha (theme-aware). */
const GRID_BACKGROUND = {
  backgroundImage:
    'linear-gradient(hsl(var(--foreground) / 0.035) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground) / 0.035) 1px, transparent 1px)',
  backgroundSize: '34px 34px',
} as const;

/** The floor map: a bounded, zoomable + pannable window onto the fixed-pixel projection; zones, joins, tables. */
export function FloorPlanCanvas({
  nodes,
  joinGroups,
  bounds,
  canEdit,
  timezone,
  joinHints,
  onSelectTable,
  onPreviewDrag,
  onCommitDrag,
}: FloorPlanCanvasProps) {
  const projection = useMemo(() => {
    const inputs: ProjectInputTable[] = [];
    for (const node of nodes) {
      if (!node.position) continue;
      inputs.push(toProjectInput(node.table, node.position.xPercent, node.position.yPercent));
    }
    const groups = joinGroups.map((g) => ({
      key: g.bookingId,
      tableIds: g.tableIds,
      capacity: g.capacity,
    }));
    return projectLayout(inputs, groups, bounds);
  }, [nodes, joinGroups, bounds]);

  const hintLinks = useMemo(
    () => (joinHints ? joinHintLinks(projection.tables, joinHints.fromId, joinHints.toIds) : []),
    [projection.tables, joinHints],
  );

  // Coarse pointers (phones/tablets) get the unscaled ≥44px touch hit-target on each tile;
  // fine pointers keep precise selection + drag-to-move. Default false = desktop-first paint.
  const coarsePointer = useMediaQuery('(pointer: coarse)', false);

  const {
    viewportRef,
    view,
    frame,
    transform,
    zoomIn,
    zoomOut,
    reset,
    onPanPointerDown,
    onPanPointerMove,
    onPanPointerUp,
  } = useFloorPlanViewport({ contentW: projection.contentW, contentH: projection.contentH });

  const handleDragMoveClient = useCallback(
    (id: string, clientX: number, clientY: number) => {
      // Measure the UNSCALED viewport (not the transformed content box) and invert the
      // zoom/pan so the cursor maps to the same content pixel at any scale — the saved
      // RawPosition stays identical to the un-zoomed path.
      const rect = viewportRef.current?.getBoundingClientRect();
      if (!rect || rect.width === 0) return;
      const { x, y } = screenToContent(view, clientX, clientY, rect);
      const { xPercent, yPercent } = unprojectCenter(
        x - frame.padX,
        y - frame.padY,
        projection.dims,
        projection.offsetX,
        projection.offsetY,
      );
      onPreviewDrag(id, xPercent, yPercent);
    },
    [view, viewportRef, frame.padX, frame.padY, projection, onPreviewDrag],
  );

  return (
    <div
      ref={viewportRef}
      // Touch: `pan-y pinch-zoom` lets the page scroll vertically and the browser pinch-zoom
      // the map (so ~20px fit-scaled tiles are reachable) instead of trapping every touch.
      // Fine pointers at lg keep `none` for wheel-zoom + drag-pan + drag-to-move tables.
      className="relative h-[58vh] min-h-[20rem] max-h-[28rem] w-full cursor-grab overflow-hidden [touch-action:pan-y_pinch-zoom] active:cursor-grabbing lg:h-[calc(100vh-18rem)] lg:min-h-[28rem] lg:max-h-[34rem] lg:[touch-action:none]"
      role="region"
      aria-label="Floor map"
      onPointerDown={onPanPointerDown}
      onPointerMove={onPanPointerMove}
      onPointerUp={onPanPointerUp}
    >
      <FloorPlanZoomControls
        scale={view.scale}
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        onReset={reset}
      />
      <div className="absolute left-0 top-0" style={{ transform, transformOrigin: '0 0' }}>
        <div
          className="relative"
          style={{ width: frame.frameW, height: frame.frameH }}
          data-floor-pannable
        >
          <div
            className="absolute"
            style={{
              left: frame.padX,
              top: frame.padY,
              width: projection.contentW,
              height: projection.contentH,
            }}
          >
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 rounded-xl"
              style={GRID_BACKGROUND}
            />
            <ZoneRegionsLayer zones={projection.zones} />
            <JoinOverlay links={projection.links} boxes={projection.boxes} hints={hintLinks} />
            {nodes.map((node) => {
              const projected = projection.tables.get(node.table.id);
              if (!projected) return null;
              const draggable =
                canEdit && node.table.mobility === 'movable' && !node.resolved.outOfService;
              return (
                <TableNode
                  key={node.table.id}
                  node={node}
                  projected={projected}
                  draggable={draggable}
                  timezone={timezone}
                  scale={view.scale}
                  coarsePointer={coarsePointer}
                  onSelect={onSelectTable}
                  onDragMoveClient={handleDragMoveClient}
                  onDragCommit={onCommitDrag}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

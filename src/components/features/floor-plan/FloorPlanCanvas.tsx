'use client';

import { useCallback, useRef } from 'react';

import { JoinOverlay } from './JoinOverlay';
import { TableNode } from './TableNode';
import { ZoneRegionsLayer } from './ZoneRegionsLayer';

import type { JoinBox, JoinLink } from './domain/joins';
import type { ZoneRegion } from './domain/zones';
import type { FloorPlanNode } from './useFloorPlanState';

export type FloorPlanCanvasProps = {
  nodes: FloorPlanNode[];
  zones: ZoneRegion[];
  joinLinks: JoinLink[];
  joinBoxes: JoinBox[];
  editMode: boolean;
  timezone: string;
  onSelectTable: (id: string) => void;
  onPreviewDrag: (id: string, xPercent: number, yPercent: number) => void;
  onCommitDrag: (id: string) => void;
};

/** The gridded floor map: zone regions + join overlay + positioned table nodes. */
export function FloorPlanCanvas({
  nodes,
  zones,
  joinLinks,
  joinBoxes,
  editMode,
  timezone,
  onSelectTable,
  onPreviewDrag,
  onCommitDrag,
}: FloorPlanCanvasProps) {
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const getCanvasRect = useCallback(() => canvasRef.current?.getBoundingClientRect() ?? null, []);

  return (
    <div className="relative w-full overflow-hidden rounded-xl border border-border bg-muted/10">
      <div
        ref={canvasRef}
        className="relative w-full"
        style={{ aspectRatio: '16 / 10', minHeight: 420 }}
        role="region"
        aria-label="Floor map"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              'linear-gradient(hsl(var(--foreground) / 0.03) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground) / 0.03) 1px, transparent 1px)',
            backgroundSize: '34px 34px',
          }}
        />
        <ZoneRegionsLayer zones={zones} />
        <JoinOverlay links={joinLinks} boxes={joinBoxes} />
        {nodes.map((node) => (
          <TableNode
            key={node.table.id}
            node={node}
            editMode={editMode}
            timezone={timezone}
            getCanvasRect={getCanvasRect}
            onSelect={onSelectTable}
            onPreviewDrag={onPreviewDrag}
            onCommitDrag={onCommitDrag}
          />
        ))}
      </div>
    </div>
  );
}

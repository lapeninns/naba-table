import { format } from 'date-fns';
import { useMemo } from 'react';


import { normalizePosition } from '../lib/position';
import { getTableStateAtTime } from '../lib/timeline';

import type { FloorPlanStatus, FloorPlanTableInspector, FloorPlanTableType } from '../lib/types';
import type { TableInventory } from '@/services/ops/tables';
import type { TableTimelineResponse, TableTimelineRow } from '@/types/ops';

type PositionedTable = TableInventory & { pos: { x: number; y: number; rotation: number } };

function buildTimelineRowMap(timeline: TableTimelineResponse | null | undefined) {
  const map = new Map<string, TableTimelineRow>();
  if (!timeline) return map;
  for (const row of timeline.tables) {
    map.set(row.table.id, row);
  }
  return map;
}

export function useFloorPlanTables({
  tables,
  timeline,
  timelineLoading,
  currentTimestampMs,
  selectedZoneId,
}: {
  tables: TableInventory[];
  timeline: TableTimelineResponse | null | undefined;
  timelineLoading: boolean;
  currentTimestampMs: number;
  selectedZoneId: string;
}): FloorPlanTableInspector[] {
  const timelineByTableId = useMemo(() => buildTimelineRowMap(timeline), [timeline]);

  return useMemo(() => {
    let filteredTables = tables;
    if (selectedZoneId !== 'all') {
      filteredTables = tables.filter((t) => t.zoneId === selectedZoneId);
    }

    if (filteredTables.length === 0) return [];

    const withMaybePos = filteredTables.map((table) => ({ table, pos: normalizePosition(table.position) }));
    const hasPositions = withMaybePos.some((t) => t.pos !== null);

    let positioned: PositionedTable[] = [];

    if (!hasPositions) {
      // Default grid layout when the venue has not configured table positions.
      const cols = Math.ceil(Math.sqrt(filteredTables.length));
      positioned = filteredTables.map((table, index) => {
        const col = index % cols;
        const row = Math.floor(index / cols);
        return {
          ...table,
          pos: { x: col * 100 + 50, y: row * 100 + 50, rotation: 0 },
        };
      });
    } else {
      positioned = withMaybePos
        .filter((t): t is { table: TableInventory; pos: NonNullable<ReturnType<typeof normalizePosition>> } => t.pos !== null)
        .map(({ table, pos }) => ({ ...table, pos }));
    }

    if (positioned.length === 0) return [];

    // Bounds for normalization (venue space -> percent-based layout)
    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;

    for (const table of positioned) {
      minX = Math.min(minX, table.pos.x);
      maxX = Math.max(maxX, table.pos.x);
      minY = Math.min(minY, table.pos.y);
      maxY = Math.max(maxY, table.pos.y);
    }

    const rangeX = Math.max(1, maxX - minX);
    const rangeY = Math.max(1, maxY - minY);

    // Add padding so tables remain fully visible near edges.
    const paddingX = rangeX * 0.15;
    const paddingY = rangeY * 0.15;
    const paddedRangeX = rangeX + paddingX * 2;
    const paddedRangeY = rangeY + paddingY * 2;
    const offsetX = minX - paddingX;
    const offsetY = minY - paddingY;

    return positioned.map((table) => {
      const timelineRow = timelineByTableId.get(table.id);
      const segments = timelineRow?.segments ?? [];
      const currentStatus = getTableStateAtTime(segments, currentTimestampMs);

      // Normalize to 0-100%. Center when range is 0.
      const xPercent = rangeX > 0 ? ((table.pos.x - offsetX) / paddedRangeX) * 100 : 50;
      const yPercent = rangeY > 0 ? ((table.pos.y - offsetY) / paddedRangeY) * 100 : 50;

      const clampedX = Math.max(2, Math.min(98, xPercent));
      const clampedY = Math.max(2, Math.min(98, yPercent));

      const normalizedStatus = currentStatus.state;
      const isInactive =
        !table.active ||
        table.zoneActive === false ||
        (table.status && String(table.status).toLowerCase() !== 'available') ||
        normalizedStatus === 'out_of_service';

      let displayStatus: FloorPlanStatus = 'available';
      if (isInactive) {
        displayStatus = 'closing';
      } else if (timelineLoading) {
        displayStatus = 'loading';
      } else if (normalizedStatus === 'reserved' && currentStatus.booking?.status === 'checked_in') {
        displayStatus = 'seated';
      } else if (normalizedStatus === 'reserved' || normalizedStatus === 'hold') {
        displayStatus = 'reserved';
      }

      const displayType: FloorPlanTableType =
        table.seatingType === 'booth' ? 'booth' : table.mobility === 'fixed' ? 'round' : 'rect';

      const partyName = currentStatus.booking?.customerName ?? null;
      const timeLabel = currentStatus.start ? format(new Date(currentStatus.start), 'HH:mm') : null;

      return {
        id: table.id,
        tableNumber: table.tableNumber,
        capacity: table.capacity,
        xPercent: clampedX,
        yPercent: clampedY,
        rotation: table.pos.rotation,
        displayStatus,
        displayType,
        partyName: displayStatus === 'loading' ? null : partyName,
        timeLabel: displayStatus === 'loading' ? null : timeLabel,
        seatingType: table.seatingType ?? 'standard',
        zoneName: table.zoneName ?? null,
        currentStatus,
      };
    });
  }, [currentTimestampMs, selectedZoneId, tables, timelineByTableId, timelineLoading]);
}

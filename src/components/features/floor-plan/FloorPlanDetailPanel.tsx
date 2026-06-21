'use client';

import { TableDetailView } from './TableDetailView';
import { ZoneOccupancySummary } from './ZoneOccupancySummary';

import type { JoinGroup } from './domain/joins';
import type { ZoneRegion } from './domain/zones';
import type { FloorPlanNode } from './useFloorPlanState';

export type FloorPlanDetailPanelProps = {
  selectedNode: FloorPlanNode | null;
  joinGroup: JoinGroup | null;
  zones: ZoneRegion[];
  timezone: string;
  canEdit: boolean;
  isSeating: boolean;
  isClearing: boolean;
  onClose: () => void;
  onSeatParty: (bookingId: string) => void;
  onClearTable: (bookingId: string) => void;
  onMarkNoShow: (bookingId: string) => void;
  onSplit: (bookingId: string, tableId: string) => void;
};

/** Right aside: per-table detail + actions when selected; zone-occupancy summary otherwise. */
export function FloorPlanDetailPanel({
  selectedNode,
  joinGroup,
  zones,
  timezone,
  canEdit,
  isSeating,
  isClearing,
  onClose,
  onSeatParty,
  onClearTable,
  onMarkNoShow,
  onSplit,
}: FloorPlanDetailPanelProps) {
  // Split is a member-level service action (like seat/clear/no-show), intentionally not
  // admin-gated — it keys off the joined group's presence, not canEdit.
  const canSplit = Boolean(joinGroup);
  return (
    <aside className="w-full lg:w-[320px] lg:flex-none">
      <div className="flex h-full flex-col gap-3.5 rounded-xl border border-border bg-card p-4">
        {selectedNode ? (
          <TableDetailView
            node={selectedNode}
            joinGroup={joinGroup}
            timezone={timezone}
            isSeating={isSeating}
            isClearing={isClearing}
            canSplit={canSplit}
            onClose={onClose}
            onSeatParty={onSeatParty}
            onClearTable={onClearTable}
            onMarkNoShow={onMarkNoShow}
            onSplit={onSplit}
          />
        ) : (
          <>
            <div className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
              Service overview
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Select a table to seat or clear it.
              {canEdit ? ' Toggle Edit layout to drag movable tables into place.' : ''}
            </p>
            <div className="h-px bg-border" />
            <div className="font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
              Occupancy by zone
            </div>
            <ZoneOccupancySummary zones={zones} />
          </>
        )}
      </div>
    </aside>
  );
}

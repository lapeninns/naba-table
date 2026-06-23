'use client';

import {
  OPS_CARD_CLASS,
  OPS_CARD_CONTENT_CLASS,
} from '@/components/features/ops-shell/patterns/opsDensityClasses';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

import { TableDetailView } from './TableDetailView';
import { ZoneOccupancySummary } from './ZoneOccupancySummary';

import type { JoinGroup } from './domain/joins';
import type { ZoneRegion } from './domain/zones';
import type { FloorPlanNode } from './useFloorPlanState';

export type FloorPlanDetailPanelProps = {
  selectedNode: FloorPlanNode | null;
  joinGroup: JoinGroup | null;
  joinTargets: { id: string; label: string }[];
  zones: ZoneRegion[];
  timezone: string;
  isSeating: boolean;
  isClearing: boolean;
  /**
   * `aside` (lg+): the sticky right-column Card. `sheet` (<lg): a bottom Sheet that
   * opens on selection — the selection→action loop stays on-screen on phones instead
   * of stranding the panel below a full-height canvas.
   */
  variant: 'aside' | 'sheet';
  /** Sheet open state (sheet variant only); derived from whether a table is selected. */
  open: boolean;
  onClose: () => void;
  onSeatParty: (bookingId: string) => void;
  onClearTable: (bookingId: string) => void;
  onMarkNoShow: (bookingId: string) => void;
  onSplit: (bookingId: string, tableId: string) => void;
  onJoin: (bookingId: string, tableIds: string[]) => void;
};

/** Right aside: per-table detail + actions when selected; zone-occupancy summary otherwise. */
export function FloorPlanDetailPanel({
  selectedNode,
  joinGroup,
  joinTargets,
  zones,
  timezone,
  isSeating,
  isClearing,
  variant,
  open,
  onClose,
  onSeatParty,
  onClearTable,
  onMarkNoShow,
  onSplit,
  onJoin,
}: FloorPlanDetailPanelProps) {
  // Authored once, rendered in both the desktop aside and the mobile bottom sheet.
  const body = selectedNode ? (
    <TableDetailView
      node={selectedNode}
      joinGroup={joinGroup}
      joinTargets={joinTargets}
      timezone={timezone}
      isSeating={isSeating}
      isClearing={isClearing}
      onClose={onClose}
      onSeatParty={onSeatParty}
      onClearTable={onClearTable}
      onMarkNoShow={onMarkNoShow}
      onSplit={onSplit}
      onJoin={onJoin}
    />
  ) : (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-sm font-semibold text-foreground">Service overview</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Live zone load for the current service window.
        </p>
      </div>
      <Separator />
      <div
        role="heading"
        aria-level={3}
        className="text-xs uppercase tracking-wide text-muted-foreground"
      >
        Occupancy by zone
      </div>
      <ZoneOccupancySummary zones={zones} />
    </div>
  );

  if (variant === 'sheet') {
    return (
      <Sheet
        open={open}
        onOpenChange={(next) => {
          if (!next) onClose();
        }}
      >
        {/* side="bottom" has no built-in max-height / radius — add the scroll boundary and
            safe-area bottom padding so action buttons clear the home indicator / mobile nav. */}
        <SheetContent
          side="bottom"
          showCloseButton={false}
          className="max-h-[85dvh] overflow-y-auto rounded-t-2xl border-border/70 px-4 pb-safe-b pt-4"
        >
          {/* TableDetailView renders the visible heading + its own close button; the sr-only
              title + description satisfy the Radix Dialog a11y contract (and silence its missing
              -description warning) without changing the visible layout. */}
          <SheetTitle className="sr-only">Table detail</SheetTitle>
          <SheetDescription className="sr-only">
            Selected table status, booking, and seating actions.
          </SheetDescription>
          {body}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Card className={cn(OPS_CARD_CLASS, 'h-full min-w-0')}>
      <div className={cn(OPS_CARD_CONTENT_CLASS, 'pt-4')}>{body}</div>
    </Card>
  );
}

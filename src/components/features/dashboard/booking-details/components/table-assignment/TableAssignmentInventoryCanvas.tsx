import { AllTablesSection } from './AllTablesSection';
import { SuggestedTablesSection } from './SuggestedTablesSection';

import type { TableAssignmentTimeline } from '../../tableAssignmentPanelDomain';
import type { ManualAssignmentTable } from '../../types';

export type TableAssignmentInventoryCanvasProps = {
  assignedTableIds: Set<string>;
  conflictedTableIds: Set<string>;
  disabled: boolean;
  filteredTables: ManualAssignmentTable[];
  groupedTables: Map<string, ManualAssignmentTable[]>;
  onToggle: (tableId: string) => void;
  partySize: number;
  selectedTableIds: Set<string>;
  suggestedTables: ManualAssignmentTable[];
  timeline: TableAssignmentTimeline;
};

export function TableAssignmentInventoryCanvas({
  assignedTableIds,
  conflictedTableIds,
  disabled,
  filteredTables,
  groupedTables,
  onToggle,
  partySize,
  selectedTableIds,
  suggestedTables,
  timeline,
}: TableAssignmentInventoryCanvasProps) {
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex items-center gap-2">
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
          Table Inventory
        </h3>
        <span className="h-px flex-1 bg-border/30" />
      </div>
      <div className="flex flex-col gap-6">
        <SuggestedTablesSection
          tables={suggestedTables}
          partySize={partySize}
          selectedTableIds={selectedTableIds}
          assignedTableIds={assignedTableIds}
          conflictedTableIds={conflictedTableIds}
          disabled={disabled}
          onToggle={onToggle}
          bookingStartTime={timeline.bookingStart}
          bookingEndTime={timeline.bookingEnd}
          serviceWindowStart={timeline.windowStart}
          serviceWindowEnd={timeline.windowEnd}
          parsedBookingStart={timeline.parsedBookingStart}
          parsedBookingEnd={timeline.parsedBookingEnd}
          parsedServiceStart={timeline.parsedWindowStart}
          parsedServiceEnd={timeline.parsedWindowEnd}
        />

        <AllTablesSection
          groupedTables={groupedTables}
          filteredTables={filteredTables}
          totalCount={filteredTables.length}
          partySize={partySize}
          selectedTableIds={selectedTableIds}
          assignedTableIds={assignedTableIds}
          conflictedTableIds={conflictedTableIds}
          disabled={disabled}
          onToggle={onToggle}
          bookingStartTime={timeline.bookingStart}
          bookingEndTime={timeline.bookingEnd}
          serviceWindowStart={timeline.windowStart}
          serviceWindowEnd={timeline.windowEnd}
          parsedBookingStart={timeline.parsedBookingStart}
          parsedBookingEnd={timeline.parsedBookingEnd}
          parsedServiceStart={timeline.parsedWindowStart}
          parsedServiceEnd={timeline.parsedWindowEnd}
        />
      </div>
    </div>
  );
}

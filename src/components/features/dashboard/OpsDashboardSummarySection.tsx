'use client';

import { Badge } from '@/components/ui/badge';

import { DashboardSummaryCard } from './DashboardSummaryCard';

import type { BookingFilter } from './BookingsFilterBar';
import type { BookingDTO } from '@/hooks/useBookings';
import type { OpsBookingHeatmap, OpsTodayBooking, OpsTodayBookingsSummary } from '@/types/ops';

export type OpsDashboardSummarySectionProps = {
  summary: OpsTodayBookingsSummary;
  restaurantName: string;
  selectedDate: string;
  heatmap?: OpsBookingHeatmap;
  heatmapLoading?: boolean;
  heatmapError?: Error | null;
  filter: BookingFilter;
  searchQuery?: string;
  sortKey: 'time' | 'party' | 'name';
  sortDir: 'asc' | 'desc';
  isRefetching: boolean;
  allowTableAssignments: boolean;
  restaurantSlug?: string | null;
  onSelectDate: (date: string) => void;
  onFilterChange: (filter: BookingFilter) => void;
  onSortKeyChange: (value: 'time' | 'party' | 'name') => void;
  onSortDirChange: (value: 'asc' | 'desc') => void;
  onDetails?: (booking: BookingDTO) => void;
  onEdit?: (booking: BookingDTO) => void;
  onCancel?: (booking: BookingDTO) => void;
  onAssignTable?: (bookingId: string, tableId: string) => Promise<OpsTodayBooking['tableAssignments']>;
  onUnassignTable?: (bookingId: string, tableId: string) => Promise<OpsTodayBooking['tableAssignments']>;
  tableActionState?: {
    type: 'assign' | 'unassign';
    bookingId: string | null;
    tableId?: string | null;
  } | null;
  onMarkNoShow: (bookingId: string, options?: { performedAt?: string | null; reason?: string | null }) => Promise<void>;
  onUndoNoShow: (bookingId: string, reason?: string | null) => Promise<void>;
  onCheckIn: (bookingId: string) => Promise<void>;
  onCheckOut: (bookingId: string) => Promise<void>;
  pendingLifecycleAction?: {
    bookingId: string | null;
    action: 'check-in' | 'check-out' | 'no-show' | 'undo-no-show';
  } | null;
};

export function OpsDashboardSummarySection({
  summary,
  restaurantName,
  selectedDate,
  heatmap,
  heatmapLoading,
  heatmapError,
  filter,
  searchQuery,
  sortKey,
  sortDir,
  isRefetching,
  allowTableAssignments,
  restaurantSlug,
  onSelectDate,
  onFilterChange,
  onSortKeyChange,
  onSortDirChange,
  onDetails,
  onEdit,
  onCancel,
  onAssignTable,
  onUnassignTable,
  tableActionState,
  onMarkNoShow,
  onUndoNoShow,
  onCheckIn,
  onCheckOut,
  pendingLifecycleAction,
}: OpsDashboardSummarySectionProps) {
  return (
    <div className="space-y-6">
      {!allowTableAssignments ? (
        <div className="flex justify-end">
          <Badge variant="secondary" className="bg-amber-50 text-amber-700">
            Past date · Assignments locked
          </Badge>
        </div>
      ) : null}

      <DashboardSummaryCard
        summary={summary}
        restaurantName={restaurantName}
        selectedDate={selectedDate}
        onSelectDate={onSelectDate}
        heatmap={heatmap}
        heatmapLoading={heatmapLoading}
        heatmapError={heatmapError}
        filter={filter}
        onFilterChange={onFilterChange}
        searchQuery={searchQuery}
        sortKey={sortKey}
        sortDir={sortDir}
        onSortKeyChange={onSortKeyChange}
        onSortDirChange={onSortDirChange}
        isRefetching={isRefetching}
        showFilterBar={false}
        showHeatmap={false}
        allowTableAssignments={allowTableAssignments}
        restaurantSlug={restaurantSlug}
        onDetails={onDetails}
        onEdit={onEdit}
        onCancel={onCancel}
        onAssignTable={onAssignTable}
        onUnassignTable={onUnassignTable}
        tableActionState={tableActionState}
        onMarkNoShow={onMarkNoShow}
        onUndoNoShow={onUndoNoShow}
        onCheckIn={onCheckIn}
        onCheckOut={onCheckOut}
        pendingLifecycleAction={pendingLifecycleAction}
      />
    </div>
  );
}

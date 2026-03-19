'use client';

import { Badge } from '@/components/ui/badge';

import { DashboardSummaryCard } from './DashboardSummaryCard';

import type { BookingFilter, BookingTabCounts } from './BookingsFilterBar';
import type { BookingDTO } from '@/hooks/useBookings';
import type { OpsTodayBooking, OpsTodayBookingsSummary } from '@/types/ops';
import type { ChangeEvent } from 'react';

export type OpsDashboardSummarySectionProps = {
  summary: OpsTodayBookingsSummary;
  restaurantName: string;
  filter: BookingFilter;
  tabCounts: BookingTabCounts;
  searchQuery?: string;
  deferredSearchQuery?: string;
  onSearchChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onPrint: () => void;
  sortKey: 'time' | 'party' | 'name';
  sortDir: 'asc' | 'desc';
  isRefetching: boolean;
  allowTableAssignments: boolean;
  restaurantSlug?: string | null;
  onFilterChange: (filter: BookingFilter) => void;
  onSortKeyChange: (value: 'time' | 'party' | 'name') => void;
  onSortDirChange: (value: 'asc' | 'desc') => void;
  onDetails?: (booking: BookingDTO) => void;
  onEdit?: (booking: BookingDTO) => void;
  onCancel?: (booking: BookingDTO) => void;
  onAssignTable?: (
    bookingId: string,
    tableId: string,
  ) => Promise<OpsTodayBooking['tableAssignments']>;
  onUnassignTable?: (
    bookingId: string,
    tableId: string,
  ) => Promise<OpsTodayBooking['tableAssignments']>;
  tableActionState?: {
    type: 'assign' | 'unassign';
    bookingId: string | null;
    tableId?: string | null;
  } | null;
  onMarkNoShow: (
    bookingId: string,
    options?: { performedAt?: string | null; reason?: string | null },
  ) => Promise<void>;
  onUndoNoShow: (bookingId: string, reason?: string | null) => Promise<void>;
  onCheckIn: (bookingId: string) => Promise<void>;
  onCheckOut: (bookingId: string) => Promise<void>;
  pendingLifecycleAction?: {
    bookingId: string | null;
    action: 'check-in' | 'check-out' | 'no-show' | 'undo-no-show';
    snapshot?: Pick<OpsTodayBooking, 'status' | 'startTime' | 'endTime'> | null;
  } | null;
};

export function OpsDashboardSummarySection({
  summary,
  restaurantName,
  filter,
  tabCounts,
  searchQuery,
  deferredSearchQuery,
  onSearchChange,
  onPrint,
  sortKey,
  sortDir,
  isRefetching,
  allowTableAssignments,
  restaurantSlug,
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
        filter={filter}
        tabCounts={tabCounts}
        onFilterChange={onFilterChange}
        searchQuery={searchQuery}
        deferredSearchQuery={deferredSearchQuery}
        onSearchChange={onSearchChange}
        onPrint={onPrint}
        sortKey={sortKey}
        sortDir={sortDir}
        onSortKeyChange={onSortKeyChange}
        onSortDirChange={onSortDirChange}
        isRefetching={isRefetching}
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

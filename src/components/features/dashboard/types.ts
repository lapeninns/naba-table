export type UseOpsDashboardStateProps = {
  initialDate: string | null;
};

import type { BookingFilter, BookingTabCounts } from './BookingsFilterBar';
import type { BookingSortDir, BookingSortKey } from './list/utils';
import type { OpsTodayBooking } from '@/types/ops';
import type { ChangeEvent } from 'react';

export type DashboardListControls = {
  filter: BookingFilter;
  tabCounts: BookingTabCounts;
  searchQuery?: string;
  deferredSearchQuery?: string;
  sortKey: BookingSortKey;
  sortDir: BookingSortDir;
  isRefetching?: boolean;
  onFilterChange: (filter: BookingFilter) => void;
  onSearchChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onPrint: () => void;
  onSortKeyChange: (value: BookingSortKey) => void;
  onSortDirChange: (value: BookingSortDir) => void;
};

export type DashboardPendingLifecycleAction = {
  bookingId: string | null;
  action: 'check-in' | 'check-out' | 'no-show' | 'undo-no-show';
  snapshot?: Pick<OpsTodayBooking, 'status' | 'startTime' | 'endTime'> | null;
} | null;

export type DashboardTableActionState = {
  type: 'assign' | 'unassign';
  bookingId: string | null;
  tableId?: string | null;
} | null;

export type DashboardBookingActionHandlers = {
  onDetails?: (bookingId: string) => void;
  onEdit?: (bookingId: string) => void;
  onCancel?: (bookingId: string) => void;
  onMarkNoShow: (
    bookingId: string,
    options?: { performedAt?: string | null; reason?: string | null },
  ) => Promise<void>;
  onUndoNoShow: (bookingId: string, reason?: string | null) => Promise<void>;
  onCheckIn: (bookingId: string) => Promise<void>;
  onCheckOut: (bookingId: string) => Promise<void>;
  onAssignTable?: (
    bookingId: string,
    tableId: string,
  ) => Promise<OpsTodayBooking['tableAssignments']>;
  onUnassignTable?: (
    bookingId: string,
    tableId: string,
  ) => Promise<OpsTodayBooking['tableAssignments']>;
  tableActionState?: DashboardTableActionState;
  pendingLifecycleAction?: DashboardPendingLifecycleAction;
};

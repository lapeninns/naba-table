/**
 * Booking details domain types.
 *
 * Times are ISO strings (or HH:mm strings for OpsTodayBooking start/end), normalized to Date in utils.
 */

import type { AssignmentContext, ManualAssignmentTable } from '@/services/ops/bookings';
import type { OpsBookingStatus, OpsTodayBooking, OpsTodayBookingsSummary } from '@/types/ops';
import type { Dispatch, SetStateAction } from 'react';

// =============================================================================
// DOMAIN TYPES
// =============================================================================

export type BookingStatus = OpsBookingStatus;

export type Guest = {
  name: string;
  email?: string | null;
  phone?: string | null;
};

export type Booking = {
  id: string;
  status: BookingStatus;
  startTime: string | null;
  endTime: string | null;
  partySize: number;
  guest: Guest;
  reference?: string | null;
  notes?: string | null;
  details?: Record<string, unknown> | null;
  source?: string | null;
  allergies?: string[] | null;
  dietaryRestrictions?: string[] | null;
  seatingPreference?: string | null;
  requiresTableAssignment?: boolean;
  checkedInAt?: string | null;
  checkedOutAt?: string | null;
};

export type Zone = {
  id: string;
  name: string;
  active?: boolean | null;
};

export type Table = {
  id: string;
  tableNumber: string;
  name?: string | null;
  capacity: number;
  minPartySize?: number;
  maxPartySize?: number | null;
  section?: string | null;
  zoneId?: string | null;
  zoneName?: string | null;
  status?: string | null;
  active?: boolean | null;
  category?: string | null;
  seatingType?: string | null;
  mobility?: string | null;
};

export type TableAssignment = {
  tableIds: string[];
  tables?: Table[];
};

export type AssignmentValidation = {
  status: 'idle' | 'ok' | 'warn' | 'error';
  warnings: string[];
  errors: string[];
  summary: {
    selectedCount: number;
    selectedCapacity: number;
    requiredCapacity: number;
  };
  needsConfirmation: boolean;
};

// =============================================================================
// COMPONENT CONTRACTS
// =============================================================================

export type BookingActionType = 'check-in' | 'check-out' | 'no-show' | 'undo-no-show';

export type BookingDetailsProps = {
  booking: OpsTodayBooking | null;
  summary: OpsTodayBookingsSummary | null;
  allowTableAssignments: boolean;
  isLoading?: boolean;
  errorMessage?: string | null;
  onRetry?: () => void;
  onCheckIn?: () => Promise<void>;
  onCheckOut?: () => Promise<void>;
  onMarkNoShow?: (options?: {
    performedAt?: string | null;
    reason?: string | null;
  }) => Promise<void>;
  onUndoNoShow?: (reason?: string | null) => Promise<void>;
  /**
   * Resolves `false` when the confirmation should stay open (a failure a retry can fix), and
   * `true` after success or a terminal failure (for example BOOKING_NOT_CANCELLABLE).
   */
  onCancel?: () => Promise<boolean | void>;
  /** Optional extra refresh after a table change; the assignment hooks already sync caches. */
  onDataRefresh?: () => Promise<void> | void;
  pendingLifecycleAction?: BookingActionType | null;
  cancelPending?: boolean;
  tableAssignmentQueryEnabled?: boolean;
  tableAssignmentRealtime?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  isToday?: boolean;
};

export type BookingDialogProps = BookingDetailsProps;

// =============================================================================
// HOOK TYPES
// =============================================================================

export type UseTableAssignmentOptions = {
  bookingId: string;
  restaurantId: string;
  partySize: number;
  date?: string | null;
  currentAssignments?: string[];
  onAssignmentComplete?: () => void;
  enabled?: boolean;
  /**
   * Whether to maintain a per-hook realtime subscription. Set `false` when a
   * parent (e.g. `useOpsBookingDialogBundle`) already owns a consolidated
   * channel that invalidates the assignment-context cache key.
   */
  realtime?: boolean;
};

export type UseTableAssignmentReturn = {
  context: AssignmentContext | undefined;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
  tables: ManualAssignmentTable[];
  suggestedTables: ManualAssignmentTable[];
  selectedTables: string[];
  setSelectedTables: Dispatch<SetStateAction<string[]>>;
  selectedCapacity: number;
  assignedCapacity: number;
  assignedTableIds: Set<string>;
  conflictedTableIds: Set<string>;
  validation: AssignmentValidation;
  apply: () => Promise<{ ok: boolean; error?: string }>;
  unassignAll: () => Promise<{ ok: boolean; error?: string }>;
  autoAssign: () => Promise<{ ok: boolean; error?: string }>;
  isAssigning: boolean;
  isUnassigning: boolean;
  isAutoAssigning: boolean;
  isPending: boolean;
};

// =============================================================================
// RE-EXPORTS (Aligned with Ops domain)
// =============================================================================

export type { OpsTodayBooking, OpsTodayBookingsSummary, OpsBookingStatus };
export type { ManualAssignmentTable, AssignmentContext };

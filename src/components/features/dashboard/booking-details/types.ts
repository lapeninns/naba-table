import type { BookingAction } from '@/components/features/booking-state-machine';
import type { OpsBookingStatus, OpsTodayBooking, OpsTodayBookingsSummary } from '@/types/ops';

/**
 * Props for the main BookingDetailsDialog component
 * Following Interface Segregation Principle - main dialog props
 */
export type BookingDetailsDialogProps = {
  booking: OpsTodayBooking;
  summary: OpsTodayBookingsSummary;
  allowTableAssignments: boolean;
  onCheckIn?: () => Promise<void>;
  onCheckOut?: () => Promise<void>;
  onMarkNoShow?: (options?: { performedAt?: string | null; reason?: string | null }) => Promise<void>;
  onUndoNoShow?: (reason?: string | null) => Promise<void>;
  pendingLifecycleAction?: BookingAction | null;
  onAssignTable?: (tableId: string) => Promise<OpsTodayBooking['tableAssignments']>;
  onUnassignTable?: (tableId: string) => Promise<OpsTodayBooking['tableAssignments']>;
  tableActionState?: {
    type: 'assign' | 'unassign';
    tableId?: string | null;
  } | null;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

/**
 * Tab identifiers for the booking dialog
 */
export type BookingDetailsTab = 'overview' | 'tables';

/**
 * Props for GuestProfilePanel - ISP: only what it needs
 */
export type GuestProfilePanelProps = {
  booking: Pick<
    OpsTodayBooking,
    | 'customerName'
    | 'customerEmail'
    | 'customerPhone'
    | 'loyaltyTier'
    | 'allergies'
    | 'dietaryRestrictions'
    | 'seatingPreference'
    | 'notes'
    | 'profileNotes'
  >;
};

/**
 * Props for BookingHeader component
 */
export type BookingHeaderProps = {
  booking: OpsTodayBooking;
  summary: OpsTodayBookingsSummary;
  effectiveStatus: OpsBookingStatus;
  minutesRemaining: number | null;
  timeStatus: TimeStatus;
  checkedInRelativeTime: string | null;
  supportsTableAssignment: boolean;
  onOpenHistory: () => void;
  onOpenShortcuts: () => void;
};

/**
 * Props for BookingOverviewTab component
 */
export type BookingOverviewTabProps = {
  booking: OpsTodayBooking;
  summary: OpsTodayBookingsSummary;
  effectiveStatus: OpsBookingStatus;
  isCancelled: boolean;
  supportsTableAssignment: boolean;
  lifecycleAvailability: { isToday: boolean };
  lifecyclePending: BookingAction | null;
  relativeStartTime: string | null;
  checkedInRelativeTime: string | null;
  onCheckIn: () => Promise<void>;
  onCheckOut: () => Promise<void>;
  onMarkNoShow: (options?: { performedAt?: string | null; reason?: string | null }) => Promise<void>;
  onUndoNoShow: (reason?: string | null) => Promise<void>;
};

/**
 * Props for DetailCard component - reusable UI
 */
export type DetailCardProps = {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  href?: string;
  actionLabel?: string;
  copyable?: boolean;
  relativeTime?: string;
  compact?: boolean;
};

/**
 * Props for ShortcutHint component
 */
export type ShortcutHintProps = {
  keys: readonly string[] | string[];
  description: string;
};

/**
 * Props for BookingHistoryDialog
 */
export type BookingHistoryDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookingId: string;
  timezone: string;
};

/**
 * Props for KeyboardShortcutsDialog
 */
export type KeyboardShortcutsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * Keyboard shortcut configuration
 */
export type KeyboardShortcut = {
  key: string;
  keys: string[];
  description: string;
  action: BookingAction;
  enabledStatuses: string[];
};

/**
 * Return type for useBookingDialogState hook
 */
export type BookingDialogState = {
  isOpen: boolean;
  setIsOpen: (value: boolean) => void;
  activeTab: BookingDetailsTab;
  setActiveTab: (tab: BookingDetailsTab) => void;
  showShortcuts: boolean;
  setShowShortcuts: (show: boolean) => void;
  isHistoryOpen: boolean;
  setIsHistoryOpen: (open: boolean) => void;
  localPendingAction: BookingAction | null;
  setLocalPendingAction: (action: BookingAction | null) => void;
};

/**
 * Time status from countdown hook
 */
export type TimeStatus = 'upcoming' | 'imminent' | 'started' | 'past';

/**
 * Return type for useBookingCountdown hook
 */
export type BookingCountdownState = {
  minutesRemaining: number | null;
  timeStatus: TimeStatus;
  relativeStartTime: string | null;
  checkedInRelativeTime: string | null;
};

/**
 * Lifecycle action handlers interface
 */
export type LifecycleActionHandlers = {
  handleCheckIn: () => Promise<void>;
  handleCheckOut: () => Promise<void>;
  handleMarkNoShow: (options?: { performedAt?: string | null; reason?: string | null }) => Promise<void>;
  handleUndoNoShow: (reason?: string | null) => Promise<void>;
};

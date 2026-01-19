/**
 * BOOKING DETAILS DIALOG
 *
 * A fresh, from-scratch booking dialog built with shadcn/ui primitives.
 * Follows SOLID principles with modular, well-named components.
 */

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export { BookingDialog, BookingDialog as BookingDetailsDialog } from './BookingDialog';
export type {
  BookingDialogProps,
  BookingDetailsProps,
  BookingActionType,
  Booking,
  Guest,
  BookingStatus,
  Table,
  Zone,
  TableAssignment,
  AssignmentValidation,
} from './types';

// =============================================================================
// SUB-COMPONENTS (For advanced customization)
// =============================================================================

export {
  BookingStatusBadge,
  ClickToCopy,
  ContactInfoRow,
  DialogHeader,
  GuestProfilePanel,
  ArrivalCountdown,
  BookingStatCard,
  SelectableTableCard,
  TableAssignmentPanel,
} from './components';

export type {
  BookingStatusBadgeProps,
  ClickToCopyProps,
  ContactInfoRowProps,
  ContactInfoRowAction,
  DialogHeaderProps,
  GuestProfilePanelProps,
  ArrivalCountdownProps,
  BookingStatCardProps,
  SelectableTableCardProps,
  TableAssignmentPanelProps,
} from './components';

// =============================================================================
// HOOKS (For custom implementations)
// =============================================================================

export { useTableAssignment } from './hooks';

// =============================================================================
// UTILITIES (For formatting and calculations)
// =============================================================================

export {
  formatBookingTime,
  formatBookingDate,
  getMinutesUntilTime,
  formatCountdown,
  parseBookingDateTime,
  getStatusConfig,
  getGuestInitials,
  flattenTableAssignments,
  calculateTotalCapacity,
  calculateCapacityPercent,
  getCapacityFit,
  getCapacityFitLabel,
  validateTableSelection,
  groupTablesBySection,
  copyToClipboard,
  canCheckIn,
  canMarkNoShow,
  shouldShowCountdown,
  formatPhoneForTel,
} from './utils';

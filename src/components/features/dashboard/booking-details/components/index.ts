/**
 * BOOKING DIALOG COMPONENTS
 *
 * Modular, SOLID-compliant components for the BookingDialog.
 * Each component follows the Single Responsibility Principle.
 */

// =============================================================================
// ATOMIC COMPONENTS
// =============================================================================

/** Click-to-copy text with visual feedback */
export { ClickToCopy, type ClickToCopyProps } from './ClickToCopy';

/** Contact information display row (phone/email) */
export {
  ContactInfoRow,
  type ContactInfoRowProps,
  type ContactInfoRowAction,
} from './ContactInfoRow';

/** Arrival countdown timer with pulsing indicator */
export { ArrivalCountdown, type ArrivalCountdownProps } from './ArrivalCountdown';

/** Booking statistics card (party size, arrival, tables) */
export { BookingStatCard, type BookingStatCardProps } from './BookingStatCard';

/** Clickable table card for selection in assignment panel */
export { SelectableTableCard, type SelectableTableCardProps } from './SelectableTableCard';

/** Dialog header for booking details */
export { DialogHeader, type DialogHeaderProps } from './DialogHeader';

/** Guest profile panel for booking details */
export { GuestProfilePanel, type GuestProfilePanelProps } from './GuestProfilePanel';

/** Dialog body (mobile/desktop) extracted to keep BookingDialog under LOC cap */
export { BookingDialogBody, type BookingDialogBodyProps } from './BookingDialogBody';

/** Dialog body state views */
export {
  BookingDialogEmptyState,
  BookingDialogErrorState,
  BookingDialogLoadingState,
} from './BookingDialogBodyStates';

/** Dialog table-assignment sections */
export {
  BookingDialogDesktopTableAssignmentSection,
  BookingDialogMobileTableAssignmentSection,
} from './BookingDialogTableAssignmentSection';

/** Responsive Shadcn/Radix shell and surface layout for booking details */
export {
  BookingDialogLayout,
  BookingDialogShell,
  type BookingDialogLayoutProps,
  type BookingDialogShellProps,
} from './BookingDialogShell';

/** Confirmation dialog for marking a booking as no-show */
export {
  BookingNoShowConfirmDialog,
  type BookingNoShowConfirmDialogProps,
} from './BookingNoShowConfirmDialog';

/** Bottom action rail for lifecycle, copy, and destructive booking operations */
export {
  BookingDialogActionRail,
  type BookingDialogActionRailProps,
  type BookingDialogPrimaryAction,
} from './BookingDialogActionRail';

// =============================================================================
// COMPOSITE COMPONENTS
// =============================================================================

/** Complete table assignment panel with grid, stats, and actions */
export { TableAssignmentPanel, type TableAssignmentPanelProps } from './TableAssignmentPanel';

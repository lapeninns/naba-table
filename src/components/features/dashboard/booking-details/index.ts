// Main component
export { BookingDetailsDialog } from './BookingDetailsDialogV2';

// Sub-components (for extension/customization)
export {
  BookingHeader,
  BookingHistoryDialog,
  BookingOverviewTab,
  DetailCard,
  GuestProfilePanel,
  KeyboardShortcutsDialog,
  ShortcutHint,
} from './components';

// Hooks (for custom implementations)
export {
  useBookingCountdown,
  useBookingDialogState,
  useKeyboardShortcuts,
} from './hooks';

// Types (for consumers)
export type {
  BookingCountdownState,
  BookingDetailsDialogProps,
  BookingDetailsTab,
  BookingDialogState,
  BookingHeaderProps,
  BookingHistoryDialogProps,
  BookingOverviewTabProps,
  DetailCardProps,
  GuestProfilePanelProps,
  KeyboardShortcut,
  KeyboardShortcutsDialogProps,
  LifecycleActionHandlers,
  ShortcutHintProps,
  TimeStatus,
} from './types';

// Constants (for extension)
export {
  COUNTDOWN_THRESHOLDS,
  DIALOG_SHORTCUTS,
  KEYBOARD_SHORTCUTS,
  TIER_COLORS,
  TIER_EMOJIS,
} from './constants';

// Re-export existing sub-component
export { BookingAssignmentTabContent } from './BookingAssignmentTabContent';

/**
 * BOOKING DIALOG HOOKS
 *
 * Custom hooks for the BookingDialog.
 */

/** Hook for managing table assignment state and API calls */
export { useTableAssignment } from './useTableAssignment';
export type { UseTableAssignmentOptions, UseTableAssignmentReturn } from '../types';
export {
  useTableAssignmentRealtimeRefetch,
  type TableAssignmentRealtimeRefetchOptions,
} from './useTableAssignmentRealtimeRefetch';
export {
  useTableAssignmentMutations,
  type TableAssignmentMutations,
} from './useTableAssignmentMutations';

/** Hook for managing BookingDialog orchestration state and callbacks */
export {
  useBookingDialogController,
  type BookingDialogController,
} from './useBookingDialogController';
export {
  useBookingDialogCopyFeedback,
  type BookingDialogCopyFeedback,
} from './useBookingDialogCopyFeedback';
export {
  useBookingDialogOpenState,
  type BookingDialogOpenState,
} from './useBookingDialogOpenState';
export {
  useBookingDialogTableAssignmentFocus,
  type BookingDialogTableAssignmentFocus,
} from './useBookingDialogTableAssignmentFocus';

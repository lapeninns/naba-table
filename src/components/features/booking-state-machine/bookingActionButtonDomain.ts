import type { OpsBookingStatus } from '@/types/ops';

export type BookingAction = 'check-in' | 'check-out' | 'no-show' | 'undo-no-show';

export type BookingActionSubject = {
  id: string;
  status: OpsBookingStatus;
  checkedInAt?: string | null;
  checkedOutAt?: string | null;
};

export type BookingActionButtonConfig = {
  action: BookingAction | 'completed' | 'unavailable';
  label: string;
  variant: 'default' | 'secondary' | 'destructive';
  tooltip?: string | null;
};

export const BOOKING_ACTION_DISABLED_REASON: Record<BookingAction, string> = {
  'check-in': 'Guest must be in confirmed status to check in.',
  'check-out': 'Guest must be checked in before you can check out.',
  'no-show': 'Only confirmed bookings can be marked as no-show.',
  'undo-no-show': 'Undo is available only for no-show bookings.',
};

export function isBookingAction(value: string | null | undefined): value is BookingAction {
  return (
    value === 'check-in' || value === 'check-out' || value === 'no-show' || value === 'undo-no-show'
  );
}

export function normalizeBookingActionReason(reason: string): string | null {
  const trimmed = reason.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function resolvePrimaryBookingActionConfig(
  effectiveStatus: OpsBookingStatus,
): BookingActionButtonConfig {
  switch (effectiveStatus) {
    case 'confirmed':
    case 'PRIORITY_WAITLIST':
      return { action: 'check-in', label: 'Seat Guest', variant: 'default' };
    case 'checked_in':
      return { action: 'check-out', label: 'Check out', variant: 'default' };
    case 'completed':
      return {
        action: 'completed',
        label: 'Checked out',
        variant: 'default',
        tooltip: 'Guest already checked out.',
      };
    case 'cancelled':
      return {
        action: 'unavailable',
        label: 'Cancelled',
        variant: 'secondary',
        tooltip: 'Cancelled bookings cannot change status.',
      };
    case 'no_show':
      return {
        action: 'unavailable',
        label: 'No show',
        variant: 'secondary',
        tooltip: 'Use undo no show to restore booking.',
      };
    default:
      return { action: 'unavailable', label: 'Unavailable', variant: 'secondary' };
  }
}

export function resolveSecondaryBookingActionConfig(
  effectiveStatus: OpsBookingStatus,
): BookingActionButtonConfig | null {
  if (effectiveStatus === 'confirmed' || effectiveStatus === 'PRIORITY_WAITLIST') {
    return { action: 'no-show', label: 'Mark no show', variant: 'destructive' };
  }
  if (effectiveStatus === 'no_show') {
    return { action: 'undo-no-show', label: 'Undo no show', variant: 'secondary' };
  }
  return null;
}

export function isPrimaryBookingActionDisabled({
  isQueued,
  pendingAction,
  primaryConfig,
}: {
  isQueued: boolean;
  pendingAction: BookingAction | null;
  primaryConfig: BookingActionButtonConfig;
}): boolean {
  if (isQueued) return true;
  if (primaryConfig.action === 'completed' || primaryConfig.action === 'unavailable') return true;
  if (pendingAction && pendingAction !== primaryConfig.action) return true;
  return false;
}

export function isSecondaryBookingActionDisabled({
  isQueued,
  pendingAction,
  secondaryConfig,
}: {
  isQueued: boolean;
  pendingAction: BookingAction | null;
  secondaryConfig: BookingActionButtonConfig | null;
}): boolean {
  if (!secondaryConfig) return true;
  if (isQueued) return true;
  if (pendingAction && pendingAction !== secondaryConfig.action) return true;
  return false;
}

export function isBookingActionPending({
  action,
  pendingAction,
  queuedActionType,
}: {
  action: BookingActionButtonConfig['action'];
  pendingAction: BookingAction | null;
  queuedActionType: BookingAction | null;
}): boolean {
  return pendingAction === action || queuedActionType === action;
}

export function isBookingLifecycleRestrictedAction({
  action,
  isLifecycleRestricted,
}: {
  action: BookingActionButtonConfig['action'] | null | undefined;
  isLifecycleRestricted: boolean;
}): boolean {
  if (!isLifecycleRestricted) return false;
  return (
    action === 'check-in' ||
    action === 'check-out' ||
    action === 'no-show' ||
    action === 'undo-no-show'
  );
}

export function resolveBookingActionDisabledReason({
  action,
  disabled,
  isQueued,
  queuedActionType,
  tooltip,
}: {
  action: BookingActionButtonConfig['action'];
  disabled: boolean;
  isQueued: boolean;
  queuedActionType: BookingAction | null;
  tooltip?: string | null;
}): string | null {
  if (!disabled) return null;

  let reason: string | null = tooltip ?? null;
  if (!reason && action in BOOKING_ACTION_DISABLED_REASON) {
    reason = BOOKING_ACTION_DISABLED_REASON[action as BookingAction];
  }

  if (isQueued) {
    return queuedActionType === action
      ? 'Action queued while offline. It will sync automatically.'
      : (reason ?? 'Another action for this booking is queued while offline.');
  }

  return reason;
}

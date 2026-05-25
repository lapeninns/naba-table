import { describe, expect, it } from 'vitest';

import {
  BOOKING_ACTION_DISABLED_REASON,
  isBookingAction,
  isBookingActionPending,
  isBookingLifecycleRestrictedAction,
  isPrimaryBookingActionDisabled,
  isSecondaryBookingActionDisabled,
  normalizeBookingActionReason,
  resolveBookingActionDisabledReason,
  resolvePrimaryBookingActionConfig,
  resolveSecondaryBookingActionConfig,
} from '@/components/features/booking-state-machine/bookingActionButtonDomain';

describe('bookingActionButtonDomain', () => {
  it('narrows string values to supported booking actions', () => {
    expect(isBookingAction('check-in')).toBe(true);
    expect(isBookingAction('check-out')).toBe(true);
    expect(isBookingAction('unknown-action')).toBe(false);
    expect(isBookingAction(null)).toBe(false);
  });

  it('normalizes optional action reasons', () => {
    expect(normalizeBookingActionReason('  Guest did not arrive  ')).toBe('Guest did not arrive');
    expect(normalizeBookingActionReason('   ')).toBeNull();
  });

  it('maps booking statuses to primary and secondary action configs', () => {
    expect(resolvePrimaryBookingActionConfig('confirmed')).toMatchObject({
      action: 'check-in',
      label: 'Seat Guest',
      variant: 'default',
    });
    expect(resolvePrimaryBookingActionConfig('checked_in')).toMatchObject({
      action: 'check-out',
      label: 'Check out',
    });
    expect(resolvePrimaryBookingActionConfig('completed')).toMatchObject({
      action: 'completed',
      label: 'Checked out',
      tooltip: 'Guest already checked out.',
    });
    expect(resolvePrimaryBookingActionConfig('cancelled')).toMatchObject({
      action: 'unavailable',
      label: 'Cancelled',
    });
    expect(resolveSecondaryBookingActionConfig('confirmed')).toMatchObject({
      action: 'no-show',
      variant: 'destructive',
    });
    expect(resolveSecondaryBookingActionConfig('no_show')).toMatchObject({
      action: 'undo-no-show',
    });
    expect(resolveSecondaryBookingActionConfig('completed')).toBeNull();
  });

  it('disables actions for queued work, terminal states, and competing pending actions', () => {
    const checkIn = resolvePrimaryBookingActionConfig('confirmed');
    const checkedOut = resolvePrimaryBookingActionConfig('completed');
    const noShow = resolveSecondaryBookingActionConfig('confirmed');

    expect(
      isPrimaryBookingActionDisabled({
        isQueued: false,
        pendingAction: null,
        primaryConfig: checkIn,
      }),
    ).toBe(false);
    expect(
      isPrimaryBookingActionDisabled({
        isQueued: false,
        pendingAction: null,
        primaryConfig: checkedOut,
      }),
    ).toBe(true);
    expect(
      isPrimaryBookingActionDisabled({
        isQueued: false,
        pendingAction: 'no-show',
        primaryConfig: checkIn,
      }),
    ).toBe(true);
    expect(
      isSecondaryBookingActionDisabled({
        isQueued: true,
        pendingAction: null,
        secondaryConfig: noShow,
      }),
    ).toBe(true);
    expect(
      isSecondaryBookingActionDisabled({
        isQueued: false,
        pendingAction: null,
        secondaryConfig: null,
      }),
    ).toBe(true);
  });

  it('detects pending state from direct mutations and queued offline actions', () => {
    expect(
      isBookingActionPending({
        action: 'check-in',
        pendingAction: 'check-in',
        queuedActionType: null,
      }),
    ).toBe(true);
    expect(
      isBookingActionPending({
        action: 'check-out',
        pendingAction: null,
        queuedActionType: 'check-out',
      }),
    ).toBe(true);
    expect(
      isBookingActionPending({
        action: 'completed',
        pendingAction: null,
        queuedActionType: 'check-out',
      }),
    ).toBe(false);
  });

  it('identifies lifecycle-restricted actionable statuses only when the date is restricted', () => {
    expect(
      isBookingLifecycleRestrictedAction({
        action: 'check-in',
        isLifecycleRestricted: true,
      }),
    ).toBe(true);
    expect(
      isBookingLifecycleRestrictedAction({
        action: 'completed',
        isLifecycleRestricted: true,
      }),
    ).toBe(false);
    expect(
      isBookingLifecycleRestrictedAction({
        action: 'check-out',
        isLifecycleRestricted: false,
      }),
    ).toBe(false);
  });

  it('resolves disabled reasons with tooltip and queued-action precedence', () => {
    expect(
      resolveBookingActionDisabledReason({
        action: 'no-show',
        disabled: true,
        isQueued: false,
        queuedActionType: null,
      }),
    ).toBe(BOOKING_ACTION_DISABLED_REASON['no-show']);
    expect(
      resolveBookingActionDisabledReason({
        action: 'check-in',
        disabled: true,
        isQueued: false,
        queuedActionType: null,
        tooltip: 'Lifecycle restricted.',
      }),
    ).toBe('Lifecycle restricted.');
    expect(
      resolveBookingActionDisabledReason({
        action: 'check-in',
        disabled: true,
        isQueued: true,
        queuedActionType: 'check-in',
      }),
    ).toBe('Action queued while offline. It will sync automatically.');
    expect(
      resolveBookingActionDisabledReason({
        action: 'check-out',
        disabled: true,
        isQueued: true,
        queuedActionType: 'check-in',
      }),
    ).toBe(BOOKING_ACTION_DISABLED_REASON['check-out']);
    expect(
      resolveBookingActionDisabledReason({
        action: 'check-in',
        disabled: false,
        isQueued: false,
        queuedActionType: null,
      }),
    ).toBeNull();
  });
});

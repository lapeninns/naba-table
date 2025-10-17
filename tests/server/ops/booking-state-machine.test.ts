import { describe, expect, it } from 'vitest';

import { bookingStateMachine, BookingLifecycleError } from '@/server/ops/booking-lifecycle/stateMachine';

describe('BookingStateMachine', () => {
  it('allows transition from confirmed to checked_in', () => {
    expect(bookingStateMachine.canTransition('confirmed', 'checked_in')).toBe(true);
  });

  it('allows staying in the same state when permitted', () => {
    const validation = bookingStateMachine.validateTransition({ from: 'confirmed', to: 'confirmed', allowSameState: true });
    expect(validation.allowed).toBe(true);
    expect(validation.allowedTargets).toContain('checked_in');
  });

  it('rejects staying in the same state when not permitted', () => {
    const validation = bookingStateMachine.validateTransition({ from: 'confirmed', to: 'confirmed', allowSameState: false });
    expect(validation.allowed).toBe(false);
    expect(validation.code).toBe('ALREADY_IN_STATE');
  });

  it('throws descriptive error for invalid transitions', () => {
    expect(() =>
      bookingStateMachine.assertTransition({ from: 'cancelled', to: 'checked_in' }),
    ).toThrowError(new BookingLifecycleError('Transition from cancelled to checked_in is not permitted', 'TRANSITION_NOT_ALLOWED'));
  });

  it('returns false for unknown source states', () => {
    const validation = bookingStateMachine.validateTransition({ from: 'archived' as any, to: 'confirmed' });
    expect(validation.allowed).toBe(false);
    expect(validation.code).toBe('UNKNOWN_STATUS');
  });
});

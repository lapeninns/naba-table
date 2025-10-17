import { describe, expect, it } from 'vitest';

import {
  bookingMachineReducer,
  bookingStateMachineInitialState,
  type BookingSnapshot,
} from '@/src/contexts/booking-state-machine';

const sampleBooking: BookingSnapshot = {
  id: 'booking-1',
  status: 'confirmed',
  updatedAt: '2025-10-17T05:41:00.000Z',
};

describe('booking state machine reducer', () => {
  it('registers bookings into state', () => {
    const state = bookingMachineReducer(bookingStateMachineInitialState, {
      type: 'REGISTER',
      payload: [sampleBooking],
    });
    expect(state.entries['booking-1']).toMatchObject({ status: 'confirmed' });
  });

  it('tracks optimistic transition begin/commit cycle', () => {
    const registered = bookingMachineReducer(bookingStateMachineInitialState, {
      type: 'REGISTER',
      payload: [sampleBooking],
    });

    const withOptimistic = bookingMachineReducer(registered, {
      type: 'BEGIN_TRANSITION',
      payload: {
        id: sampleBooking.id,
        targetStatus: 'checked_in',
      },
    });
    expect(withOptimistic.entries['booking-1']?.optimistic?.targetStatus).toBe('checked_in');

    const committed = bookingMachineReducer(withOptimistic, {
      type: 'COMMIT_TRANSITION',
      payload: {
        id: sampleBooking.id,
        status: 'checked_in',
        updatedAt: '2025-10-17T05:45:00.000Z',
      },
    });
    expect(committed.entries['booking-1']).toMatchObject({
      status: 'checked_in',
      optimistic: null,
    });
  });

  it('rolls back optimistic transition', () => {
    const registered = bookingMachineReducer(bookingStateMachineInitialState, {
      type: 'REGISTER',
      payload: [sampleBooking],
    });

    const withOptimistic = bookingMachineReducer(registered, {
      type: 'BEGIN_TRANSITION',
      payload: {
        id: sampleBooking.id,
        targetStatus: 'checked_in',
      },
    });

    const rolledBack = bookingMachineReducer(withOptimistic, {
      type: 'ROLLBACK_TRANSITION',
      payload: { id: sampleBooking.id },
    });

    expect(rolledBack.entries['booking-1']?.optimistic).toBeNull();
    expect(rolledBack.entries['booking-1']?.status).toBe('confirmed');
  });

  it('returns existing state when register payload is unchanged', () => {
    const registered = bookingMachineReducer(bookingStateMachineInitialState, {
      type: 'REGISTER',
      payload: [sampleBooking],
    });

    const reRegistered = bookingMachineReducer(registered, {
      type: 'REGISTER',
      payload: [{ ...sampleBooking }],
    });

    expect(reRegistered).toBe(registered);
  });

  it('updates state when register payload changes status', () => {
    const registered = bookingMachineReducer(bookingStateMachineInitialState, {
      type: 'REGISTER',
      payload: [sampleBooking],
    });

    const updated = bookingMachineReducer(registered, {
      type: 'REGISTER',
      payload: [{ ...sampleBooking, status: 'checked_in' }],
    });

    expect(updated).not.toBe(registered);
    expect(updated.entries['booking-1']?.status).toBe('checked_in');
  });
});

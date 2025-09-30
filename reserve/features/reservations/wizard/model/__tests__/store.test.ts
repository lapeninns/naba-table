import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useWizardStore } from '../store';

import type { ApiBooking } from '../reducer';

const createBooking = (overrides: Partial<ApiBooking> = {}): ApiBooking => ({
  id: 'booking-1',
  restaurant_id: 'restaurant-1',
  customer_id: 'unknown',
  table_id: null,
  booking_date: '2025-05-10',
  start_time: '18:00',
  end_time: '20:00',
  reference: 'ABC123',
  party_size: 4,
  booking_type: 'dinner',
  seating_preference: 'indoor',
  status: 'confirmed',
  customer_name: 'Jane Doe',
  customer_email: 'jane@example.com',
  customer_phone: '+44123456789',
  notes: null,
  source: 'app',
  marketing_opt_in: true,
  loyalty_points_awarded: 0,
  created_at: '2025-05-01T10:00:00.000Z',
  updated_at: '2025-05-01T10:00:00.000Z',
  ...overrides,
});

describe('useWizardStore', () => {
  it('initialises with default booking details', () => {
    const { result } = renderHook(() => useWizardStore());

    expect(result.current.state.step).toBe(1);
    expect(result.current.state.details.restaurantId).toBeTruthy();
    expect(result.current.state.details.name).toBe('');
  });

  it('updates booking details through actions', () => {
    const { result } = renderHook(() => useWizardStore());

    act(() => {
      result.current.actions.updateDetails('name', 'Alex Johnson');
      result.current.actions.updateDetails('party', 5);
    });

    expect(result.current.state.details.name).toBe('Alex Johnson');
    expect(result.current.state.details.party).toBe(5);
  });

  it('applies confirmation payload and clears submitting state', () => {
    const { result } = renderHook(() => useWizardStore());

    act(() => {
      result.current.actions.setSubmitting(true);
    });

    expect(result.current.state.submitting).toBe(true);

    const booking = createBooking();

    act(() => {
      result.current.actions.applyConfirmation({
        bookings: [booking],
        booking,
        lastAction: 'create',
        waitlisted: false,
        allocationPending: false,
      });
    });

    expect(result.current.state.step).toBe(4);
    expect(result.current.state.submitting).toBe(false);
    expect(result.current.state.bookings).toHaveLength(1);
    expect(result.current.state.lastConfirmed?.id).toBe('booking-1');
  });

  it('resets wizard state', () => {
    const { result } = renderHook(() => useWizardStore());

    act(() => {
      result.current.actions.updateDetails('name', 'Reset Tester');
      result.current.actions.goToStep(3);
      result.current.actions.resetForm();
    });

    expect(result.current.state.step).toBe(1);
    expect(result.current.state.details.name).toBe('Reset Tester');
    expect(result.current.state.details.rememberDetails).toBe(true);
  });
});

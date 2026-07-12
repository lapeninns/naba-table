import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getInitialDetails,
  getInitialState,
  reducer,
  toBookingOption,
  type ApiBooking,
  type State,
} from '@features/reservations/wizard/model/reducer';

function makeBooking(overrides: Partial<ApiBooking> = {}): ApiBooking {
  return {
    id: 'booking-1',
    restaurant_id: 'rest-1',
    customer_id: 'cust-1',
    booking_date: '2026-04-14',
    start_time: '19:00:00',
    end_time: '20:30:00',
    reference: 'REF-123',
    party_size: 4,
    booking_type: 'dinner',
    status: 'confirmed',
    customer_name: 'Alex Guest',
    customer_email: 'alex@example.com',
    customer_phone: '+447123456789',
    notes: 'Window seat',
    source: 'api',
    marketing_opt_in: true,
    whatsapp_opt_in: false,
    loyalty_points_awarded: 0,
    created_at: '2026-04-01T10:00:00Z',
    updated_at: '2026-04-01T10:00:00Z',
    ...overrides,
  };
}

function makeState(overrides: Partial<State> = {}): State {
  return {
    ...getInitialState({
      restaurantId: 'rest-1',
      restaurantSlug: 'the-fox',
      restaurantName: 'The Fox',
      date: '2026-04-14',
      time: '18:00',
      party: 2,
      bookingType: 'dinner',
      name: 'Alex Guest',
      email: 'alex@example.com',
      phone: '+447123456789',
    }),
    ...overrides,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-04-10T12:00:00Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('toBookingOption', () => {
  it('keeps known booking options and falls back to the first for strangers @contract', () => {
    expect(toBookingOption('dinner')).toBe('dinner');
    expect(toBookingOption(' lunch ' as never)).toBe('lunch');
    expect(toBookingOption('brunch' as never)).toBe('lunch');
    expect(toBookingOption('' as never)).toBe('lunch');
  });
});

describe('getInitialDetails / getInitialState', () => {
  it("defaults the date to today's local calendar day @contract", () => {
    const details = getInitialDetails();
    // TZ-independent expectation: en-CA locale renders YYYY-MM-DD for "now".
    expect(details.date).toBe(new Date().toLocaleDateString('en-CA'));
    expect(details.party).toBe(1);
    expect(details.bookingType).toBe('lunch');
    expect(details.agree).toBe(false);
    expect(details.reservationDurationMinutes).toBeGreaterThan(0);
  });

  it('applies overrides without losing identity fields @contract', () => {
    const details = getInitialDetails({
      restaurantSlug: 'the-fox',
      restaurantId: undefined,
      party: 6,
      agree: true,
    });
    expect(details.restaurantSlug).toBe('the-fox');
    expect(details.restaurantId).toBe('');
    expect(details.party).toBe(6);
    expect(details.agree).toBe(false);
  });

  it('starts the wizard at step 1 with a clean slate @contract @smoke', () => {
    const state = getInitialState();
    expect(state.step).toBe(1);
    expect(state.error).toBeNull();
    expect(state.submissionError).toBeNull();
    expect(state.bookings).toEqual([]);
    expect(state.lastConfirmed).toBeNull();
  });
});

describe('reducer transitions', () => {
  it('SET_STEP moves the step and clears stale errors @contract', () => {
    const state = makeState({
      step: 3,
      error: 'No capacity',
      submissionError: {
        code: 'CAPACITY_EXCEEDED',
        message: 'No capacity',
        alternatives: [],
        retryable: false,
        retryAfter: null,
      },
    });

    const next = reducer(state, { type: 'SET_STEP', step: 1 });

    expect(next.step).toBe(1);
    expect(next.error).toBeNull();
    expect(next.submissionError).toBeNull();
  });

  it('SET_FIELD updates a detail and clears errors @contract', () => {
    const state = makeState({ error: 'stale' });

    const next = reducer(state, { type: 'SET_FIELD', key: 'time', value: '19:30' });

    expect(next.details.time).toBe('19:30');
    expect(next.error).toBeNull();
  });

  it('SET_CONFIRMATION lands on step 4 with the booking projected into details @contract', () => {
    const booking = makeBooking();
    const state = makeState({ step: 3, submitting: true, loading: true, editingId: 'booking-1' });

    const next = reducer(state, {
      type: 'SET_CONFIRMATION',
      payload: { bookings: [booking], booking, lastAction: 'create' },
    });

    expect(next.step).toBe(4);
    expect(next.submitting).toBe(false);
    expect(next.loading).toBe(false);
    expect(next.editingId).toBeNull();
    expect(next.lastAction).toBe('create');
    expect(next.lastConfirmed).toBe(booking);
    expect(next.details.bookingId).toBe('booking-1');
    // start_time arrives as HH:MM:SS and must be normalized to HH:MM.
    expect(next.details.time).toBe('19:00');
    expect(next.details.date).toBe('2026-04-14');
    expect(next.details.party).toBe(4);
    expect(next.details.bookingType).toBe('dinner');
    expect(next.details.marketingOptIn).toBe(true);
  });

  it('SET_CONFIRMATION without a booking keeps the previous confirmation details @contract', () => {
    const previous = makeBooking({ id: 'earlier' });
    const state = makeState({ lastConfirmed: previous });

    const next = reducer(state, {
      type: 'SET_CONFIRMATION',
      payload: { bookings: [], booking: null, lastAction: 'update' },
    });

    expect(next.step).toBe(4);
    expect(next.lastConfirmed).toBe(previous);
    expect(next.details.bookingId).toBeNull();
    expect(next.details.time).toBe('18:00');
  });

  it('START_EDIT hydrates details from the selected booking and returns to step 1 @contract', () => {
    const booking = makeBooking({ notes: null, whatsapp_opt_in: true });
    const state = makeState({ step: 4, bookings: [booking] });

    const next = reducer(state, { type: 'START_EDIT', bookingId: 'booking-1' });

    expect(next.step).toBe(1);
    expect(next.editingId).toBe('booking-1');
    expect(next.details.name).toBe('Alex Guest');
    expect(next.details.notes).toBe('');
    expect(next.details.whatsappOptIn).toBe(true);
    expect(next.details.time).toBe('19:00');
  });

  it('START_EDIT is a no-op for an unknown booking id @contract', () => {
    const state = makeState({ bookings: [makeBooking()] });
    expect(reducer(state, { type: 'START_EDIT', bookingId: 'missing' })).toBe(state);
  });

  it('RESET_FORM keeps contacts only when the guest asked to be remembered @contract', () => {
    const remembered = makeState();
    remembered.details.rememberDetails = true;

    const kept = reducer(remembered, { type: 'RESET_FORM' });
    expect(kept.details.name).toBe('Alex Guest');
    expect(kept.details.email).toBe('alex@example.com');
    expect(kept.details.rememberDetails).toBe(true);

    const forgotten = reducer(makeState(), { type: 'RESET_FORM' });
    expect(forgotten.details.name).toBe('');
    expect(forgotten.details.email).toBe('');
    expect(forgotten.details.phone).toBe('');
    expect(forgotten.step).toBe(1);
  });

  it('RESET_FORM reapplies the provided initial details @contract', () => {
    const next = reducer(makeState({ step: 4 }), {
      type: 'RESET_FORM',
      initialDetails: { restaurantSlug: 'the-fox', restaurantName: 'The Fox' },
    });

    expect(next.step).toBe(1);
    expect(next.details.restaurantSlug).toBe('the-fox');
    expect(next.details.restaurantName).toBe('The Fox');
  });

  it('HYDRATE_CONTACTS restores contacts and defaults rememberDetails to false @contract', () => {
    const state = makeState();
    state.details.agree = true;
    const next = reducer(state, {
      type: 'HYDRATE_CONTACTS',
      payload: { name: 'Sam', email: 'sam@example.com', phone: '+447000000000' },
    });

    expect(next.details.name).toBe('Sam');
    expect(next.details.rememberDetails).toBe(false);
    expect(next.details.agree).toBe(false);

    const explicit = reducer(makeState(), {
      type: 'HYDRATE_CONTACTS',
      payload: { name: 'Sam', email: '', phone: '', rememberDetails: true },
    });
    expect(explicit.details.rememberDetails).toBe(true);
  });

  it('HYDRATE_DETAILS merges a draft and resets to step 1 @contract', () => {
    const next = reducer(makeState({ step: 3, editingId: 'x', error: 'stale' }), {
      type: 'HYDRATE_DETAILS',
      details: { date: '2026-04-20', time: '20:00', agree: true },
    });

    expect(next.step).toBe(1);
    expect(next.editingId).toBeNull();
    expect(next.error).toBeNull();
    expect(next.details.date).toBe('2026-04-20');
    expect(next.details.time).toBe('20:00');
    expect(next.details.name).toBe('Alex Guest');
    expect(next.details.agree).toBe(false);
  });

  it('SET flags update submitting, loading, bookings and errors independently @contract', () => {
    let state = makeState();
    state = reducer(state, { type: 'SET_SUBMITTING', value: true });
    expect(state.submitting).toBe(true);

    state = reducer(state, { type: 'SET_LOADING', value: true });
    expect(state.loading).toBe(true);

    state = reducer(state, { type: 'SET_ERROR', message: 'boom' });
    expect(state.error).toBe('boom');

    const bookings = [makeBooking()];
    state = reducer(state, { type: 'SET_BOOKINGS', bookings });
    expect(state.bookings).toBe(bookings);
  });
});

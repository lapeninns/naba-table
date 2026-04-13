import { describe, expect, it } from 'vitest';

import { getInitialDetails } from '@features/reservations/wizard/model/reducer';
import { buildReservationDraft } from '@features/reservations/wizard/model/transformers';

describe('buildReservationDraft', () => {
  it('preserves an explicit booking type chosen from the schedule', () => {
    const details = getInitialDetails({
      restaurantId: 'rest-1',
      restaurantSlug: 'the-fox',
      date: '2026-03-29',
      time: '15:30',
      party: 2,
      bookingType: 'dinner',
      seating: 'indoor',
      name: 'Guest Booker',
      email: 'guest@example.com',
      phone: '+441234567890',
    });

    const result = buildReservationDraft(details);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error(result.error);
    }

    expect(result.draft.bookingType).toBe('dinner');
  });

  it('falls back to time-based inference when booking type is blank', () => {
    const details = getInitialDetails({
      restaurantId: 'rest-1',
      restaurantSlug: 'the-fox',
      date: '2026-03-29',
      time: '15:30',
      party: 2,
      bookingType: '' as never,
      seating: 'indoor',
      name: 'Guest Booker',
      email: 'guest@example.com',
      phone: '+441234567890',
    });

    const result = buildReservationDraft(details);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error(result.error);
    }

    expect(result.draft.bookingType).toBe('lunch');
  });

  it('allows slug-only drafts while restaurant id hydration is still pending', () => {
    const details = getInitialDetails({
      restaurantId: '',
      restaurantSlug: 'the-fox',
      date: '2026-03-29',
      time: '19:00',
      party: 2,
      bookingType: 'dinner',
      seating: 'indoor',
      name: 'Guest Booker',
      email: 'guest@example.com',
      phone: '+441234567890',
    });

    const result = buildReservationDraft(details);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error(result.error);
    }

    expect(result.draft.restaurantId).toBeUndefined();
    expect(result.draft.restaurantSlug).toBe('the-fox');
  });

  it('fails when both restaurant id and restaurant slug are missing', () => {
    const details = getInitialDetails({
      restaurantId: '',
      restaurantSlug: '',
      date: '2026-03-29',
      time: '19:00',
      party: 2,
      bookingType: 'dinner',
      seating: 'indoor',
      name: 'Guest Booker',
      email: 'guest@example.com',
      phone: '+441234567890',
    });

    const result = buildReservationDraft(details);

    expect(result).toEqual({
      ok: false,
      error: 'We could not determine which restaurant to book. Please refresh and try again.',
    });
  });
});

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

  it('allows nullable contact fields for ops drafts', () => {
    const details = getInitialDetails({
      restaurantId: 'rest-1',
      restaurantSlug: 'the-fox',
      date: '2026-03-29',
      time: '18:30',
      party: 2,
      bookingType: 'dinner',
      name: 'Walk In Guest',
      email: '',
      phone: '',
    });

    const result = buildReservationDraft(details, 'ops');

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error(result.error);
    }

    expect(result.draft.email).toBeNull();
    expect(result.draft.phone).toBeNull();
  });
});

import { describe, expect, it } from 'vitest';

import { getInitialDetails } from '@features/reservations/wizard/model/reducer';
import { buildReservationDraft } from '@features/reservations/wizard/model/transformers';

describe('buildReservationDraft', () => {
  it('preserves an explicit booking type chosen from the schedule @contract @smoke', () => {
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

  it('preserves explicit WhatsApp consent for the submitted phone number @contract', () => {
    const details = getInitialDetails({
      restaurantId: 'rest-1',
      restaurantSlug: 'the-fox',
      date: '2026-03-29',
      time: '19:30',
      party: 2,
      bookingType: 'dinner',
      name: 'Guest Booker',
      email: 'guest@example.com',
      phone: '+441234567890',
      whatsappOptIn: true,
    });

    const result = buildReservationDraft(details);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error(result.error);
    }

    expect(result.draft.whatsappOptIn).toBe(true);
  });

  it('falls back to time-based inference when booking type is blank @contract', () => {
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

  it('allows slug-only drafts while restaurant id hydration is still pending @contract', () => {
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

  it('fails when both restaurant id and restaurant slug are missing @contract', () => {
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

  it('allows nullable contact fields for ops drafts @contract', () => {
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

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { saveWizardDraft } from '@features/reservations/wizard/hooks/useWizardDraftStorage';

import type { BookingDetails } from '@features/reservations/wizard/model/reducer';

const LEGACY_DRAFT_KEY = 'reserve.wizard.draft';

function makeDetails(overrides: Partial<BookingDetails> = {}): BookingDetails {
  return {
    bookingId: null,
    restaurantId: 'restaurant-1',
    restaurantSlug: '',
    restaurantName: 'White Horse',
    restaurantAddress: '1 High Street',
    restaurantTimezone: 'Europe/London',
    reservationDurationMinutes: 90,
    date: '2026-04-05',
    time: '19:00',
    party: 2,
    bookingType: 'dinner',
    notes: 'Severe nut allergy - table 4 please',
    name: 'Test Guest',
    email: 'guest@example.com',
    phone: '+447950272147',
    rememberDetails: false,
    agree: true,
    marketingOptIn: false,
    ...overrides,
  };
}

describe('saveWizardDraft does not persist PII-bearing notes to localStorage', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it('blanks notes in the persisted draft (alongside name/email/phone)', () => {
    saveWizardDraft(makeDetails({ restaurantSlug: 'white-horse' }));

    const raw = window.localStorage.getItem(`${LEGACY_DRAFT_KEY}.white-horse`);
    expect(raw).not.toBeNull();
    expect(raw).not.toContain('Severe nut allergy');

    const parsed = JSON.parse(raw as string) as { details: BookingDetails };
    expect(parsed.details.notes).toBe('');
    // Existing privacy guarantees remain intact.
    expect(parsed.details.name).toBe('');
    expect(parsed.details.email).toBe('');
    expect(parsed.details.phone).toBe('');
    expect(parsed.details).not.toHaveProperty('agree');
  });
});

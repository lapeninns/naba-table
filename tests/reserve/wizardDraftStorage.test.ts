import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  loadWizardDraft,
  saveWizardDraft,
} from '@features/reservations/wizard/hooks/useWizardDraftStorage';

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
    notes: 'Window seat if possible',
    name: 'Test Guest',
    email: 'guest@example.com',
    phone: '+447950272147',
    rememberDetails: false,
    agree: true,
    marketingOptIn: false,
    ...overrides,
  };
}

function writeLegacyDraft(details: BookingDetails, expiresAt: number) {
  window.localStorage.setItem(
    LEGACY_DRAFT_KEY,
    JSON.stringify({
      version: 1,
      savedAt: expiresAt - 60_000,
      expiresAt,
      details,
    }),
  );
}

describe('loadWizardDraft', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-05T12:00:00Z'));
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it('ignores an unscoped legacy draft when loading a restaurant-scoped flow', () => {
    saveWizardDraft(makeDetails({ restaurantSlug: '' }));

    expect(loadWizardDraft('white-horse')).toBeNull();
  });

  it('returns a slug mismatch when a legacy draft belongs to a different restaurant', () => {
    writeLegacyDraft(makeDetails({ restaurantSlug: 'other-restaurant' }), Date.now() + 3_600_000);

    expect(loadWizardDraft('white-horse')).toMatchObject({
      slugMismatch: {
        expected: 'white-horse',
        stored: 'other-restaurant',
      },
      source: 'legacy',
    });
  });

  it('restores a matching legacy draft for the same restaurant slug', () => {
    writeLegacyDraft(
      makeDetails({
        restaurantSlug: 'white-horse',
        name: 'Legacy Guest',
        email: 'legacy@example.com',
        phone: '+447700900123',
      }),
      Date.now() + 3_600_000,
    );

    expect(loadWizardDraft('white-horse')).toMatchObject({
      expired: false,
      source: 'legacy',
      details: {
        restaurantSlug: 'white-horse',
        name: 'Legacy Guest',
        email: 'legacy@example.com',
        phone: '+447700900123',
      },
    });
  });

  it('restores a namespaced draft for restaurant-scoped flows', () => {
    saveWizardDraft(makeDetails({ restaurantSlug: 'white-horse' }));

    expect(loadWizardDraft('white-horse')).toMatchObject({
      expired: false,
      source: 'namespaced',
      details: {
        restaurantSlug: 'white-horse',
      },
    });
  });
});

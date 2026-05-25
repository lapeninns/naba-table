import { describe, expect, it } from 'vitest';

import {
  formatDepositGBP,
  resolveGuestProfileFacts,
} from '@/components/features/dashboard/booking-details/guestProfilePanelDomain';

import type { OpsTodayBooking } from '@/types/ops';

function makeBooking(overrides: Partial<OpsTodayBooking> = {}): OpsTodayBooking {
  return {
    id: 'booking-1',
    customerId: 'customer-1',
    status: 'confirmed',
    bookingType: 'standard',
    startTime: '18:00',
    endTime: '19:45',
    partySize: 4,
    customerName: 'Ava Patel',
    customerEmail: 'ava@example.com',
    customerPhone: '+44 7700 900123',
    notes: null,
    reference: 'ABC123',
    details: null,
    source: null,
    profileNotes: null,
    allergies: null,
    dietaryRestrictions: null,
    seatingPreference: null,
    marketingOptIn: null,
    tableAssignments: [],
    requiresTableAssignment: true,
    checkedInAt: null,
    checkedOutAt: null,
    ...overrides,
  };
}

describe('guestProfilePanelDomain', () => {
  it('formats numeric deposits and preserves non-numeric labels', () => {
    expect(formatDepositGBP(10)).toBe('£10.00');
    expect(formatDepositGBP('7.5')).toBe('£7.50');
    expect(formatDepositGBP('paid at venue')).toBe('paid at venue');
    expect(formatDepositGBP('')).toBe('£0.00');
    expect(formatDepositGBP(null)).toBeNull();
    expect(formatDepositGBP({ amount: 10 })).toBeNull();
  });

  it('resolves guest profile facts for rendered sections', () => {
    const facts = resolveGuestProfileFacts({
      booking: makeBooking({
        details: {
          occasion: 'birthday',
          depositAmount: '12.5',
        },
        source: 'google',
        allergies: ['nuts'],
        notes: 'Window table',
      }),
      bookingDate: '2026-05-20',
      timezone: 'Europe/London',
      status: 'confirmed',
      minutesRemaining: -5,
    });

    expect(facts).toEqual({
      formattedStartTime: '18:00',
      durationMinutes: 105,
      whatsappHref: 'https://wa.me/447700900123',
      sourceLabel: 'google',
      occasionLabel: 'birthday',
      depositLabel: '£12.50',
      initials: 'AP',
      isLate: true,
      hasDietary: true,
      showCountdown: true,
      hasNotes: true,
    });
  });

  it('uses conservative fallbacks when optional booking facts are absent', () => {
    const facts = resolveGuestProfileFacts({
      booking: makeBooking({
        customerPhone: null,
        details: {},
        endTime: null,
        source: null,
      }),
      bookingDate: null,
      timezone: 'Europe/London',
      status: 'completed',
      minutesRemaining: 15,
    });

    expect(facts).toMatchObject({
      formattedStartTime: '18:00',
      durationMinutes: null,
      whatsappHref: null,
      sourceLabel: 'Direct',
      occasionLabel: 'Standard',
      depositLabel: null,
      isLate: false,
      hasDietary: false,
      showCountdown: false,
      hasNotes: false,
    });
  });
});

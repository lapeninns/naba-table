import { describe, expect, it } from 'vitest';

import {
  BOOKING_BLOCKING_STATUSES,
  BOOKING_STATUSES,
  BOOKING_TYPES,
  SEATING_PREFERENCES,
  ensureBookingStatus,
  ensureBookingType,
  ensureSeatingPreference,
  isBookingStatus,
  isBookingType,
  isSeatingPreference,
} from '@shared/config/booking';

describe('booking type guards', () => {
  it('accepts every declared booking type and rejects strangers @contract', () => {
    for (const type of BOOKING_TYPES) {
      expect(isBookingType(type)).toBe(true);
    }
    expect(isBookingType('brunch')).toBe(false);
    expect(isBookingType('')).toBe(false);
  });

  it('accepts every declared booking status and rejects strangers @contract', () => {
    for (const status of BOOKING_STATUSES) {
      expect(isBookingStatus(status)).toBe(true);
    }
    expect(isBookingStatus('archived')).toBe(false);
  });

  it('accepts every declared seating preference and rejects strangers @contract', () => {
    for (const preference of SEATING_PREFERENCES) {
      expect(isSeatingPreference(preference)).toBe(true);
    }
    expect(isSeatingPreference('rooftop')).toBe(false);
  });

  it('keeps blocking statuses a subset of booking statuses that excludes cancelled @contract', () => {
    for (const status of BOOKING_BLOCKING_STATUSES) {
      expect(BOOKING_STATUSES).toContain(status);
    }
    expect(BOOKING_BLOCKING_STATUSES).not.toContain('cancelled');
  });
});

describe('ensureBookingType', () => {
  it('trims whitespace before validating @contract', () => {
    expect(ensureBookingType(' dinner ')).toBe('dinner');
  });

  it('throws a required-value error for unknown or blank types @contract', () => {
    expect(() => ensureBookingType('brunch')).toThrow('Invalid booking type: value is required.');
    expect(() => ensureBookingType('')).toThrow('Invalid booking type: value is required.');
  });

  it('uses the supplied field name in errors @contract', () => {
    expect(() => ensureBookingType('brunch', 'service')).toThrow('Invalid service: value is required.');
  });
});

describe('ensureBookingStatus / ensureSeatingPreference', () => {
  it('returns valid values unchanged @contract', () => {
    expect(ensureBookingStatus('confirmed')).toBe('confirmed');
    expect(ensureSeatingPreference('outdoor')).toBe('outdoor');
  });

  it('lists the valid values when rejecting @contract', () => {
    expect(() => ensureBookingStatus('archived')).toThrow(
      'Invalid booking status: archived. Valid values: "pending", "pending_allocation", "confirmed", "cancelled".',
    );
    expect(() => ensureSeatingPreference('rooftop')).toThrow(
      'Invalid seating preference: rooftop. Valid values: "any", "indoor", "outdoor", "window", "booth", "bar".',
    );
  });
});

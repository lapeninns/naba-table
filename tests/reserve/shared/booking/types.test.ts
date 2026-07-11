import { describe, expect, it } from 'vitest';

import { BOOKING_OPTIONS, isBookingOption } from '@shared/booking/types';
import { BOOKING_TYPES_UI } from '@shared/config/booking';

describe('BOOKING_OPTIONS', () => {
  it('mirrors the UI booking types @contract', () => {
    expect(BOOKING_OPTIONS).toEqual(BOOKING_TYPES_UI);
    expect(BOOKING_OPTIONS).toEqual(['lunch', 'dinner']);
  });
});

describe('isBookingOption', () => {
  it('accepts declared options and rejects everything else @contract', () => {
    expect(isBookingOption('lunch')).toBe(true);
    expect(isBookingOption('dinner')).toBe(true);
    expect(isBookingOption('brunch')).toBe(false);
    expect(isBookingOption('')).toBe(false);
    expect(isBookingOption(null)).toBe(false);
    expect(isBookingOption(undefined)).toBe(false);
  });

  it('respects a custom options list @contract', () => {
    expect(isBookingOption('dinner', ['lunch'])).toBe(false);
    expect(isBookingOption('lunch', ['lunch'])).toBe(true);
  });
});

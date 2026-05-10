import { describe, expect, it } from 'vitest';

import {
  getBookingRecoveryPrimaryAction,
  getGuestBookingsLandingContent,
  getReservationThankYouContent,
} from '@/guest/routes/auth-aware-content';

describe('guest auth-aware content', () => {
  it('points signed-out guests through sign-in when account access is needed', () => {
    const content = getGuestBookingsLandingContent(false);

    expect(content.secondaryAction).toEqual({
      href: '/auth/signin?redirectedFrom=/guest/bookings',
      label: 'Sign in',
    });
    expect(content.existingAction).toEqual({
      href: '/auth/signin?redirectedFrom=/guest/bookings',
      label: 'Sign in to view bookings',
    });
    expect(getBookingRecoveryPrimaryAction(false)).toEqual({
      href: '/auth/signin',
      label: 'Sign in',
    });
  });

  it('sends signed-in guests directly to their booking portal', () => {
    const content = getGuestBookingsLandingContent(true);

    expect(content.secondaryAction).toEqual({
      href: '/guest/bookings',
      label: 'My bookings',
    });
    expect(content.existingAction).toEqual({
      href: '/guest/bookings',
      label: 'Open my bookings',
    });
    expect(getBookingRecoveryPrimaryAction(true)).toEqual({
      href: '/guest/bookings',
      label: 'Open my bookings',
    });
  });

  it('uses the right thank-you action for each auth state', () => {
    expect(getReservationThankYouContent(false, 'Old Crown Girton').primaryAction).toEqual({
      href: '/auth/signin?redirectedFrom=/guest/bookings',
      label: 'Sign in to view bookings',
    });
    expect(getReservationThankYouContent(true, 'Old Crown Girton').primaryAction).toEqual({
      href: '/guest/bookings',
      label: 'View my bookings',
    });
  });
});

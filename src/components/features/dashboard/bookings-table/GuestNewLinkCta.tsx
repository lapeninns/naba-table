'use client';

import Link from 'next/link';
import React from 'react';

import { Button } from '@/components/ui/button';

/**
 * Guest booking-access failures that a fresh emailed link fixes: the booking cookie
 * expired, was revoked (the contact changed), or could not be read.
 */
export function isGuestAccessLinkErrorCode(code: string | null | undefined): boolean {
  return (
    typeof code === 'string' &&
    (code.startsWith('ACCESS_TOKEN_') || code === 'INVALID_ACCESS_TOKEN')
  );
}

export const GUEST_ACCESS_LINK_ERROR_COPY: Record<string, string> = {
  ACCESS_TOKEN_EXPIRED:
    'Your link to this booking has expired. We can email you a new one to keep managing it.',
  ACCESS_TOKEN_REVOKED:
    'Your link to this booking is no longer valid. We can email you a new one to keep managing it.',
  INVALID_ACCESS_TOKEN:
    'We couldn’t confirm your link to this booking. We can email you a new one to keep managing it.',
};

export function buildFindBookingHref(restaurantSlug?: string | null): string {
  const slug = restaurantSlug?.trim();
  return slug ? `/bookings/find?restaurant=${encodeURIComponent(slug)}` : '/bookings/find';
}

/** "Get a new link" call to action for guest dialogs, shown on an access-link error. */
export function GuestNewLinkCta({ restaurantSlug }: { restaurantSlug?: string | null }) {
  return (
    <Button asChild variant="outline" size="sm">
      <Link href={buildFindBookingHref(restaurantSlug)}>Get a new link</Link>
    </Button>
  );
}

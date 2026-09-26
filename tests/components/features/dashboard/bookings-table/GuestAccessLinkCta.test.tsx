import { render, screen } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const cancelMutation = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  isPending: false,
  error: null as null | { code?: string; message: string; status?: number },
}));
vi.mock('@/hooks/useCancelBooking', () => ({ useCancelBooking: () => cancelMutation }));

import { CancelBookingDialog } from '@/components/features/dashboard/bookings-table/CancelBookingDialog';
import {
  buildFindBookingHref,
  isGuestAccessLinkErrorCode,
} from '@/components/features/dashboard/bookings-table/GuestNewLinkCta';

import type { BookingDTO } from '@/hooks/useBookings';

const booking = {
  id: '65c3207e-318a-4e4b-b82d-1249a720d776',
  restaurantName: 'The Fox',
  restaurantSlug: 'the-fox',
  partySize: 2,
  startIso: '2026-10-10T18:00:00.000Z',
  endIso: '2026-10-10T19:30:00.000Z',
  status: 'confirmed',
  notes: null,
} as unknown as BookingDTO;

function newLinkCta() {
  return screen.queryByRole('link', { name: 'Get a new link' });
}

describe('guest dialogs: "Get a new link" on booking-link errors', () => {
  beforeEach(() => {
    cancelMutation.error = null;
  });

  it.each(['ACCESS_TOKEN_EXPIRED', 'ACCESS_TOKEN_REVOKED'])(
    'cancel dialog offers /bookings/find for %s',
    (code) => {
      cancelMutation.error = { code, message: 'raw server text', status: 410 };
      render(<CancelBookingDialog booking={booking} open onOpenChange={vi.fn()} />);

      expect(screen.getByRole('alert')).toHaveTextContent('email you a new one');
      expect(newLinkCta()).toHaveAttribute('href', '/bookings/find?restaurant=the-fox');
    },
  );

  it('cancel dialog shows no CTA for other errors', () => {
    cancelMutation.error = { code: 'BOOKING_NOT_CANCELLABLE', message: 'x', status: 409 };
    render(<CancelBookingDialog booking={booking} open onOpenChange={vi.fn()} />);

    expect(screen.getByRole('alert')).toHaveTextContent('can no longer be cancelled online');
    expect(newLinkCta()).toBeNull();
  });
});

// EditBookingDialog cannot be rendered under vitest yet: its '@/hooks/ops/useOpsUpdateBooking'
// import has no vitest alias (the hook lives under src/hooks/ops). Its CTA uses the same
// helpers, covered here; the render test is an integrator follow-up.
describe('guest access-link CTA helpers', () => {
  it.each([
    ['ACCESS_TOKEN_EXPIRED', true],
    ['ACCESS_TOKEN_REVOKED', true],
    ['ACCESS_TOKEN_IN_URL_REJECTED', true],
    ['INVALID_ACCESS_TOKEN', true],
    ['UNAUTHENTICATED', false],
    ['MODIFICATION_NO_TABLES', false],
    [undefined, false],
  ])('%s -> %s', (code, expected) => {
    expect(isGuestAccessLinkErrorCode(code)).toBe(expected);
  });

  it('builds the find-booking href with an encoded venue slug', () => {
    expect(buildFindBookingHref(null)).toBe('/bookings/find');
    expect(buildFindBookingHref(' the fox ')).toBe('/bookings/find?restaurant=the%20fox');
  });
});

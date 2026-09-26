import { render, screen } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type MutationError = unknown;

const guestMutation = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  isPending: false,
  error: null as MutationError,
}));
const opsMutation = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  isPending: false,
  error: null as MutationError,
}));

vi.mock('@/hooks/useUpdateBooking', () => ({ useUpdateBooking: () => guestMutation }));
vi.mock('@/hooks/ops/useOpsUpdateBooking', () => ({ useOpsUpdateBooking: () => opsMutation }));
vi.mock('@/components/features/booking-state-machine', () => ({
  ScheduleAwareTimestampPicker: () => <div data-testid="timestamp-picker" />,
}));

import { EditBookingDialog } from '@/components/features/dashboard/bookings-table/EditBookingDialog';
import { HttpError } from '@/lib/http/errors';
import { DEFAULT_ERROR_COPY } from '@/lib/http/userMessage';

import type { BookingDTO } from '@/hooks/useBookings';

const booking = {
  id: '65c3207e-318a-4e4b-b82d-1249a720d776',
  restaurantId: '11111111-1111-4111-8111-111111111111',
  restaurantName: 'The Fox',
  restaurantSlug: 'the-fox',
  restaurantTimezone: 'Europe/London',
  partySize: 2,
  startIso: '2026-10-10T18:00:00.000Z',
  endIso: '2026-10-10T19:30:00.000Z',
  status: 'confirmed',
  notes: null,
} as unknown as BookingDTO;

function newLinkCta() {
  return screen.queryByRole('link', { name: 'Get a new link' });
}

describe('EditBookingDialog: guest "Get a new link" CTA', () => {
  beforeEach(() => {
    guestMutation.error = null;
    opsMutation.error = null;
  });

  it.each(['ACCESS_TOKEN_EXPIRED', 'ACCESS_TOKEN_REVOKED', 'UNAUTHENTICATED'])(
    'guest mode offers /bookings/find with guest copy for %s',
    (code) => {
      guestMutation.error = new HttpError({ code, message: 'raw server text', status: 401 });
      render(<EditBookingDialog booking={booking} open onOpenChange={vi.fn()} />);

      expect(screen.getByText(/email you a new one/)).toBeInTheDocument();
      expect(screen.queryByText('raw server text')).toBeNull();
      expect(newLinkCta()).toHaveAttribute('href', '/bookings/find?restaurant=the-fox');
    },
  );

  it('guest mode shows no CTA for ACCESS_TOKEN_NOT_CONFIGURED', () => {
    guestMutation.error = new HttpError({
      code: 'ACCESS_TOKEN_NOT_CONFIGURED',
      message: 'Booking access is temporarily unavailable.',
      status: 503,
    });
    render(<EditBookingDialog booking={booking} open onOpenChange={vi.fn()} />);

    expect(newLinkCta()).toBeNull();
  });

  it('ops mode keeps its own copy and never shows the guest CTA', () => {
    opsMutation.error = new HttpError({
      code: 'ACCESS_TOKEN_EXPIRED',
      message: 'Server message',
      status: 401,
    });
    const { unmount } = render(
      <EditBookingDialog booking={booking} mode="ops" open onOpenChange={vi.fn()} />,
    );

    expect(screen.getByText('Server message')).toBeInTheDocument();
    expect(screen.queryByText(/email you a new one/)).toBeNull();
    expect(newLinkCta()).toBeNull();
    unmount();

    opsMutation.error = new HttpError({
      code: 'UNAUTHENTICATED',
      message: 'Server message',
      status: 401,
    });
    render(<EditBookingDialog booking={booking} mode="ops" open onOpenChange={vi.fn()} />);

    expect(screen.getByText('Please sign in again to continue.')).toBeInTheDocument();
    expect(newLinkCta()).toBeNull();
  });

  it('ops mode never shows a raw 5xx or gateway message', () => {
    opsMutation.error = new HttpError({
      code: 'HTTP_502',
      message: 'Request failed with status 502',
      status: 502,
      hasServerMessage: false,
    });
    render(<EditBookingDialog booking={booking} mode="ops" open onOpenChange={vi.fn()} />);

    expect(screen.queryByText('Request failed with status 502')).toBeNull();
    expect(screen.getByText(DEFAULT_ERROR_COPY.server)).toBeInTheDocument();
  });

  it.each([['ops'], ['guest']] as const)(
    '%s mode shows network copy for a fetch failure instead of the raw TypeError',
    (mode) => {
      const failure = new TypeError('Failed to fetch');
      if (mode === 'ops') opsMutation.error = failure;
      else guestMutation.error = failure;
      render(
        <EditBookingDialog
          booking={booking}
          {...(mode === 'ops' ? { mode: 'ops' as const } : {})}
          open
          onOpenChange={vi.fn()}
        />,
      );

      expect(screen.queryByText('Failed to fetch')).toBeNull();
      expect(screen.getByText(DEFAULT_ERROR_COPY.network)).toBeInTheDocument();
    },
  );
});

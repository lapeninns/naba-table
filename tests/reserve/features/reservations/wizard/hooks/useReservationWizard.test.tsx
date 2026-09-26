import { act, renderHook, waitFor } from '@testing-library/react';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useReservationWizard } from '@features/reservations/wizard/hooks/useReservationWizard';

const harness = vi.hoisted(() => ({
  savePreferences: vi.fn(),
  customerMutateAsync: vi.fn(),
}));

vi.mock('@/hooks/useGuestPreferences', () => ({
  useGuestPreferences: () => ({
    preferences: {
      preferredPartySize: 6,
      preferredTime: '20:00',
    },
    savePreferences: harness.savePreferences,
  }),
}));

vi.mock('@/hooks/useOnlineStatus', () => ({
  useOnlineStatus: () => true,
}));

vi.mock('@features/reservations/wizard/api/useCreateReservation', () => ({
  useCreateReservation: () => ({
    isPending: false,
    isPaused: false,
    isSuccess: false,
    mutateAsync: harness.customerMutateAsync,
  }),
}));

vi.mock('@features/reservations/wizard/api/useCreateOpsReservation', () => ({
  useCreateOpsReservation: () => ({
    isPending: false,
    isPaused: false,
    isSuccess: false,
    mutateAsync: vi.fn(),
  }),
}));

beforeEach(() => {
  harness.savePreferences.mockReset();
  harness.customerMutateAsync.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

const customerDetails = {
  restaurantId: '11111111-1111-4111-8111-111111111111',
  restaurantSlug: 'the-fox',
  restaurantName: 'The Fox',
  restaurantTimezone: 'Europe/London',
  date: '2026-10-10',
  time: '19:00',
  party: 2,
  name: 'Guest Booker',
  email: 'guest@example.com',
  phone: '+447700900123',
};

const reservation = {
  id: '65c3207e-318a-4e4b-b82d-1249a720d776',
  restaurantId: customerDetails.restaurantId,
  bookingDate: '2026-10-10',
  startTime: '19:00',
  endTime: '20:30',
  partySize: 2,
  status: 'confirmed',
  reference: 'NB1',
  customerName: 'G***',
  customerEmail: '',
  customerPhone: '',
  notes: null,
};

describe('useReservationWizard', () => {
  it('does not restore a filtered-out 20:00 guest preference in ops mode @regression', async () => {
    const { result } = renderHook(() =>
      useReservationWizard(
        {
          restaurantId: 'restaurant-1',
          restaurantSlug: 'the-old-crown-girton',
          restaurantName: 'The Old Crown Girton',
          restaurantAddress: '89 High Street',
          restaurantTimezone: 'Europe/London',
          date: '2026-07-16',
          time: '',
          party: 2,
        },
        'ops',
      ),
    );

    await waitFor(() => {
      expect(result.current.state.details.time).toBe('');
      expect(result.current.state.details.party).toBe(2);
    });
    expect(harness.savePreferences).not.toHaveBeenCalled();
  });

  it('retries a timed-out submission with the same variables and applies the replayed booking (§49)', async () => {
    vi.useFakeTimers();
    harness.customerMutateAsync
      .mockRejectedValueOnce({ code: 'TIMEOUT' })
      .mockResolvedValueOnce({ booking: reservation, bookings: [reservation] });

    const { result } = renderHook(() => useReservationWizard(customerDetails, 'customer'));

    let pending: Promise<void> | undefined;
    act(() => {
      pending = result.current.handleConfirm();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
      await pending;
    });

    expect(harness.customerMutateAsync).toHaveBeenCalledTimes(2);
    const [first] = harness.customerMutateAsync.mock.calls[0];
    const [second] = harness.customerMutateAsync.mock.calls[1];
    expect(second).toEqual(first);
    expect(result.current.state.error ?? null).toBeNull();
  });

  it('treats BOOKING_NOT_COMPLETED after a timeout as terminal and shows its message', async () => {
    vi.useFakeTimers();
    const notCompleted = Object.assign(new Error("We couldn't complete this booking."), {
      code: 'BOOKING_NOT_COMPLETED',
      status: 409,
    });
    harness.customerMutateAsync
      .mockRejectedValueOnce({ code: 'TIMEOUT' })
      .mockRejectedValueOnce(notCompleted);

    const { result } = renderHook(() => useReservationWizard(customerDetails, 'customer'));

    let pending: Promise<void> | undefined;
    act(() => {
      pending = result.current.handleConfirm();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
      await pending;
    });

    expect(harness.customerMutateAsync).toHaveBeenCalledTimes(2);
    expect(result.current.state.error).toBeTruthy();
  });

  it('never looks bookings up by contact details from the wizard (grep guard)', () => {
    const root = join(process.cwd(), 'reserve');
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        const path = join(dir, entry);
        if (statSync(path).isDirectory()) {
          walk(path);
        } else if (/\.(ts|tsx)$/.test(entry)) {
          const source = readFileSync(path, 'utf8');
          if (
            /bookings\?(email|phone)=|fetchBookingsByContact|recoverBookingAfterTimeout/.test(
              source,
            )
          ) {
            offenders.push(path);
          }
        }
      }
    };
    walk(root);
    expect(offenders).toEqual([]);
  });
});

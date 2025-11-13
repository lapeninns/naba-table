import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { reservationFixture } from '@/tests/fixtures/wizard';
import { WizardDependenciesProvider } from '@features/reservations/wizard/di';

import { useReservationWizard } from '../useReservationWizard';

const mutateAsync = vi.fn();
const fetchBookingsByContactMock = vi.fn();

vi.mock('@features/reservations/wizard/api/useCreateReservation', () => ({
  useCreateReservation: () => ({
    mutateAsync,
    isPending: false,
    isPaused: false,
    isSuccess: false,
  }),
}));

vi.mock('@features/reservations/wizard/api/useCreateOpsReservation', () => ({
  useCreateOpsReservation: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
    isPaused: false,
    isSuccess: false,
  }),
}));

vi.mock('@features/reservations/wizard/api/fetchBookingsByContact', () => ({
  fetchBookingsByContact: (...args: unknown[]) => fetchBookingsByContactMock(...args),
}));

vi.mock('@reserve/shared/hooks/useStickyProgress', () => ({
  useStickyProgress: () => ({
    stickyVisible: false,
    stickyActions: [],
    stickyHeight: 0,
    handleActionsChange: vi.fn(),
    handleStickyHeightChange: vi.fn(),
  }),
}));

describe('useReservationWizard — timeout recovery', () => {
  beforeEach(() => {
    mutateAsync.mockReset();
    fetchBookingsByContactMock.mockReset();
  });

  const createWrapper =
    (analytics = { track: vi.fn() }) =>
    ({ children }: { children: React.ReactNode }) => {
      const queryClient = new QueryClient({
        defaultOptions: {
          queries: { retry: false },
          mutations: { retry: false },
        },
      });
      const navigator = { push: vi.fn(), replace: vi.fn(), back: vi.fn() };
      const errorReporter = { capture: vi.fn() };

      return (
        <QueryClientProvider client={queryClient}>
          <WizardDependenciesProvider value={{ analytics, navigator, errorReporter }}>
            {children}
          </WizardDependenciesProvider>
        </QueryClientProvider>
      );
    };

  it('hydrates booking when lookup succeeds after timeout', async () => {
    mutateAsync.mockRejectedValueOnce({ code: 'TIMEOUT' });
    const recoveryReservation = reservationFixture({
      bookingDate: '2025-12-24',
      startTime: '19:00',
      partySize: 4,
      restaurantId: 'rest-timeout',
      customerEmail: 'guest@example.com',
      customerPhone: '+1 555 000 1111',
      createdAt: new Date().toISOString(),
    });
    fetchBookingsByContactMock.mockResolvedValue([recoveryReservation]);

    const analytics = { track: vi.fn() };
    const { result } = renderHook(
      () =>
        useReservationWizard({
          restaurantId: recoveryReservation.restaurantId,
          date: recoveryReservation.bookingDate,
          time: recoveryReservation.startTime,
          party: recoveryReservation.partySize,
          bookingType: 'dinner',
          seating: 'indoor',
          notes: null,
          name: recoveryReservation.customerName,
          email: recoveryReservation.customerEmail,
          phone: recoveryReservation.customerPhone,
          marketingOptIn: false,
        }),
      { wrapper: createWrapper(analytics) },
    );

    await act(async () => {
      await result.current.handleConfirm();
    });

    expect(fetchBookingsByContactMock).toHaveBeenCalledTimes(1);
    expect(analytics.track).toHaveBeenCalledWith(
      'booking_created',
      expect.objectContaining({ recovered: true }),
    );
    expect(result.current.state.loading).toBe(false);
  });

  it('surfaces error and tracks analytics when recovery fails', async () => {
    mutateAsync.mockRejectedValueOnce({ code: 'TIMEOUT' });
    fetchBookingsByContactMock.mockResolvedValue([]);

    const analytics = { track: vi.fn() };
    const { result } = renderHook(
      () =>
        useReservationWizard({
          restaurantId: 'rest-timeout',
          date: '2025-12-24',
          time: '19:00',
          party: 2,
          bookingType: 'dinner',
          seating: 'indoor',
          notes: null,
          name: 'Guest Example',
          email: 'guest@example.com',
          phone: '+1 555 000 2222',
          marketingOptIn: false,
        }),
      { wrapper: createWrapper(analytics) },
    );

    await act(async () => {
      await result.current.handleConfirm();
    });

    expect(fetchBookingsByContactMock).toHaveBeenCalledTimes(3);
    expect(analytics.track).toHaveBeenCalledWith(
      'booking_timeout_unrecovered',
      expect.objectContaining({ context: 'customer' }),
    );
    expect(result.current.state.error).toContain('could not confirm');
  });
});

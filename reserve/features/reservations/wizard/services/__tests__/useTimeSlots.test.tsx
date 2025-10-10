import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useTimeSlots } from '@reserve/features/reservations/wizard/services';

const getMock = vi.fn();

vi.mock('@shared/api/client', () => ({
  apiClient: {
    get: (...args: unknown[]) => getMock(...args),
  },
}));

const scheduleFixture = {
  restaurantId: 'rest-1',
  date: '2025-05-08',
  timezone: 'Europe/London',
  intervalMinutes: 15,
  defaultDurationMinutes: 90,
  window: { opensAt: '12:00', closesAt: '22:00' },
  isClosed: false,
  slots: [
    {
      value: '12:00',
      display: '12:00',
      periodId: 'sp-lunch',
      periodName: 'Lunch',
      bookingOption: 'lunch',
      defaultBookingOption: 'lunch',
      availability: {
        services: { lunch: 'enabled', dinner: 'disabled', drinks: 'enabled' },
        labels: {
          happyHour: false,
          drinksOnly: false,
          kitchenClosed: false,
          lunchWindow: true,
          dinnerWindow: false,
        },
      },
      disabled: false,
    },
    {
      value: '21:00',
      display: '21:00',
      periodId: 'sp-drinks',
      periodName: null,
      bookingOption: 'drinks',
      defaultBookingOption: 'drinks',
      availability: {
        services: { lunch: 'disabled', dinner: 'disabled', drinks: 'enabled' },
        labels: {
          happyHour: false,
          drinksOnly: true,
          kitchenClosed: true,
          lunchWindow: false,
          dinnerWindow: false,
        },
      },
      disabled: false,
    },
  ],
};

afterEach(() => {
  getMock.mockReset();
});

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('useTimeSlots hook', () => {
  it('fetches schedule and exposes slot data', async () => {
    getMock.mockResolvedValueOnce(scheduleFixture);
    const wrapper = createWrapper();

    const { result, rerender } = renderHook(
      ({ selectedTime }) =>
        useTimeSlots({
          restaurantSlug: 'sajiloreservex-test-kitchen',
          date: '2025-05-08',
          selectedTime,
        }),
      {
        wrapper,
        initialProps: { selectedTime: '12:00' as string | null },
      },
    );

    await waitFor(() => {
      expect(result.current.slots).toHaveLength(2);
    });

    expect(result.current.slots[0]?.label).toBe('Lunch');
    expect(result.current.serviceAvailability.services.lunch).toBe('enabled');
    expect(result.current.inferBookingOption('21:00')).toBe('drinks');

    rerender({ selectedTime: '21:00' });

    await waitFor(() => {
      expect(result.current.serviceAvailability.labels.drinksOnly).toBe(true);
    });

    expect(getMock).toHaveBeenCalledWith(
      '/restaurants/sajiloreservex-test-kitchen/schedule?date=2025-05-08',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it('returns empty slots when restaurant slug missing', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(
      () => useTimeSlots({ restaurantSlug: null, date: '2025-05-08', selectedTime: null }),
      { wrapper },
    );

    expect(result.current.slots).toHaveLength(0);
    expect(result.current.serviceAvailability.services.lunch).toBe('disabled');
    expect(getMock).not.toHaveBeenCalled();
  });
});

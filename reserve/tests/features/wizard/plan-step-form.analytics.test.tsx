import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { wizardStateFixture } from '@/tests/fixtures/wizard';
import { usePlanStepForm } from '@features/reservations/wizard/hooks/usePlanStepForm';

const getMock = vi.fn();

vi.mock('@shared/api/client', () => ({
  apiClient: {
    get: (...args: unknown[]) => getMock(...args),
  },
}));

const scheduleFixture = {
  restaurantId: 'rest-1',
  date: '2025-05-12',
  timezone: 'Europe/London',
  intervalMinutes: 15,
  defaultDurationMinutes: 90,
  window: { opensAt: '12:00', closesAt: '22:00' },
  isClosed: false,
  availableBookingOptions: ['lunch', 'dinner', 'drinks'],
  occasionCatalog: [
    {
      key: 'lunch',
      label: 'Lunch',
      shortLabel: 'Lunch',
      description: null,
      availability: [],
      defaultDurationMinutes: 90,
      displayOrder: 10,
      isActive: true,
    },
    {
      key: 'dinner',
      label: 'Dinner',
      shortLabel: 'Dinner',
      description: null,
      availability: [],
      defaultDurationMinutes: 120,
      displayOrder: 20,
      isActive: true,
    },
    {
      key: 'drinks',
      label: 'Drinks & Cocktails',
      shortLabel: 'Drinks',
      description: null,
      availability: [],
      defaultDurationMinutes: 75,
      displayOrder: 30,
      isActive: true,
    },
  ],
  slots: [
    {
      value: '12:00',
      display: '12:00',
      periodId: 'sp-lunch',
      periodName: 'Lunch',
      bookingOption: 'lunch',
      defaultBookingOption: 'lunch',
      availability: {
        services: { lunch: 'enabled', dinner: 'disabled', drinks: 'disabled' },
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
      value: '18:00',
      display: '18:00',
      periodId: 'sp-dinner',
      periodName: 'Dinner',
      bookingOption: 'dinner',
      defaultBookingOption: 'dinner',
      availability: {
        services: { lunch: 'disabled', dinner: 'enabled', drinks: 'enabled' },
        labels: {
          happyHour: false,
          drinksOnly: false,
          kitchenClosed: false,
          lunchWindow: false,
          dinnerWindow: true,
        },
      },
      disabled: false,
    },
    {
      value: '21:00',
      display: '21:00',
      periodId: 'sp-drinks',
      periodName: 'Nightcap',
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

beforeEach(() => {
  getMock.mockReset();
  getMock.mockResolvedValue(scheduleFixture);
});

const createPlanState = () =>
  wizardStateFixture({
    date: '2025-05-10',
    time: '12:00',
  });

describe('usePlanStepForm analytics', () => {
  it('tracks select_date when choosing a date', async () => {
    const onTrack = vi.fn();
    const state = createPlanState();
    const updateDetails = vi.fn();
    const goToStep = vi.fn();

    const wrapper = createWrapper();

    const { result } = renderHook(
      () =>
        usePlanStepForm({
          state,
          actions: { updateDetails, goToStep },
          onActionsChange: vi.fn(),
          onTrack,
          minDate: new Date('2025-05-01T00:00:00Z'),
        }),
      { wrapper },
    );

    await act(async () => {
      result.current.handlers.selectDate(new Date('2025-05-20T12:00:00Z'));
    });

    expect(onTrack).toHaveBeenCalledWith(
      'select_date',
      expect.objectContaining({ date: expect.any(String) }),
    );
  });

  it('tracks select_party when changing party size', async () => {
    const onTrack = vi.fn();
    const state = createPlanState();
    const updateDetails = vi.fn();
    const goToStep = vi.fn();

    const wrapper = createWrapper();

    const { result } = renderHook(
      () =>
        usePlanStepForm({
          state,
          actions: { updateDetails, goToStep },
          onActionsChange: vi.fn(),
          onTrack,
          minDate: new Date('2025-05-01T00:00:00Z'),
        }),
      { wrapper },
    );

    await act(async () => {
      result.current.handlers.changeParty('increment');
    });

    expect(onTrack).toHaveBeenCalledWith('select_party', expect.objectContaining({ party: 2 }));
  });

  it('exposes time slot suggestions for a selected date', async () => {
    const state = wizardStateFixture({
      date: '2025-05-12',
      time: '18:00',
    });
    const updateDetails = vi.fn();
    const goToStep = vi.fn();

    const wrapper = createWrapper();

    const { result } = renderHook(
      () =>
        usePlanStepForm({
          state,
          actions: { updateDetails, goToStep },
          onActionsChange: vi.fn(),
          minDate: new Date('2025-05-01T00:00:00Z'),
        }),
      { wrapper },
    );

    await act(async () => {});

    expect(result.current.slots.length).toBeGreaterThan(0);
    expect(result.current.slots[0]).toMatchObject({ value: expect.stringMatching(/\d{2}:\d{2}/) });
  });
  it('tracks changeOccasion when occasion picker toggled', async () => {
    const onTrack = vi.fn();
    const state = wizardStateFixture({
      date: '2025-05-12',
      time: '18:00',
    });

    const wrapper = createWrapper();

    const { result } = renderHook(
      () =>
        usePlanStepForm({
          state,
          actions: { updateDetails: vi.fn(), goToStep: vi.fn() },
          onActionsChange: vi.fn(),
          onTrack,
          minDate: new Date('2025-05-01T00:00:00Z'),
        }),
      { wrapper },
    );

    await act(async () => {
      result.current.handlers.changeOccasion('drinks');
    });

    await act(async () => {});

    expect(onTrack).toHaveBeenCalledWith(
      'select_time',
      expect.objectContaining({ booking_type: 'drinks' }),
    );
  });
});

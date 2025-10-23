import '@testing-library/jest-dom/vitest';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { wizardDetailsFixture } from '@/tests/fixtures/wizard';
import { WizardDependenciesProvider } from '@features/reservations/wizard/di';
import { BookingWizard } from '@features/reservations/wizard/ui/BookingWizard';

const useOnlineStatusMock = vi.hoisted(() => vi.fn());
const emitMock = vi.hoisted(() => vi.fn());
const getScheduleMock = vi.hoisted(() => vi.fn());

vi.mock('@/hooks/useOnlineStatus', () => ({
  useOnlineStatus: () => useOnlineStatusMock(),
}));

vi.mock('@features/reservations/wizard/api/useCreateReservation', () => ({
  useCreateReservation: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock('@shared/api/client', () => ({
  apiClient: {
    get: (...args: unknown[]) => getScheduleMock(...args),
  },
}));

vi.mock('@/lib/analytics/emit', () => ({
  emit: emitMock,
}));

vi.mock('@/hooks/useSupabaseSession', () => ({
  useSupabaseSession: () => ({ user: null, status: 'ready' }),
}));

vi.mock('@/hooks/useProfile', () => ({
  useProfile: () => ({ data: undefined }),
}));

class ResizeObserverMock {
  callback: ResizeObserverCallback;
  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
  }
  observe() {}
  unobserve() {}
  disconnect() {}
}

describe('BookingWizard offline banner', () => {
  beforeAll(() => {
    Object.defineProperty(window, 'ResizeObserver', {
      writable: true,
      configurable: true,
      value: ResizeObserverMock,
    });
    Object.defineProperty(global, 'ResizeObserver', {
      writable: true,
      configurable: true,
      value: ResizeObserverMock,
    });
  });

  beforeEach(() => {
    vi.clearAllMocks();
    useOnlineStatusMock.mockReturnValue(false);
    getScheduleMock.mockResolvedValue({
      restaurantId: 'rest-1',
      date: '2025-05-20',
      timezone: 'Europe/London',
      intervalMinutes: 15,
      defaultDurationMinutes: 90,
      lastSeatingBufferMinutes: 120,
      window: { opensAt: '12:00', closesAt: '22:00' },
      isClosed: false,
      availableBookingOptions: ['dinner'],
      occasionCatalog: [
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
      ],
      slots: [
        {
          value: '18:15',
          display: '18:15',
          periodId: 'sp-dinner',
          periodName: 'Dinner',
          bookingOption: 'dinner',
          defaultBookingOption: 'dinner',
          availability: {
            services: { lunch: 'disabled', dinner: 'enabled', drinks: 'disabled' },
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
      ],
    });
  });

  it('shows offline banner, disables actions, and tracks analytics', async () => {
    const analytics = { track: vi.fn() };
    const initialDetails = wizardDetailsFixture({
      date: '2025-05-20',
      time: '18:15',
      party: 2,
      bookingType: 'dinner',
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      phone: '07123 456789',
    });

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });

    render(
      <WizardDependenciesProvider value={{ analytics }}>
        <QueryClientProvider client={queryClient}>
          <BookingWizard initialDetails={initialDetails} />
        </QueryClientProvider>
      </WizardDependenciesProvider>,
    );

    expect(await screen.findByText(/You’re offline/i)).toBeVisible();

    const continueButton = await screen.findByRole('button', { name: /Continue/i });
    expect(continueButton).toBeDisabled();

    await waitFor(() => {
      expect(analytics.track).toHaveBeenCalledWith(
        'wizard_offline_detected',
        expect.objectContaining({ step: 1 }),
      );
    });

    expect(emitMock).toHaveBeenCalledWith(
      'wizard_offline_detected',
      expect.objectContaining({ step: 1 }),
    );
  });
});

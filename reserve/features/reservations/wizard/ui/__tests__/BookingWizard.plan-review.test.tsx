import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { BOOKING_IN_PAST_CUSTOMER_MESSAGE } from '@/lib/bookings/messages';
import { wizardDetailsFixture, apiBookingFixture } from '@/tests/fixtures/wizard';
import { WizardDependenciesProvider } from '@features/reservations/wizard/di';
import { BookingWizard } from '@features/reservations/wizard/ui/BookingWizard';

import type { ErrorReporter } from '@reserve/shared/error';

const mutateAsync = vi.fn();
const getScheduleMock = vi.fn();

class ResizeObserverMock {
  callback: ResizeObserverCallback;
  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
  }
  observe() {}
  unobserve() {}
  disconnect() {}
}

vi.mock('@features/reservations/wizard/api/useCreateReservation', () => ({
  useCreateReservation: () => ({ mutateAsync, isPending: false }),
}));

vi.mock('@shared/api/client', () => ({
  apiClient: {
    get: (...args: unknown[]) => getScheduleMock(...args),
  },
}));

vi.mock('@/hooks/useSupabaseSession', () => ({
  useSupabaseSession: () => ({ user: null, status: 'ready' }),
}));

vi.mock('@/hooks/useProfile', () => ({
  useProfile: () => ({ data: undefined }),
}));

describe('BookingWizard plan to review flow', () => {
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
    mutateAsync.mockReset();
    mutateAsync.mockResolvedValue({
      bookings: [apiBookingFixture()],
      booking: apiBookingFixture(),
    });
    getScheduleMock.mockReset();
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
        {
          value: '19:00',
          display: '19:00',
          periodId: 'sp-late',
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

  const renderWithProviders = (ui: React.ReactNode) => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });

    return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
  };

  it('persists selections through review and triggers confirmation mutation', async () => {
    const analytics = { track: vi.fn() };
    const errorReporter: ErrorReporter = { capture: vi.fn() };
    const initialDetails = wizardDetailsFixture({
      date: '2025-05-20',
      time: '18:15',
      party: 2,
      bookingType: 'dinner',
      name: '',
      email: '',
      phone: '',
      restaurantName: 'Test Kitchen',
      restaurantSlug: 'test-kitchen',
      restaurantId: 'rest-test',
    });

    renderWithProviders(
      <WizardDependenciesProvider value={{ analytics, errorReporter }}>
        <BookingWizard initialDetails={initialDetails} />
      </WizardDependenciesProvider>,
    );

    const planForm = document.querySelector('form');
    expect(planForm).toBeTruthy();
    await act(async () => {
      if (planForm) {
        fireEvent.submit(planForm);
      }
    });

    await screen.findByText('Tell us how to reach you');

    await userEvent.clear(screen.getByLabelText('Full name'));
    await userEvent.type(screen.getByLabelText('Full name'), 'Ada Lovelace');
    await userEvent.clear(screen.getByLabelText('Email address'));
    await userEvent.type(screen.getByLabelText('Email address'), 'ada@example.com');
    await userEvent.clear(screen.getByLabelText('UK phone number'));
    await userEvent.type(screen.getByLabelText('UK phone number'), '07123 456789');

    const reviewButton = await screen.findByRole('button', { name: /Review booking/i });
    await userEvent.click(reviewButton);

    await screen.findByText('Review and confirm');
    expect(screen.getByText(/Test Kitchen/)).toBeVisible();
    expect(screen.getByText(/Ada Lovelace/)).toBeVisible();
    const timeNodes = screen.getAllByText(/18:15/);
    expect(timeNodes.length).toBeGreaterThan(0);

    await userEvent.click(screen.getByRole('button', { name: /Confirm booking/i }));

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledTimes(1);
    });

    const payload = mutateAsync.mock.calls[0]?.[0];
    expect(payload?.draft).toMatchObject({
      date: '2025-05-20',
      time: '18:15',
      party: 2,
      bookingType: 'dinner',
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      phone: '07123 456789',
    });

    expect(analytics.track).toHaveBeenCalledWith(
      'booking_created',
      expect.objectContaining({
        party: 2,
        start_time: '18:15',
      }),
    );
    expect(errorReporter.capture).not.toHaveBeenCalled();
  });

  it('returns to review step and surfaces error when booking submission fails', async () => {
    const analytics = { track: vi.fn() };
    const errorReporter: ErrorReporter = { capture: vi.fn() };
    mutateAsync.mockRejectedValueOnce({
      code: 'SERVER_ERROR',
      message: 'Unable to save booking',
      status: 500,
    });

    const initialDetails = wizardDetailsFixture({
      date: '2025-05-20',
      time: '19:00',
      party: 2,
      bookingType: 'dinner',
      name: '',
      email: '',
      phone: '',
      restaurantName: 'Test Kitchen',
      restaurantSlug: 'test-kitchen',
      restaurantId: 'rest-test',
    });

    renderWithProviders(
      <WizardDependenciesProvider value={{ analytics, errorReporter }}>
        <BookingWizard initialDetails={initialDetails} />
      </WizardDependenciesProvider>,
    );

    const planForm = document.querySelector('form');
    expect(planForm).toBeTruthy();
    await act(async () => {
      if (planForm) {
        fireEvent.submit(planForm);
      }
    });

    await screen.findByText('Tell us how to reach you');

    await userEvent.clear(screen.getByLabelText('Full name'));
    await userEvent.type(screen.getByLabelText('Full name'), 'Ada Lovelace');
    await userEvent.clear(screen.getByLabelText('Email address'));
    await userEvent.type(screen.getByLabelText('Email address'), 'ada@example.com');
    await userEvent.clear(screen.getByLabelText('UK phone number'));
    await userEvent.type(screen.getByLabelText('UK phone number'), '07123 456789');

    const reviewButton = await screen.findByRole('button', { name: /Review booking/i });
    await userEvent.click(reviewButton);

    await screen.findByText('Review and confirm');

    await userEvent.click(screen.getByRole('button', { name: /Confirm booking/i }));

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledTimes(1);
    });

    await screen.findByText('Review and confirm');
    const alertMessage = await screen.findByText(/Unable to .* booking/i);
    expect(alertMessage).toBeVisible();
    expect(analytics.track).not.toHaveBeenCalledWith('booking_created', expect.anything());
    expect(errorReporter.capture).toHaveBeenCalledTimes(1);
  });

  it('shows booking-in-past guidance when API rejects due to past start time', async () => {
    const analytics = { track: vi.fn() };
    const errorReporter: ErrorReporter = { capture: vi.fn() };
    mutateAsync.mockRejectedValueOnce({
      code: 'BOOKING_IN_PAST',
      message: 'Booking time is in the past. Please select a future date and time.',
      status: 422,
    });

    const initialDetails = wizardDetailsFixture({
      date: '2025-05-20',
      time: '17:00',
      party: 2,
      bookingType: 'dinner',
      name: '',
      email: '',
      phone: '',
    });

    renderWithProviders(
      <WizardDependenciesProvider value={{ analytics, errorReporter }}>
        <BookingWizard initialDetails={initialDetails} />
      </WizardDependenciesProvider>,
    );

    const planForm = document.querySelector('form');
    expect(planForm).toBeTruthy();
    await act(async () => {
      if (planForm) {
        fireEvent.submit(planForm);
      }
    });

    await screen.findByText('Tell us how to reach you');

    await userEvent.clear(screen.getByLabelText('Full name'));
    await userEvent.type(screen.getByLabelText('Full name'), 'Ada Lovelace');
    await userEvent.clear(screen.getByLabelText('Email address'));
    await userEvent.type(screen.getByLabelText('Email address'), 'ada@example.com');
    await userEvent.clear(screen.getByLabelText('UK phone number'));
    await userEvent.type(screen.getByLabelText('UK phone number'), '07123 456789');

    const reviewButton = await screen.findByRole('button', { name: /Review booking/i });
    await userEvent.click(reviewButton);

    await screen.findByText('Review and confirm');
    await userEvent.click(screen.getByRole('button', { name: /Confirm booking/i }));

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledTimes(1);
    });

    const planHeading = await screen.findByText(/Plan your visit/i);
    expect(planHeading).toBeVisible();
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(BOOKING_IN_PAST_CUSTOMER_MESSAGE);
    expect(analytics.track).not.toHaveBeenCalledWith('booking_created', expect.anything());
    expect(errorReporter.capture).not.toHaveBeenCalled();
  });
});

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { wizardDetailsFixture, apiBookingFixture } from '@/tests/fixtures/wizard';
import { WizardDependenciesProvider } from '@features/reservations/wizard/di';
import { BookingWizard } from '@features/reservations/wizard/ui/BookingWizard';

const mutateAsync = vi.fn();

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
  });

  it('persists selections through review and triggers confirmation mutation', async () => {
    const analytics = { track: vi.fn() };
    const initialDetails = wizardDetailsFixture({
      date: '2025-05-20',
      time: '18:30',
      party: 2,
      bookingType: 'dinner',
      name: '',
      email: '',
      phone: '',
    });

    render(
      <WizardDependenciesProvider value={{ analytics }}>
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

    const detailsForm = document.querySelector('form');
    await act(async () => {
      if (detailsForm) {
        await userEvent.click(screen.getByRole('button', { name: /Review booking/i }));
      }
    });

    await screen.findByText('Review and confirm');
    expect(screen.getByText(/Test Kitchen/)).toBeVisible();
    expect(screen.getByText(/Ada Lovelace/)).toBeVisible();
    const timeNodes = screen.getAllByText(/18:30/);
    expect(timeNodes.length).toBeGreaterThan(0);

    await userEvent.click(screen.getByRole('button', { name: /Confirm booking/i }));

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledTimes(1);
    });

    const payload = mutateAsync.mock.calls[0]?.[0];
    expect(payload?.draft).toMatchObject({
      date: '2025-05-20',
      time: '18:30',
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
        start_time: '18:30',
      }),
    );
  });
});

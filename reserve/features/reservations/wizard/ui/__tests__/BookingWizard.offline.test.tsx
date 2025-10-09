import '@testing-library/jest-dom/vitest';

import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { wizardDetailsFixture } from '@/tests/fixtures/wizard';
import { WizardDependenciesProvider } from '@features/reservations/wizard/di';
import { BookingWizard } from '@features/reservations/wizard/ui/BookingWizard';

const useOnlineStatusMock = vi.hoisted(() => vi.fn());
const emitMock = vi.hoisted(() => vi.fn());

vi.mock('@/hooks/useOnlineStatus', () => ({
  useOnlineStatus: () => useOnlineStatusMock(),
}));

vi.mock('@features/reservations/wizard/api/useCreateReservation', () => ({
  useCreateReservation: () => ({ mutateAsync: vi.fn(), isPending: false }),
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

    render(
      <WizardDependenciesProvider value={{ analytics }}>
        <BookingWizard initialDetails={initialDetails} />
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

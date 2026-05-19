import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import MyBookingsPage from '@src/app/guest/bookings/page';

import type { ReactNode } from 'react';

const createGuestServerServicesMock = vi.hoisted(() => vi.fn());
const buildGuestBookingsViewModelMock = vi.hoisted(() => vi.fn());

vi.mock('@/guest/services/server', () => ({
  createGuestServerServices: createGuestServerServicesMock,
}));

vi.mock('@/guest/routes/bookings/view-model', () => ({
  buildGuestBookingsViewModel: buildGuestBookingsViewModelMock,
}));

vi.mock('@/guest/routes/bookings/page-view', () => ({
  GuestBookingsPageView: ({ viewModel }: { viewModel: { label: string } }) => (
    <div data-testid="guest-bookings-page">{viewModel.label}</div>
  ),
}));

vi.mock('@tanstack/react-query', () => ({
  HydrationBoundary: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

describe('guest bookings page query params', () => {
  beforeEach(() => {
    createGuestServerServicesMock.mockReset();
    buildGuestBookingsViewModelMock.mockReset();
  });

  it('passes the first duplicated tab value into the guest bookings view model', async () => {
    const services = { auth: {}, bookings: {}, profile: {} };
    createGuestServerServicesMock.mockResolvedValueOnce(services);
    buildGuestBookingsViewModelMock.mockResolvedValueOnce({ label: 'bookings-view' });

    render(
      await MyBookingsPage({
        searchParams: Promise.resolve({ tab: ['past', 'upcoming'] }),
      }),
    );

    expect(buildGuestBookingsViewModelMock).toHaveBeenCalledWith(services, { tab: 'past' });
    expect(screen.getByTestId('guest-bookings-page')).toHaveTextContent('bookings-view');
  });
});

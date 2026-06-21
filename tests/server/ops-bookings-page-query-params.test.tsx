import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import OpsBookingsPage from '@src/app/app/(app)/bookings/page';

import type { ReactNode } from 'react';

const opsBookingsClientMock = vi.hoisted(() => vi.fn());

vi.mock('@/components/features/booking-state-machine', () => ({
  BookingErrorBoundary: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock('@/contexts/booking-offline-queue', () => ({
  BookingOfflineQueueProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock('@/components/features/bookings/OpsBookingsClient', () => ({
  OpsBookingsClient: (props: Record<string, unknown>) => {
    opsBookingsClientMock(props);
    return <div data-testid="ops-bookings-client" />;
  },
}));

describe('ops bookings page query params', () => {
  beforeEach(() => {
    opsBookingsClientMock.mockReset();
  });

  it('normalizes duplicated search params before passing initial filters to the client', async () => {
    render(
      await OpsBookingsPage({
        searchParams: Promise.resolve({
          restaurantId: ['rest-one', 'rest-two'],
          filter: ['upcoming', 'past'],
          query: [' Alice ', 'Bob'],
          statuses: ['pending,confirmed', 'cancelled'],
          date: ['2026-05-16', '2026-05-17'],
          tableId: ['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222'],
          tableLabel: [' Table 1 ', 'Table 2'],
          time: ['19:00', '20:00'],
          windowMode: ['window', 'day'],
          windowMinutes: ['45', '120'],
        }),
      }),
    );

    expect(opsBookingsClientMock).toHaveBeenCalledWith(
      expect.objectContaining({
        initialRestaurantId: 'rest-one',
        initialFilter: 'upcoming',
        initialQuery: 'Alice',
        initialStatuses: ['pending', 'confirmed', 'cancelled'],
        initialDate: '2026-05-16',
        initialTableId: '11111111-1111-4111-8111-111111111111',
        initialTableLabel: 'Table 1',
        initialTime: '19:00',
        initialWindowMode: 'window',
        initialWindowMinutes: 45,
      }),
    );
  });
});

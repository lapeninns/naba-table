import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useReservationWizard } from '@features/reservations/wizard/hooks/useReservationWizard';

const harness = vi.hoisted(() => ({
  savePreferences: vi.fn(),
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
    mutateAsync: vi.fn(),
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
});

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
});

import { renderHook } from '@testing-library/react';
import { createQueryWrapper, createTestQueryClient } from '@tests/utils/reactQuery';
import { describe, expect, it, vi } from 'vitest';

import { useUpdateRestaurant } from '@/hooks/ops/useUpdateRestaurant';
import { fetchJson } from '@/lib/http/fetchJson';
import { queryKeys } from '@/lib/query/keys';

import type { RestaurantDTO, RestaurantsListResponse } from '@/app/api/ops/restaurants/schema';

vi.mock('@/lib/http/fetchJson', () => ({
  fetchJson: vi.fn(),
}));

describe('useUpdateRestaurant', () => {
  it('skips malformed cached lists without crashing', async () => {
    const queryClient = createTestQueryClient();
    const wrapper = createQueryWrapper(queryClient);

    const restaurant: RestaurantDTO = {
      id: 'rest-1',
      name: 'The Fox',
      slug: 'the-fox',
      isActive: true,
      timezone: 'Europe/London',
      capacity: 40,
      contactEmail: null,
      contactPhone: null,
      address: null,
      managerDailySummaryEnabled: false,
      managerNotificationPhone: null,
      googleMapUrl: null,
      googleReviewUrl: null,
      bookingPolicy: null,
      logoUrl: null,
      emailSendReminder24h: true,
      emailSendReminderShort: true,
      emailSendReviewRequest: true,
      reservationIntervalMinutes: 30,
      reservationDefaultDurationMinutes: 90,
      reservationLastSeatingBufferMinutes: 90,
      reservationLifecycleGraceMinutes: 15,
      createdAt: '2026-03-20T10:00:00Z',
      updatedAt: '2026-03-20T10:00:00Z',
      role: 'owner',
    };

    queryClient.setQueryData(queryKeys.opsRestaurants.list({}), {
      pageInfo: { page: 1, pageSize: 20, total: 1, hasNext: false },
    } as RestaurantsListResponse);
    queryClient.setQueryData(queryKeys.opsRestaurants.detail(restaurant.id), restaurant);

    vi.mocked(fetchJson).mockResolvedValue({ restaurant } as never);

    const { result } = renderHook(() => useUpdateRestaurant(), { wrapper });

    await result.current.mutateAsync({
      id: restaurant.id,
      data: { name: 'The Fox & Hounds', isActive: false },
    });

    expect(queryClient.getQueryData(queryKeys.opsRestaurants.list({}))).toEqual({
      pageInfo: { page: 1, pageSize: 20, total: 1, hasNext: false },
    });
    expect(queryClient.getQueryData(queryKeys.opsRestaurants.detail(restaurant.id))).toEqual({
      ...restaurant,
      name: 'The Fox & Hounds',
      isActive: false,
    });
  });
});

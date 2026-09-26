import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { HttpError } from '@/lib/http/errors';
import { createAppQueryClient } from '@/lib/query/client';
import { queryKeys } from '@/lib/query/keys';
import { dualSyncQueryKeys } from '@src/hooks/ops/opsIntegrationQueries';
import {
  useOpsAvailabilityRevision,
  useOpsSaveAvailability,
} from '@src/hooks/ops/useOpsSaveAvailability';

import type { AvailabilitySaveResult } from '@/services/ops/availability';
import type { RestaurantProfile } from '@/services/ops/restaurants';
import type { ReactNode } from 'react';

const restaurantId = 'restaurant-1';
const SCHEDULE_KEY = ['reservations', 'schedule', 'the-pub', '2026-10-01', 2] as const;

const saveResult: AvailabilitySaveResult = {
  restaurantId,
  revision: 'fedcba9876543210fedcba9876543210',
  hours: {
    updatedAt: '2026-09-27T10:00:00.000Z',
    weekly: [{ dayOfWeek: 1, opensAt: '12:00', closesAt: '23:00', isClosed: false, notes: null }],
    overrides: [],
  },
  servicePeriods: [
    {
      id: 'p1',
      name: 'Dinner',
      dayOfWeek: 1,
      startTime: '17:00',
      endTime: '22:30',
      bookingOption: 'dinner',
    },
  ],
  turnBands: {
    restaurantId,
    bands: { dinner: [{ maxPartySize: 4, durationMinutes: 105 }] },
    defaults: { dinner: [{ maxPartySize: 4, durationMinutes: 90 }] },
  },
  rules: {
    reservationIntervalMinutes: 30,
    reservationDefaultDurationMinutes: 105,
    reservationLastSeatingBufferMinutes: 60,
    reservationLifecycleGraceMinutes: 15,
    bookingPolicy: 'Call for 9+',
    updatedAt: '2026-09-27T10:00:00.000Z',
  },
};

const profile = {
  id: restaurantId,
  name: 'The Pub',
  managerName: 'Kept as is',
  reservationIntervalMinutes: 15,
  reservationDefaultDurationMinutes: 90,
  reservationLastSeatingBufferMinutes: 60,
  reservationLifecycleGraceMinutes: 15,
  bookingPolicy: null,
  updatedAt: '2026-09-01T00:00:00.000Z',
} as unknown as RestaurantProfile;

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function wrapperFor(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

describe('useOpsSaveAvailability', () => {
  let queryClient: QueryClient;
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    queryClient = createAppQueryClient();
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    queryClient.clear();
    vi.unstubAllGlobals();
  });

  it('saves a typical page edit with ONE request and writes every cache from the response', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { data: saveResult }));
    queryClient.setQueryData(queryKeys.opsRestaurants.detail(restaurantId), profile);
    queryClient.setQueryData(SCHEDULE_KEY, { slots: [] });
    queryClient.setQueryData(dualSyncQueryKeys.state(restaurantId), { fields: [] });
    queryClient.setQueryData(queryKeys.opsOccasions.list(), []);

    const { result } = renderHook(() => useOpsSaveAvailability(restaurantId), {
      wrapper: wrapperFor(queryClient),
    });

    // Before: hours PUT, meal times PUT, turn bands PUT, 2x restaurant PATCH (default table time
    // and booking rules), then GETs to refresh. After: one PUT.
    await act(async () => {
      await result.current.mutateAsync({
        hours: saveResult.hours,
        servicePeriods: saveResult.servicePeriods,
        turnBands: saveResult.turnBands.bands,
        rules: { reservationDefaultDurationMinutes: 105, reservationIntervalMinutes: 30 },
        expectedRevision: '0123456789abcdef0123456789abcdef',
      });
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe(`/api/ops/restaurants/${restaurantId}/availability`);
    expect(init?.method).toBe('PUT');
    expect(JSON.parse(String(init?.body))).toMatchObject({
      expectedRevision: '0123456789abcdef0123456789abcdef',
      rules: { reservationDefaultDurationMinutes: 105 },
    });

    expect(queryClient.getQueryData(queryKeys.opsRestaurants.hours(restaurantId))).toEqual(
      saveResult.hours,
    );
    expect(queryClient.getQueryData(queryKeys.opsRestaurants.servicePeriods(restaurantId))).toEqual(
      saveResult.servicePeriods,
    );
    expect(queryClient.getQueryData(queryKeys.opsRestaurants.turnBands(restaurantId))).toEqual(
      saveResult.turnBands,
    );
    expect(
      queryClient.getQueryData(queryKeys.opsRestaurants.availabilityRevision(restaurantId)),
    ).toBe(saveResult.revision);
    expect(
      queryClient.getQueryData<RestaurantProfile>(queryKeys.opsRestaurants.detail(restaurantId)),
    ).toMatchObject({
      managerName: 'Kept as is',
      reservationIntervalMinutes: 30,
      reservationDefaultDurationMinutes: 105,
      bookingPolicy: 'Call for 9+',
      updatedAt: saveResult.rules.updatedAt,
    });

    // Narrow invalidation: only what the server derives from availability.
    expect(queryClient.getQueryState(SCHEDULE_KEY)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(dualSyncQueryKeys.state(restaurantId))?.isInvalidated).toBe(
      true,
    );
    expect(queryClient.getQueryState(queryKeys.opsOccasions.list())?.isInvalidated).toBe(false);
    expect(
      queryClient.getQueryState(queryKeys.opsRestaurants.hours(restaurantId))?.isInvalidated,
    ).toBe(false);
  });

  it('surfaces STALE_WRITE without touching the caches', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(409, {
        error: 'These settings were changed somewhere else.',
        message: 'These settings were changed somewhere else.',
        code: 'STALE_WRITE',
      }),
    );
    queryClient.setQueryData(queryKeys.opsRestaurants.detail(restaurantId), profile);

    const { result } = renderHook(() => useOpsSaveAvailability(restaurantId), {
      wrapper: wrapperFor(queryClient),
    });

    let caught: unknown;
    await act(async () => {
      try {
        await result.current.mutateAsync({ rules: { reservationIntervalMinutes: 30 } });
      } catch (error) {
        caught = error;
      }
    });

    expect(caught).toBeInstanceOf(HttpError);
    expect((caught as HttpError).code).toBe('STALE_WRITE');
    expect(
      queryClient.getQueryData<RestaurantProfile>(queryKeys.opsRestaurants.detail(restaurantId)),
    ).toBe(profile);
  });

  it('reads the save revision without persisting it', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(200, { data: { restaurantId, revision: saveResult.revision } }),
    );

    const { result } = renderHook(() => useOpsAvailabilityRevision(restaurantId), {
      wrapper: wrapperFor(queryClient),
    });

    await waitFor(() => expect(result.current.data).toBe(saveResult.revision));
    expect(String(fetchMock.mock.calls[0]![0])).toBe(
      `/api/ops/restaurants/${restaurantId}/availability`,
    );
    expect(
      queryClient
        .getQueryCache()
        .find({ queryKey: queryKeys.opsRestaurants.availabilityRevision(restaurantId) })?.meta,
    ).toMatchObject({ persist: false });
  });
});

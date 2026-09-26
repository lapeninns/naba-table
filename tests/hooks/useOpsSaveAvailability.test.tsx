import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AvailabilityServiceProvider } from '@/contexts/availability-service';
import { HttpError } from '@/lib/http/errors';
import { createAppQueryClient } from '@/lib/query/client';
import { queryKeys } from '@/lib/query/keys';
import { createRestaurantServiceAvailability } from '@/services/ops/availability';
import { dualSyncQueryKeys } from '@src/hooks/ops/opsIntegrationQueries';
import { useOpsAvailability, useOpsSaveAvailability } from '@src/hooks/ops/useOpsSaveAvailability';

import type { AvailabilitySnapshot } from '@/services/ops/availability';
import type { RestaurantProfile, RestaurantService } from '@/services/ops/restaurants';
import type { ReactNode } from 'react';

const restaurantId = 'restaurant-1';
const SCHEDULE_KEY = ['reservations', 'schedule', 'the-pub', '2026-10-01', 2] as const;

const saveResult: AvailabilitySnapshot = {
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
    expect(queryClient.getQueryData(queryKeys.opsRestaurants.availability(restaurantId))).toEqual(
      saveResult,
    );
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

  it('refetches the snapshot after STALE_WRITE so the page can rebase onto the newer revision', async () => {
    const stale = jsonResponse(409, {
      error: 'These settings were changed somewhere else.',
      message: 'These settings were changed somewhere else.',
      code: 'STALE_WRITE',
    });
    fetchMock.mockResolvedValueOnce(stale);
    queryClient.setQueryData(queryKeys.opsRestaurants.availability(restaurantId), saveResult);
    queryClient.setQueryData(queryKeys.opsRestaurants.hours(restaurantId), saveResult.hours);

    const { result } = renderHook(() => useOpsSaveAvailability(restaurantId), {
      wrapper: wrapperFor(queryClient),
    });

    await act(async () => {
      await result.current
        .mutateAsync({ rules: { reservationIntervalMinutes: 30 }, expectedRevision: 'old' })
        .catch(() => undefined);
    });

    expect(
      queryClient.getQueryState(queryKeys.opsRestaurants.availability(restaurantId))?.isInvalidated,
    ).toBe(true);
    // Only the page's own snapshot; the single-resource caches are not part of its draft.
    expect(
      queryClient.getQueryState(queryKeys.opsRestaurants.hours(restaurantId))?.isInvalidated,
    ).toBe(false);
  });

  it('keeps the snapshot as is after a non-conflict failure', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(500, { error: 'Internal', message: 'Internal', code: 'INTERNAL_ERROR' }),
    );
    queryClient.setQueryData(queryKeys.opsRestaurants.availability(restaurantId), saveResult);

    const { result } = renderHook(() => useOpsSaveAvailability(restaurantId), {
      wrapper: wrapperFor(queryClient),
    });

    await act(async () => {
      await result.current
        .mutateAsync({ rules: { reservationIntervalMinutes: 30 }, expectedRevision: 'old' })
        .catch(() => undefined);
    });

    expect(
      queryClient.getQueryState(queryKeys.opsRestaurants.availability(restaurantId))?.isInvalidated,
    ).toBe(false);
  });

  it('reads rows and revision together in ONE request (the page draft source)', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { data: saveResult }));

    const { result } = renderHook(() => useOpsAvailability(restaurantId), {
      wrapper: wrapperFor(queryClient),
    });

    await waitFor(() => expect(result.current.data).toEqual(saveResult));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]![0])).toBe(
      `/api/ops/restaurants/${restaurantId}/availability`,
    );
    // Rows and revision live in one cache entry: they can never be refreshed separately.
    const query = queryClient
      .getQueryCache()
      .find({ queryKey: queryKeys.opsRestaurants.availability(restaurantId) });
    expect(query?.observers[0]?.options.staleTime).toBe(0);
  });
});

describe('createRestaurantServiceAvailability (dev harness adapter)', () => {
  function inMemoryService() {
    const state = {
      hours: { weekly: saveResult.hours.weekly, overrides: [] as never[] },
      periods: saveResult.servicePeriods,
      bands: saveResult.turnBands,
      profile,
    };
    const service = {
      getOperatingHours: vi.fn(async () => state.hours),
      getServicePeriods: vi.fn(async () => state.periods),
      getTurnBands: vi.fn(async () => state.bands),
      getProfile: vi.fn(async () => state.profile),
      updateOperatingHours: vi.fn(async (_id: string, hours: typeof state.hours) => {
        state.hours = hours;
        return hours;
      }),
      updateServicePeriods: vi.fn(),
      updateTurnBands: vi.fn(),
      updateProfile: vi.fn(async (_id: string, patch: Partial<RestaurantProfile>) => {
        state.profile = { ...state.profile, ...patch };
        return state.profile;
      }),
    };
    return { service, state };
  }

  it('serves the hooks without the real route, and keeps the stale-write contract', async () => {
    const { service } = inMemoryService();
    const adapter = createRestaurantServiceAvailability(service as unknown as RestaurantService);
    function Wrapper({ children }: { children: ReactNode }) {
      return (
        <QueryClientProvider client={queryClientForAdapter}>
          <AvailabilityServiceProvider service={adapter}>{children}</AvailabilityServiceProvider>
        </QueryClientProvider>
      );
    }
    const queryClientForAdapter = createAppQueryClient();
    const fetchSpy = vi.fn<typeof fetch>();
    vi.stubGlobal('fetch', fetchSpy);

    const { result } = renderHook(
      () => ({
        snapshot: useOpsAvailability(restaurantId),
        save: useOpsSaveAvailability(restaurantId),
      }),
      { wrapper: Wrapper },
    );
    await waitFor(() => expect(result.current.snapshot.data).toBeDefined());
    const loaded = result.current.snapshot.data!;

    await act(async () => {
      await result.current.save.mutateAsync({
        rules: { bookingPolicy: 'Mock policy' },
        expectedRevision: loaded.revision,
      });
    });
    expect(service.updateProfile).toHaveBeenCalledWith(restaurantId, {
      bookingPolicy: 'Mock policy',
    });
    expect(service.updateOperatingHours).not.toHaveBeenCalled();

    // The old revision no longer matches: the adapter refuses like the route (409 STALE_WRITE).
    let caught: unknown;
    await act(async () => {
      try {
        await result.current.save.mutateAsync({
          rules: { bookingPolicy: 'Overwrite' },
          expectedRevision: loaded.revision,
        });
      } catch (error) {
        caught = error;
      }
    });
    expect((caught as HttpError).code).toBe('STALE_WRITE');
    expect(fetchSpy).not.toHaveBeenCalled();
    queryClientForAdapter.clear();
    vi.unstubAllGlobals();
  });
});

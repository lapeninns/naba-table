import { QueryClientProvider, type QueryClient, type QueryKey } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useOpsOperatingHours, useOpsUpdateOperatingHours } from '@/hooks/ops/useOpsOperatingHours';
import { useOpsServicePeriods, useOpsUpdateServicePeriods } from '@/hooks/ops/useOpsServicePeriods';
import { useOpsTurnBands, useOpsUpdateTurnBands } from '@/hooks/ops/useOpsTurnBands';
import { HttpError } from '@/lib/http/errors';
import { createAppQueryClient } from '@/lib/query/client';
import { queryKeys } from '@/lib/query/keys';

import type {
  OperatingHoursSnapshot,
  ServicePeriodRow,
  TurnBandsPayload,
  TurnBandsSnapshot,
} from '@/services/ops/restaurants';
import type { ReactNode } from 'react';

const restaurantService = vi.hoisted(() => ({
  getOperatingHours: vi.fn(),
  updateOperatingHours: vi.fn(),
  getServicePeriods: vi.fn(),
  updateServicePeriods: vi.fn(),
  getTurnBands: vi.fn(),
  updateTurnBands: vi.fn(),
}));

vi.mock('@/contexts/ops-services', () => ({
  useRestaurantService: () => restaurantService,
}));

const restaurantId = 'restaurant-1';
const SCHEDULE_PREFIX = ['reservations', 'schedule'];

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
};

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function hours(opensAt: string): OperatingHoursSnapshot {
  return {
    weekly: [{ dayOfWeek: 1, opensAt, closesAt: '22:00', isClosed: false, notes: null }],
    overrides: [],
  };
}

function periods(startTime: string): ServicePeriodRow[] {
  return [
    {
      id: 'period-1',
      name: 'Dinner',
      dayOfWeek: 5,
      startTime,
      endTime: '22:00',
      bookingOption: 'dinner',
    },
  ];
}

function bandsPayload(durationMinutes: number): TurnBandsPayload {
  return { dinner: [{ maxPartySize: 4, durationMinutes }] };
}

function bands(durationMinutes: number): TurnBandsSnapshot {
  return {
    restaurantId,
    bands: bandsPayload(durationMinutes),
    defaults: { dinner: [{ maxPartySize: 4, durationMinutes: 90 }] },
  };
}

type MutationHandle<TPayload> = {
  mutate: (payload: TPayload) => void;
  mutateAsync: (payload: TPayload) => Promise<unknown>;
};

type Case<TData, TPayload> = {
  resource: string;
  ownKey: QueryKey;
  dependentKeys: QueryKey[];
  get: ReturnType<typeof vi.fn>;
  put: ReturnType<typeof vi.fn>;
  initial: TData;
  payload: (n: number) => TPayload;
  response: (n: number) => TData;
  optimistic: (previous: TData, payload: TPayload) => TData;
  useQueryHook: (id: string | null) => { isSuccess: boolean; fetchStatus: string };
  useMutationHook: (id: string | null) => MutationHandle<TPayload>;
};

const cases = [
  {
    resource: 'operating hours',
    ownKey: queryKeys.opsRestaurants.hours(restaurantId),
    dependentKeys: [SCHEDULE_PREFIX],
    get: restaurantService.getOperatingHours,
    put: restaurantService.updateOperatingHours,
    initial: hours('09:00'),
    payload: (n: number) => hours(`1${n}:00`),
    response: (n: number) => ({ ...hours(`1${n}:00`), updatedAt: `2026-09-25T0${n}:00:00Z` }),
    optimistic: (_previous: OperatingHoursSnapshot, payload: OperatingHoursSnapshot) => payload,
    useQueryHook: useOpsOperatingHours,
    useMutationHook: useOpsUpdateOperatingHours,
  } satisfies Case<OperatingHoursSnapshot, OperatingHoursSnapshot>,
  {
    resource: 'service periods',
    ownKey: queryKeys.opsRestaurants.servicePeriods(restaurantId),
    dependentKeys: [queryKeys.opsRestaurants.turnBands(restaurantId), SCHEDULE_PREFIX],
    get: restaurantService.getServicePeriods,
    put: restaurantService.updateServicePeriods,
    initial: periods('17:00'),
    payload: (n: number) => periods(`1${n}:00`),
    response: (n: number) =>
      periods(`1${n}:00`).map((row) => ({ ...row, updatedAt: `2026-09-25T0${n}:00:00Z` })),
    optimistic: (_previous: ServicePeriodRow[], payload: ServicePeriodRow[]) => payload,
    useQueryHook: useOpsServicePeriods,
    useMutationHook: useOpsUpdateServicePeriods,
  } satisfies Case<ServicePeriodRow[], ServicePeriodRow[]>,
  {
    resource: 'turn bands',
    ownKey: queryKeys.opsRestaurants.turnBands(restaurantId),
    dependentKeys: [SCHEDULE_PREFIX],
    get: restaurantService.getTurnBands,
    put: restaurantService.updateTurnBands,
    initial: bands(60),
    payload: (n: number) => bandsPayload(100 + n),
    response: (n: number) => bands(100 + n),
    optimistic: (previous: TurnBandsSnapshot, payload: TurnBandsPayload) => ({
      ...previous,
      bands: payload,
    }),
    useQueryHook: useOpsTurnBands,
    useMutationHook: useOpsUpdateTurnBands,
  } satisfies Case<TurnBandsSnapshot, TurnBandsPayload>,
] as const;

function createClient(): QueryClient {
  const queryClient = createAppQueryClient();
  // Retries only slow the error paths down; nothing here depends on them.
  queryClient.setDefaultOptions({
    ...queryClient.getDefaultOptions(),
    queries: { ...queryClient.getDefaultOptions().queries, retry: false },
  });
  return queryClient;
}

function renderWithClient<T>(hook: () => T) {
  const queryClient = createClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
  const invalidatedKeys = () =>
    invalidateSpy.mock.calls.map(([filters]) => filters?.queryKey).filter(Boolean);
  return { queryClient, invalidatedKeys, ...renderHook(hook, { wrapper }) };
}

async function flush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe.each(cases)('availability save: $resource', (testCase) => {
  const { ownKey, dependentKeys, get, put, initial, payload, response } = testCase;
  const optimistic = testCase.optimistic as (previous: unknown, next: unknown) => unknown;
  const useQueryHook = testCase.useQueryHook as Case<unknown, unknown>['useQueryHook'];
  const useMutationHook = testCase.useMutationHook as Case<unknown, unknown>['useMutationHook'];

  function renderPair(id: string | null = restaurantId) {
    return renderWithClient(() => ({ query: useQueryHook(id), mutation: useMutationHook(id) }));
  }

  it('@contract keys the query by restaurant id and stays disabled without one', async () => {
    expect(ownKey).toContain(restaurantId);
    get.mockResolvedValue(initial);

    const { result } = renderPair(null);
    await flush();

    expect(result.current.query.fetchStatus).toBe('idle');
    expect(get).not.toHaveBeenCalled();
  });

  it('@contract writes the PUT response, invalidates only dependents and does not refetch itself', async () => {
    get.mockResolvedValue(initial);
    put.mockResolvedValue(response(1));

    const { result, queryClient, invalidatedKeys } = renderPair();
    await waitFor(() => expect(result.current.query.isSuccess).toBe(true));
    expect(get).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.current.mutation.mutateAsync(payload(1));
    });
    await flush();

    expect(put).toHaveBeenCalledWith(restaurantId, payload(1));
    expect(queryClient.getQueryData(ownKey)).toEqual(response(1));
    expect(get).toHaveBeenCalledTimes(1);
    expect(invalidatedKeys()).toEqual(dependentKeys);
  });

  it('@contract rolls back to the previous data and re-syncs its own key when the PUT rejects', async () => {
    get.mockResolvedValue(initial);
    const pending = deferred<unknown>();
    put.mockReturnValue(pending.promise);

    const { result, queryClient, invalidatedKeys } = renderPair();
    await waitFor(() => expect(result.current.query.isSuccess).toBe(true));

    act(() => {
      result.current.mutation.mutate(payload(1));
    });
    await waitFor(() => expect(put).toHaveBeenCalledTimes(1));
    expect(queryClient.getQueryData(ownKey)).toEqual(optimistic(initial, payload(1)));

    await act(async () => {
      pending.reject(new HttpError({ message: 'Conflict', status: 409, code: 'HTTP_409' }));
    });
    await flush();

    expect(queryClient.getQueryData(ownKey)).toEqual(initial);
    expect(invalidatedKeys()).toEqual([ownKey]);
  });

  it('@contract serialises back-to-back saves so the second payload wins in PUT order', async () => {
    get.mockResolvedValue(initial);
    const first = deferred<unknown>();
    const second = deferred<unknown>();
    put.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);

    const { result, queryClient } = renderPair();
    await waitFor(() => expect(result.current.query.isSuccess).toBe(true));

    act(() => {
      result.current.mutation.mutate(payload(1));
      result.current.mutation.mutate(payload(2));
    });
    await flush();

    // The second PUT must wait for the first one to settle.
    expect(put).toHaveBeenCalledTimes(1);

    await act(async () => {
      first.resolve(response(1));
    });
    await waitFor(() => expect(put).toHaveBeenCalledTimes(2));
    await act(async () => {
      second.resolve(response(2));
    });
    await flush();

    expect(put.mock.calls.map(([, sent]) => sent)).toEqual([payload(1), payload(2)]);
    expect(queryClient.getQueryData(ownKey)).toEqual(response(2));
  });
});

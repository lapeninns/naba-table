import { renderHook, waitFor } from '@testing-library/react';
import { createQueryWrapper, createTestQueryClient } from '@tests/utils/reactQuery';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { HttpError } from '@/lib/http/errors';
import { useOpsBookingStatusSummary } from '@src/hooks/ops/useOpsBookingStatusSummary';

import type { OpsBookingStatus } from '@/types/ops';

const bookingService = vi.hoisted(() => ({
  getStatusSummary: vi.fn(),
}));

vi.mock('@/contexts/ops-services', () => ({
  useBookingService: () => bookingService,
}));

const restaurantId = 'rest-1';

const summaryResponse = {
  restaurantId,
  range: { from: '2026-07-01', to: '2026-07-31' },
  filter: { statuses: null },
  totals: { confirmed: 3, cancelled: 1 },
  generatedAt: '2026-07-11T12:00:00.000Z',
};

type HookParams = Parameters<typeof useOpsBookingStatusSummary>[0];

function setup(initialProps: HookParams) {
  const queryClient = createTestQueryClient();
  const wrapper = createQueryWrapper(queryClient);
  return {
    queryClient,
    ...renderHook((props: HookParams) => useOpsBookingStatusSummary(props), {
      wrapper,
      initialProps,
    }),
  };
}

describe('useOpsBookingStatusSummary', () => {
  beforeEach(() => {
    bookingService.getStatusSummary.mockResolvedValue(summaryResponse);
  });

  it('@contract stays disabled without a restaurant id', () => {
    const { result } = setup({ restaurantId: null, from: '2026-07-01', to: '2026-07-31' });

    expect(result.current.fetchStatus).toBe('idle');
    expect(bookingService.getStatusSummary).not.toHaveBeenCalled();
  });

  it('@contract stays disabled until both range bounds resolve to dates', () => {
    setup({ restaurantId, from: '2026-07-01' });
    setup({ restaurantId, to: '2026-07-31' });
    setup({ restaurantId, from: 'not-a-date', to: '2026-07-31' });
    setup({ restaurantId, from: '   ', to: '2026-07-31' });

    expect(bookingService.getStatusSummary).not.toHaveBeenCalled();
  });

  it('@contract stays disabled when explicitly disabled', () => {
    setup({ restaurantId, from: '2026-07-01', to: '2026-07-31', enabled: false });

    expect(bookingService.getStatusSummary).not.toHaveBeenCalled();
  });

  it('@contract serializes Date and datetime bounds to UTC ISO date params', async () => {
    const statuses: OpsBookingStatus[] = ['confirmed', 'cancelled'];
    const { result } = setup({
      restaurantId,
      from: new Date('2026-07-01T15:30:00.000Z'),
      to: '2026-07-31T23:15:00.000Z',
      statuses,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(bookingService.getStatusSummary).toHaveBeenCalledWith({
      restaurantId,
      from: '2026-07-01',
      to: '2026-07-31',
      statuses,
    });
    expect(result.current.data).toEqual(summaryResponse);
  });

  it('@contract passes date-only strings through and omits an empty status filter', async () => {
    const { result } = setup({
      restaurantId,
      from: '2026-07-01',
      to: '2026-07-31',
      statuses: [],
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(bookingService.getStatusSummary).toHaveBeenCalledWith({
      restaurantId,
      from: '2026-07-01',
      to: '2026-07-31',
      statuses: undefined,
    });
  });

  it('@contract dedupes and sorts statuses in the query key so reordered filters reuse the cache', async () => {
    const { result, rerender } = setup({
      restaurantId,
      from: '2026-07-01',
      to: '2026-07-31',
      statuses: ['pending', 'confirmed'] as OpsBookingStatus[],
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    rerender({
      restaurantId,
      from: '2026-07-01',
      to: '2026-07-31',
      statuses: ['confirmed', 'pending', 'confirmed'] as OpsBookingStatus[],
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(bookingService.getStatusSummary).toHaveBeenCalledTimes(1);
  });

  it('@contract maps a 404 to a zeroed summary covering every status', async () => {
    bookingService.getStatusSummary.mockRejectedValue(
      new HttpError({ message: 'Not found', status: 404, code: 'NOT_FOUND' }),
    );

    const { result } = setup({ restaurantId, from: '2026-07-01', to: '2026-07-31' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toMatchObject({
      restaurantId,
      range: { from: '2026-07-01', to: '2026-07-31' },
      filter: { statuses: null },
      totals: {
        pending: 0,
        pending_allocation: 0,
        confirmed: 0,
        checked_in: 0,
        completed: 0,
        cancelled: 0,
        no_show: 0,
        PRIORITY_WAITLIST: 0,
      },
    });
    expect(Number.isNaN(Date.parse(result.current.data!.generatedAt))).toBe(false);
  });

  it('@contract keeps the requested status filter on the 404 fallback', async () => {
    bookingService.getStatusSummary.mockRejectedValue(
      new HttpError({ message: 'Not found', status: 404, code: 'NOT_FOUND' }),
    );

    const statuses: OpsBookingStatus[] = ['no_show'];
    const { result } = setup({ restaurantId, from: '2026-07-01', to: '2026-07-31', statuses });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.filter).toEqual({ statuses });
  });

  it('@contract surfaces non-404 errors', async () => {
    bookingService.getStatusSummary.mockRejectedValue(
      new HttpError({ message: 'Forbidden', status: 403, code: 'FORBIDDEN' }),
    );

    const { result } = setup({ restaurantId, from: '2026-07-01', to: '2026-07-31' });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toMatchObject({ status: 403 });
  });
});

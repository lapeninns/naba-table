import { renderHook, waitFor } from '@testing-library/react';
import { createQueryWrapper, createTestQueryClient } from '@tests/utils/reactQuery';
import { describe, expect, it, vi } from 'vitest';

import { useOpsBookings, type OpsBookingsFilters } from '@/hooks/useOpsBookings';
import { HttpError } from '@/lib/http/errors';
import { fetchJson } from '@/lib/http/fetchJson';

vi.mock('@/lib/http/fetchJson', () => ({ fetchJson: vi.fn() }));

const page = { items: [], pageInfo: { page: 1, pageSize: 10, total: 0, hasNext: false } };

function setup(filters: OpsBookingsFilters) {
  const queryClient = createTestQueryClient();
  const wrapper = createQueryWrapper(queryClient);
  return renderHook(() => useOpsBookings(filters), { wrapper });
}

function requestedUrl(): URLSearchParams {
  const url = vi.mocked(fetchJson).mock.calls.at(-1)?.[0] as string;
  return new URLSearchParams(url.split('?')[1]);
}

describe('useOpsBookings', () => {
  it('@contract stays disabled without a restaurant id', () => {
    const { result } = setup({ restaurantId: '' });

    expect(result.current.fetchStatus).toBe('idle');
    expect(fetchJson).not.toHaveBeenCalled();
  });

  it('@contract requests page 1 of 10 by default and omits the all-status filter', async () => {
    vi.mocked(fetchJson).mockResolvedValue(page as never);

    const { result } = setup({ restaurantId: 'rest-1', status: 'all' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const params = requestedUrl();
    expect(params.get('restaurantId')).toBe('rest-1');
    expect(params.get('page')).toBe('1');
    expect(params.get('pageSize')).toBe('10');
    expect(params.has('status')).toBe(false);
    expect(params.has('sort')).toBe(false);
  });

  it('@contract serialises status, sort, and date-range filters', async () => {
    vi.mocked(fetchJson).mockResolvedValue(page as never);

    const { result } = setup({
      restaurantId: 'rest-1',
      page: 2,
      pageSize: 25,
      status: 'confirmed',
      sort: 'desc',
      from: new Date('2026-07-01T00:00:00.000Z'),
      to: '2026-07-31T23:59:59.000Z',
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const params = requestedUrl();
    expect(params.get('page')).toBe('2');
    expect(params.get('pageSize')).toBe('25');
    expect(params.get('status')).toBe('confirmed');
    expect(params.get('sort')).toBe('desc');
    expect(params.get('from')).toBe('2026-07-01T00:00:00.000Z');
    expect(params.get('to')).toBe('2026-07-31T23:59:59.000Z');
  });

  it('@contract drops unparseable date bounds instead of sending them', async () => {
    vi.mocked(fetchJson).mockResolvedValue(page as never);

    const { result } = setup({
      restaurantId: 'rest-1',
      from: 'not-a-date',
      to: new Date('invalid'),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const params = requestedUrl();
    expect(params.has('from')).toBe(false);
    expect(params.has('to')).toBe(false);
  });

  it('@contract surfaces http errors', async () => {
    vi.mocked(fetchJson).mockRejectedValue(
      new HttpError({ message: 'Forbidden', status: 403, code: 'FORBIDDEN' }),
    );

    const { result } = setup({ restaurantId: 'rest-1' });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.status).toBe(403);
  });
});

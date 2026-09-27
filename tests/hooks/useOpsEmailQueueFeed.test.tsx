import { renderHook, waitFor } from '@testing-library/react';
import { createQueryWrapper, createTestQueryClient } from '@tests/utils/reactQuery';
import { describe, expect, it, vi } from 'vitest';

import { useOpsEmailQueueFeed } from '@/hooks/ops/useOpsEmailQueueFeed';

const service = vi.hoisted(() => ({ getRestaurantEmailQueue: vi.fn() }));
vi.mock('@/contexts/ops-services', () => ({ useBookingService: () => service }));

describe('email queue tenant boundary', () => {
  it('retains same-restaurant pagination but clears jobs on restaurant change', async () => {
    service.getRestaurantEmailQueue
      .mockResolvedValueOnce({ ok: true, restaurantId: 'r1', jobs: [{ id: 'job-1' }] })
      .mockImplementation(() => new Promise(() => undefined));
    const { result, rerender } = renderHook((props) => useOpsEmailQueueFeed(props), {
      initialProps: { restaurantId: 'r1', page: 1 },
      wrapper: createQueryWrapper(createTestQueryClient()),
    });
    await waitFor(() => expect(result.current.jobs).toEqual([{ id: 'job-1' }]));
    rerender({ restaurantId: 'r1', page: 2 });
    expect(result.current.jobs).toEqual([{ id: 'job-1' }]);
    expect(result.current.isPlaceholderData).toBe(true);
    rerender({ restaurantId: 'r2', page: 1 });
    expect(result.current.jobs).toBeNull();
    expect(result.current.isLoading).toBe(true);
  });
});

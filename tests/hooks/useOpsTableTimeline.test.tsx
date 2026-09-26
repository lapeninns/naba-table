import { renderHook, waitFor } from '@testing-library/react';
import { createQueryWrapper, createTestQueryClient } from '@tests/utils/reactQuery';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';


import { SUMMARY_INVALIDATION_DEBOUNCE_MS } from '@/lib/ops/realtime';
import { queryKeys } from '@/lib/query/keys';
import { recordBookingWrite } from '@src/hooks/ops/bookingWriteEcho';
import { useOpsTableTimeline } from '@src/hooks/ops/useOpsTableTimeline';

import { createFakeRealtimeClient, type FakeRealtimeClient } from './__helpers__/realtime';

const tableService = vi.hoisted(() => ({ timeline: vi.fn() }));
const realtime = vi.hoisted(() => ({ client: null as unknown }));

vi.mock('@/contexts/ops-services', () => ({ useTableInventoryService: () => tableService }));
vi.mock('@/lib/supabase/realtime-client', () => ({
  getRealtimeSupabaseClient: () => realtime.client,
}));

const restaurantId = '11111111-1111-4111-8111-111111111111';
const date = '2026-07-11';

function setup() {
  const queryClient = createTestQueryClient();
  const hook = renderHook(() => useOpsTableTimeline({ restaurantId, date }), {
    wrapper: createQueryWrapper(queryClient),
  });
  const channel = (realtime.client as FakeRealtimeClient).channels[0]!;
  const timelineKey = queryKeys.opsTables.timeline(restaurantId, {
    date,
    zoneId: null,
    service: 'all',
    includeSummary: true,
  });
  const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
  const timelineInvalidations = () =>
    invalidate.mock.calls.filter(
      ([filters]) => JSON.stringify(filters?.queryKey) === JSON.stringify(timelineKey),
    ).length;
  return { queryClient, hook, channel, timelineInvalidations };
}

const settle = () =>
  new Promise((resolve) => setTimeout(resolve, SUMMARY_INVALIDATION_DEBOUNCE_MS + 50));

describe('useOpsTableTimeline realtime', () => {
  beforeEach(() => {
    realtime.client = createFakeRealtimeClient();
    tableService.timeline.mockResolvedValue({ tables: [] });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('@contract coalesces a burst of allocation events from another client into one refetch', async () => {
    const { hook, channel, timelineInvalidations } = setup();
    await waitFor(() => expect(hook.result.current.isSuccess).toBe(true));

    for (const id of ['a1', 'a2', 'a3', 'a4']) {
      channel.emitPostgresChange('allocations', {
        eventType: 'INSERT',
        new: { id, booking_id: 'other-booking' },
        old: {},
      });
    }
    await settle();

    expect(timelineInvalidations()).toBe(1);
  });

  it('@contract skips the echoes of this client’s own write, including id-less DELETEs', async () => {
    const { hook, queryClient, channel, timelineInvalidations } = setup();
    await waitFor(() => expect(hook.result.current.isSuccess).toBe(true));

    recordBookingWrite(queryClient, 'b1');
    channel.emitPostgresChange('allocations', {
      eventType: 'INSERT',
      new: { id: 'a1', booking_id: 'b1' },
      old: {},
    });
    channel.emitPostgresChange('allocations', {
      eventType: 'DELETE',
      new: {},
      old: { id: 'a0' },
    });
    channel.emitPostgresChange('table_holds', {
      eventType: 'DELETE',
      new: {},
      old: { id: 'h0' },
    });
    await settle();

    expect(timelineInvalidations()).toBe(0);
  });
});

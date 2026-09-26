import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useTableTimelineController } from '@/components/features/tables/timeline/useTableTimelineController';
import { HttpError } from '@/lib/http/errors';
import { createAppQueryClient } from '@/lib/query/client';

import type { SelectedSegment } from '@/components/features/tables/timeline/tableTimelineDomain';
import type { ReactNode } from 'react';

const releaseTableHoldMock = vi.hoisted(() => vi.fn());
const refetchMock = vi.hoisted(() => vi.fn());

vi.mock('@/services/ops/table-holds', () => ({ releaseTableHold: releaseTableHoldMock }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), dismiss: vi.fn() } }));
vi.mock('@/contexts/ops-session', () => ({
  useOpsSession: () => ({
    activeRestaurantId: 'rest-a',
    activeMembership: { restaurantId: 'rest-a', role: 'host' },
  }),
}));
vi.mock('@/hooks/ops/useOpsTableTimeline', () => ({
  useOpsTableTimeline: () => ({ data: undefined, refetch: refetchMock }),
}));

const holdSelection = {
  table: { id: 'table-1', tableNumber: '5', capacity: 4, zoneId: 'z', zoneName: 'Main' },
  segment: {
    start: '2026-09-26T18:00:00.000Z',
    end: '2026-09-26T19:00:00.000Z',
    state: 'hold',
    booking: null,
    hold: { id: 'hold-1', bookingId: null },
  },
} as unknown as SelectedSegment;

function render(queryClient: QueryClient) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return renderHook(() => useTableTimelineController(), { wrapper });
}

describe('useTableTimelineController hold release', () => {
  const fetchSpy = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', fetchSpy);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('releases an unbound hold through the mutation and closes the dialog', async () => {
    releaseTableHoldMock.mockResolvedValue({
      holdId: 'hold-1',
      released: true,
      alreadyReleased: false,
    });
    const { result } = render(createAppQueryClient());
    act(() => result.current.setSelectedSegment(holdSelection));

    act(() => result.current.handleReleaseHold('hold-1'));

    await waitFor(() => expect(result.current.selectedSegment).toBeNull());
    expect(releaseTableHoldMock).toHaveBeenCalledWith(
      { restaurantId: 'rest-a', holdId: 'hold-1' },
      expect.anything(),
    );
    // No raw fetch and no manual refetch: the hook invalidates the timeline.
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(refetchMock).not.toHaveBeenCalled();
    expect(result.current.actionState).toEqual({ releasing: false, error: null });
  });

  it('shows a safe inline error and keeps the dialog open when the release fails', async () => {
    releaseTableHoldMock.mockRejectedValue(
      new HttpError({ message: 'relation secret', status: 500, code: 'INTERNAL_ERROR' }),
    );
    const { result } = render(createAppQueryClient());
    act(() => result.current.setSelectedSegment(holdSelection));

    act(() => result.current.handleReleaseHold('hold-1'));

    await waitFor(() => expect(result.current.actionState.error).not.toBeNull());
    expect(result.current.actionState.error).not.toContain('secret');
    expect(result.current.selectedSegment).toBe(holdSelection);

    act(() => result.current.closeSelectedSegment());
    expect(result.current.actionState).toEqual({ releasing: false, error: null });
    expect(result.current.selectedSegment).toBeNull();
  });

  it('reports the pending state while the release is in flight', async () => {
    let resolve!: (value: unknown) => void;
    releaseTableHoldMock.mockReturnValue(new Promise((res) => (resolve = res)));
    const { result } = render(createAppQueryClient());
    act(() => result.current.setSelectedSegment(holdSelection));

    act(() => result.current.handleReleaseHold('hold-1'));

    await waitFor(() => expect(result.current.actionState.releasing).toBe(true));
    await act(async () => {
      resolve({ holdId: 'hold-1', released: true, alreadyReleased: false });
    });
    await waitFor(() => expect(result.current.actionState.releasing).toBe(false));
  });
});

import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { OpsEmailQueuePanel } from '@/components/features/email-delivery/components/OpsEmailQueuePanel';

const useOpsEmailQueueFeedMock = vi.hoisted(() => vi.fn());
const refetchMock = vi.hoisted(() => vi.fn());

vi.mock('@/hooks/ops/useOpsEmailQueueFeed', () => ({
  useOpsEmailQueueFeed: useOpsEmailQueueFeedMock,
}));

function makeQueueQuery() {
  return {
    response: {
      ok: true,
      restaurantId: 'rest-1',
      pageInfo: { page: 1, pageSize: 25, hasNext: false, total: 0 },
      summary: { total: 0, waiting: 0, active: 0, delayed: 0, dlq: 0 },
      jobs: [],
      timestamp: '2026-05-16T09:00:00.000Z',
    },
    jobs: [],
    summary: { total: 0, waiting: 0, active: 0, delayed: 0, dlq: 0 },
    apiError: null,
    isLoading: false,
    isFetching: false,
    dataUpdatedAt: 0,
    refetch: refetchMock,
  };
}

describe('OpsEmailQueuePanel', () => {
  beforeEach(() => {
    useOpsEmailQueueFeedMock.mockReset();
    refetchMock.mockReset();
    useOpsEmailQueueFeedMock.mockImplementation(() => makeQueueQuery());
  });

  it('manual refresh refetches once per refresh key despite query object identity changes', async () => {
    const { rerender } = render(
      <OpsEmailQueuePanel restaurantId="rest-1" timezone="UTC" refreshKey={1} />,
    );

    await waitFor(() => {
      expect(refetchMock).toHaveBeenCalledTimes(1);
    });

    rerender(<OpsEmailQueuePanel restaurantId="rest-1" timezone="UTC" refreshKey={1} />);

    await waitFor(() => {
      expect(useOpsEmailQueueFeedMock).toHaveBeenCalledTimes(2);
    });
    expect(refetchMock).toHaveBeenCalledTimes(1);

    rerender(<OpsEmailQueuePanel restaurantId="rest-1" timezone="UTC" refreshKey={2} />);

    await waitFor(() => {
      expect(refetchMock).toHaveBeenCalledTimes(2);
    });
  });
});

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { OpsEmailQueuePanelHeader } from '@/components/features/email-delivery/components/OpsEmailQueuePanelHeader';
import { buildOpsEmailQueueMetrics } from '@/components/features/email-delivery/opsEmailQueuePanelDomain';

import type { OpsEmailQueuePanelState } from '@/components/features/email-delivery/useOpsEmailQueuePanelState';
import type { OpsEmailQueueFeedResponse } from '@/types/emailQueue';

function makeState(overrides: Partial<OpsEmailQueuePanelState> = {}): OpsEmailQueuePanelState {
  const response: Extract<OpsEmailQueueFeedResponse, { ok: true }> = {
    ok: true,
    restaurantId: 'rest-1',
    pageInfo: { page: 1, pageSize: 25, hasNext: false, total: 3 },
    summary: { total: 3, waiting: 1, active: 1, delayed: 1, dlq: 0 },
    jobs: [],
    timestamp: '2026-03-20T15:00:00Z',
  };

  return {
    handleNextPage: vi.fn(),
    handlePreviousPage: vi.fn(),
    handleStatusChange: vi.fn(),
    jobs: [],
    page: 1,
    query: { response } as OpsEmailQueuePanelState['query'],
    queueMetrics: buildOpsEmailQueueMetrics(response.summary),
    shouldForceFixtureLoadingMarker: false,
    showLoadingState: false,
    showRefetchIndicator: false,
    status: 'all',
    total: 3,
    ...overrides,
  } as OpsEmailQueuePanelState;
}

describe('OpsEmailQueuePanelHeader', () => {
  it('@contract renders the title, pinned last-updated timestamp, and metrics grid', () => {
    render(<OpsEmailQueuePanelHeader state={makeState()} timezone="UTC" />);

    expect(screen.getByText('Scheduled email queue')).toBeInTheDocument();
    // Timestamp formatted in the explicit UTC zone.
    expect(screen.getByText('Fri, Mar 20 · 15:00')).toBeInTheDocument();
    expect(screen.getByText('Total in queue')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('@contract omits the timestamp badge when the queue response failed', () => {
    render(
      <OpsEmailQueuePanelHeader
        state={makeState({
          query: {
            response: { ok: false, code: 'INTERNAL', error: 'boom' },
          } as OpsEmailQueuePanelState['query'],
        })}
        timezone="UTC"
      />,
    );

    expect(screen.queryByText('Fri, Mar 20 · 15:00')).not.toBeInTheDocument();
  });

  it('@contract renders every status filter option and reports selections', async () => {
    const user = userEvent.setup();
    const state = makeState();
    render(<OpsEmailQueuePanelHeader state={state} timezone="UTC" />);

    for (const label of ['All', 'Scheduled', 'Ready now', 'Sending now', 'Needs attention']) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
    }

    await user.click(screen.getByRole('button', { name: 'Needs attention' }));

    expect(state.handleStatusChange).toHaveBeenCalledWith('dlq');
  });
});

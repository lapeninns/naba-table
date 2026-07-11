import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { OpsEmailQueuePanelContent } from '@/components/features/email-delivery/components/OpsEmailQueuePanelContent';

import type { OpsEmailQueuePanelState } from '@/components/features/email-delivery/useOpsEmailQueuePanelState';
import type { OpsEmailQueueJobDTO } from '@/types/emailQueue';

const job: OpsEmailQueueJobDTO = {
  id: 'job-1',
  status: 'waiting',
  type: 'review_request',
  bookingId: 'booking-1',
  restaurantId: 'rest-1',
  scheduledFor: '2026-03-20T15:00:00Z',
  failedReason: null,
  failedAt: null,
  attemptsMade: 0,
  booking: null,
};

function makeState(overrides: Partial<OpsEmailQueuePanelState> = {}): OpsEmailQueuePanelState {
  return {
    handleNextPage: vi.fn(),
    handlePreviousPage: vi.fn(),
    handleStatusChange: vi.fn(),
    jobs: [],
    page: 1,
    query: {
      apiError: null,
      error: null,
      response: null,
    } as unknown as OpsEmailQueuePanelState['query'],
    queueMetrics: [],
    shouldForceFixtureLoadingMarker: false,
    showLoadingState: false,
    showRefetchIndicator: false,
    status: 'all',
    total: 0,
    ...overrides,
  } as OpsEmailQueuePanelState;
}

function renderContent(state: OpsEmailQueuePanelState) {
  return render(<OpsEmailQueuePanelContent restaurantId="rest-1" state={state} timezone="UTC" />);
}

describe('OpsEmailQueuePanelContent', () => {
  it('@contract prefers the API error notice over all other states', () => {
    renderContent(
      makeState({
        showLoadingState: true,
        query: {
          apiError: { error: 'Queue backend unavailable' },
          error: null,
          response: null,
        } as unknown as OpsEmailQueuePanelState['query'],
      }),
    );

    expect(screen.getByText('Queue backend unavailable')).toBeInTheDocument();
    expect(screen.queryByLabelText('Loading email queue')).not.toBeInTheDocument();
  });

  it('@contract falls back to the thrown-error message when there is no API error payload', () => {
    renderContent(
      makeState({
        query: {
          apiError: null,
          error: new Error('Failed to fetch'),
          response: null,
        } as unknown as OpsEmailQueuePanelState['query'],
      }),
    );

    expect(screen.getByText('Failed to fetch')).toBeInTheDocument();
  });

  it('@contract @a11y shows the labeled loading table while loading with no rows yet', () => {
    renderContent(makeState({ showLoadingState: true }));

    expect(screen.getByLabelText('Loading email queue')).toBeInTheDocument();
  });

  it('@contract shows the empty state when settled with zero jobs', () => {
    renderContent(makeState());

    expect(screen.getByText('No queued emails right now')).toBeInTheDocument();
    expect(screen.getByText(/scheduled reminders and confirmations will appear here/i)).toBeInTheDocument();
  });

  it('@contract renders the jobs table when jobs exist and flags background refreshes', () => {
    renderContent(
      makeState({
        jobs: [job],
        total: 1,
        showLoadingState: true,
        showRefetchIndicator: true,
        query: {
          apiError: null,
          error: null,
          response: {
            ok: true,
            restaurantId: 'rest-1',
            pageInfo: { page: 1, pageSize: 25, hasNext: false, total: 1 },
            summary: { total: 1, waiting: 1, active: 0, delayed: 0, dlq: 0 },
            jobs: [job],
            timestamp: '2026-03-20T15:00:00Z',
          },
        } as unknown as OpsEmailQueuePanelState['query'],
      }),
    );

    expect(screen.getByRole('region', { name: 'Refreshing email queue' })).toBeInTheDocument();
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getAllByText('Review request').length).toBeGreaterThan(0);
    expect(screen.queryByText('No queued emails right now')).not.toBeInTheDocument();
  });
});

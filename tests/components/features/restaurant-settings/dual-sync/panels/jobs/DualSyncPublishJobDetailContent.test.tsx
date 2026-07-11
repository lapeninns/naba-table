import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { DualSyncPublishJobDetailContent } from '@/components/features/restaurant-settings/dual-sync/panels/jobs/DualSyncPublishJobDetailContent';

import { makeDualSyncPublishJobRollup, makeDualSyncPublishOperation } from '../../../testUtils';

import type { GetDualSyncPublishJobDetailResponse } from '@/services/ops/dual-sync';
import type { UseQueryResult } from '@tanstack/react-query';

function makeDetailQuery(over: Record<string, unknown> = {}) {
  return {
    data: undefined,
    error: null,
    isLoading: false,
    isError: false,
    isFetching: false,
    refetch: vi.fn(),
    ...over,
  } as unknown as UseQueryResult<GetDualSyncPublishJobDetailResponse, Error>;
}

const loadedDetail = {
  rollup: makeDualSyncPublishJobRollup(),
  batch: null,
  operationGroups: [],
  operations: [makeDualSyncPublishOperation()],
} as unknown as GetDualSyncPublishJobDetailResponse;

describe('DualSyncPublishJobDetailContent', () => {
  it('@contract explains when no detail loader is configured', () => {
    render(<DualSyncPublishJobDetailContent jobId="publish-job-1" />);

    expect(screen.getByText('Detail loader not configured.')).toBeInTheDocument();
  });

  it('@contract shows the loading state while fetching another job', () => {
    render(
      <DualSyncPublishJobDetailContent
        jobId="publish-job-1"
        publishJobDetailQuery={makeDetailQuery({ isFetching: true })}
      />,
    );

    expect(screen.queryByText('Operations (1)')).not.toBeInTheDocument();
  });

  it('@contract shows the error state with a working retry', async () => {
    const user = userEvent.setup();
    const query = makeDetailQuery({ isError: true, error: new Error('Detail fetch failed') });
    render(<DualSyncPublishJobDetailContent jobId="publish-job-1" publishJobDetailQuery={query} />);

    expect(screen.getByText('Detail fetch failed')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(query.refetch).toHaveBeenCalledTimes(1);
  });

  it('@contract treats detail data for another job as stale', () => {
    render(
      <DualSyncPublishJobDetailContent
        jobId="publish-job-OTHER"
        publishJobDetailQuery={makeDetailQuery({ data: loadedDetail })}
      />,
    );

    expect(screen.getByText('Loading detail…')).toBeInTheDocument();
  });

  it('@contract renders the loaded operations for the selected job', () => {
    render(
      <DualSyncPublishJobDetailContent
        jobId="publish-job-1"
        publishJobDetailQuery={makeDetailQuery({ data: loadedDetail })}
      />,
    );

    expect(screen.getByText('Operations (1)')).toBeInTheDocument();
    expect(screen.getByText('profile.name')).toBeInTheDocument();
  });
});

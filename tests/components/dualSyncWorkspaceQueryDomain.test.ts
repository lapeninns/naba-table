import { describe, expect, it } from 'vitest';

import {
  buildDualSyncWorkspaceLazyRequests,
  type DualSyncWorkspaceLazyPanelState,
} from '@/components/features/restaurant-settings/dual-sync/dualSyncWorkspaceQueryDomain';

function makeLazyPanelState(
  overrides: Partial<DualSyncWorkspaceLazyPanelState> = {},
): DualSyncWorkspaceLazyPanelState {
  return {
    showOperationalHealth: false,
    showOperations: false,
    showPendingCandidates: false,
    showPublishJobs: false,
    showQueueJobs: false,
    ...overrides,
  };
}

describe('dualSyncWorkspaceQueryDomain', () => {
  it('skips all optional lazy panel requests when panels are inactive', () => {
    expect(buildDualSyncWorkspaceLazyRequests(makeLazyPanelState(), 'job-1')).toEqual({
      operationsRequest: undefined,
      candidatesRequest: undefined,
      jobsRequest: undefined,
      metricsRequest: undefined,
      publishJobsRequest: undefined,
      publishJobDetailId: null,
    });
  });

  it('builds the expected request windows for active lazy panels', () => {
    expect(
      buildDualSyncWorkspaceLazyRequests(
        makeLazyPanelState({
          showOperationalHealth: true,
          showOperations: true,
          showPendingCandidates: true,
          showPublishJobs: true,
          showQueueJobs: true,
        }),
        'job-1',
      ),
    ).toEqual({
      operationsRequest: { limit: 50 },
      candidatesRequest: { limit: 50, statuses: ['open'] },
      jobsRequest: {
        limit: 25,
        statuses: ['queued', 'running', 'retrying', 'dead_letter', 'failed'],
      },
      metricsRequest: { windowHours: 24, limit: 200 },
      publishJobsRequest: { jobLimit: 25 },
      publishJobDetailId: 'job-1',
    });
  });

  it('requests publish job detail only when the publish panel is active', () => {
    expect(
      buildDualSyncWorkspaceLazyRequests(makeLazyPanelState({ showPublishJobs: true }), 'job-1')
        .publishJobDetailId,
    ).toBe('job-1');
    expect(
      buildDualSyncWorkspaceLazyRequests(makeLazyPanelState({ showPublishJobs: false }), 'job-1')
        .publishJobDetailId,
    ).toBeNull();
  });
});

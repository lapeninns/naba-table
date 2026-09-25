import { act, render, renderHook, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { getDualSyncReconnectErrorToastIntent } from '@/components/features/restaurant-settings/dual-sync/dualSyncReconnectActionDomain';
import {
  getDualSyncErrorMessage,
  getDualSyncErrorToastIntent,
} from '@/components/features/restaurant-settings/dual-sync/dualSyncShellActionDomain';
import { DualSyncShellErrorState } from '@/components/features/restaurant-settings/dual-sync/DualSyncShellStateViews';
import { useDualSyncExactPublishActions } from '@/components/features/restaurant-settings/dual-sync/hooks/useDualSyncExactPublishActions';
import { DualSyncOperationalHealthPanel } from '@/components/features/restaurant-settings/dual-sync/panels/health/DualSyncOperationalHealthPanel';
import { getDualSyncPendingCandidateCancelErrorToastIntent } from '@/components/features/restaurant-settings/dual-sync/panels/jobs/dualSyncPendingCandidatesDomain';
import { DualSyncPendingCandidatesPanel } from '@/components/features/restaurant-settings/dual-sync/panels/jobs/DualSyncPendingCandidatesPanel';
import { DualSyncPublishJobDetailContent } from '@/components/features/restaurant-settings/dual-sync/panels/jobs/DualSyncPublishJobDetailContent';
import { DualSyncPublishJobsPanel } from '@/components/features/restaurant-settings/dual-sync/panels/jobs/DualSyncPublishJobsPanel';
import { getDualSyncQueueJobRetryErrorToastIntent } from '@/components/features/restaurant-settings/dual-sync/panels/jobs/dualSyncQueueJobsDomain';
import { DualSyncQueueJobsPanel } from '@/components/features/restaurant-settings/dual-sync/panels/jobs/DualSyncQueueJobsPanel';
import { DualSyncOperationsPanel } from '@/components/features/restaurant-settings/dual-sync/panels/operations/DualSyncOperationsPanel';
import { HttpError } from '@/lib/http/errors';

import type { DualSyncWorkspace } from '@/components/features/restaurant-settings/dual-sync/hooks/useDualSyncWorkspace';
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query';

const SENTINEL = 'SECRET_DB_DETAIL relation "x" does not exist';

function sentinelError() {
  return new HttpError({ status: 500, message: SENTINEL });
}

function failedQuery<T>(): UseQueryResult<T, Error> {
  return {
    data: undefined,
    error: sentinelError(),
    isLoading: false,
    isError: true,
    refetch: vi.fn(),
  } as unknown as UseQueryResult<T, Error>;
}

function idleMutation<TData, TVariables>(): UseMutationResult<TData, Error, TVariables> {
  return {
    mutateAsync: vi.fn(),
    isPending: false,
    variables: undefined,
  } as unknown as UseMutationResult<TData, Error, TVariables>;
}

function expectNoSentinel() {
  expect(document.body.textContent).not.toContain('SECRET_DB_DETAIL');
}

describe('dual-sync error copy never shows raw error text', () => {
  it('@contract maps shell action and toast errors to fixed copy with a reason code', () => {
    expect(getDualSyncErrorMessage(sentinelError(), 'Refresh failed.')).toBe(
      'Refresh failed. Reason code: HTTP_500.',
    );
    expect(getDualSyncErrorToastIntent(new Error(SENTINEL), 'Publish failed.')).toEqual({
      kind: 'error',
      message: 'Publish failed. Reason code: unknown_error.',
    });
  });

  it('@contract maps reconnect, cancel and retry errors to fixed copy', () => {
    const intents = [
      getDualSyncReconnectErrorToastIntent(sentinelError()),
      getDualSyncPendingCandidateCancelErrorToastIntent(sentinelError()),
      getDualSyncQueueJobRetryErrorToastIntent(sentinelError()),
    ];

    expect(intents.map((intent) => intent.message)).toEqual([
      'Google reconnect failed. Reason code: HTTP_500.',
      'Pending change cancellation failed. Reason code: HTTP_500.',
      'Queue job retry failed. Reason code: HTTP_500.',
    ]);
  });

  it('@contract renders the shell load error as fixed copy', () => {
    render(<DualSyncShellErrorState error={sentinelError()} />);

    expect(
      screen.getByText(/The differences could not be loaded\. Reason code: HTTP_500\./),
    ).toBeInTheDocument();
    expect(screen.getByText(/Your saved settings are unchanged/)).toBeInTheDocument();
    expectNoSentinel();
  });

  it('@contract renders every lazy panel load error as fixed copy', () => {
    const { unmount: unmountHealth } = render(
      <DualSyncOperationalHealthPanel metricsQuery={failedQuery()} />,
    );
    expect(
      screen.getByText('Operational health could not be loaded. Reason code: HTTP_500.'),
    ).toBeInTheDocument();
    expectNoSentinel();
    unmountHealth();

    const { unmount: unmountOperations } = render(
      <DualSyncOperationsPanel operationsQuery={failedQuery()} />,
    );
    expect(
      screen.getByText('Publish operations could not be loaded. Reason code: HTTP_500.'),
    ).toBeInTheDocument();
    expectNoSentinel();
    unmountOperations();

    const { unmount: unmountPublishJobs } = render(
      <DualSyncPublishJobsPanel publishJobsQuery={failedQuery()} />,
    );
    expect(
      screen.getByText('Recent publishes could not be loaded. Reason code: HTTP_500.'),
    ).toBeInTheDocument();
    expectNoSentinel();
    unmountPublishJobs();

    const { unmount: unmountDetail } = render(
      <DualSyncPublishJobDetailContent jobId="job-1" publishJobDetailQuery={failedQuery()} />,
    );
    expect(
      screen.getByText('Publish job detail could not be loaded. Reason code: HTTP_500.'),
    ).toBeInTheDocument();
    expectNoSentinel();
    unmountDetail();

    const { unmount: unmountQueue } = render(
      <DualSyncQueueJobsPanel jobsQuery={failedQuery()} retryJobMutation={idleMutation()} />,
    );
    expect(
      screen.getByText('Queue jobs could not be loaded. Reason code: HTTP_500.'),
    ).toBeInTheDocument();
    expectNoSentinel();
    unmountQueue();

    render(
      <DualSyncPendingCandidatesPanel
        candidatesQuery={failedQuery()}
        cancelCandidateMutation={idleMutation()}
      />,
    );
    expect(
      screen.getByText('Pending changes could not be loaded. Reason code: HTTP_500.'),
    ).toBeInTheDocument();
    expectNoSentinel();
  });

  it('@contract toasts fixed copy when refreshing an expired exact preview fails', async () => {
    const showToast = vi.fn();
    const workspace = {
      decisions: {},
      stateQuery: { data: undefined, refetch: vi.fn() },
      refreshMutation: { mutateAsync: vi.fn().mockRejectedValue(sentinelError()) },
      exactPreviewPublishMutation: { mutateAsync: vi.fn() },
      exactPublishMutation: { mutateAsync: vi.fn() },
      setDecisions: vi.fn(),
    } as unknown as DualSyncWorkspace;

    const { result } = renderHook(() =>
      useDualSyncExactPublishActions({
        workspace,
        syncPaused: false,
        pauseReason: '',
        canSubmit: true,
        showToast,
      }),
    );

    await act(async () => {
      result.current.onRefreshExpired();
      await Promise.resolve();
    });

    expect(showToast).toHaveBeenCalledWith({
      kind: 'error',
      message: 'Unable to refresh expired preview. Reason code: HTTP_500.',
    });
    expect(JSON.stringify(showToast.mock.calls)).not.toContain('SECRET_DB_DETAIL');
  });
});

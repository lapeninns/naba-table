import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DualSyncShell } from '@/components/features/restaurant-settings/dual-sync/DualSyncShell';

import type { DualSyncPublishPlan } from '@/server/dual-sync/publish/types';
import type {
  DualSyncFieldSummary,
  DualSyncPublishRequest,
  DualSyncPublishResponse,
  GetDualSyncStateResponse,
} from '@/services/ops/dual-sync';

const mocks = vi.hoisted(() => ({
  useOpsDualSync: vi.fn(),
  useOpsGoogleBusinessProfileConnection: vi.fn(),
  useOpsStartGoogleBusinessProfileAuthorization: vi.fn(),
  toast: {
    error: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
  },
}));

vi.mock('@/hooks/ops/useOpsDualSync', () => ({
  useOpsDualSync: mocks.useOpsDualSync,
}));

vi.mock('@/hooks/ops/useOpsGoogleBusinessProfile', () => ({
  useOpsGoogleBusinessProfileConnection: mocks.useOpsGoogleBusinessProfileConnection,
  useOpsStartGoogleBusinessProfileAuthorization:
    mocks.useOpsStartGoogleBusinessProfileAuthorization,
}));

vi.mock('sonner', () => ({
  toast: mocks.toast,
}));

function makeField(over: Partial<DualSyncFieldSummary> = {}): DualSyncFieldSummary {
  return {
    fieldKey: 'profile.phone',
    sectionKey: 'profile',
    kind: 'profile',
    label: 'Phone number',
    helpText: null,
    conflictPolicy: 'manual',
    deletePolicy: 'manual',
    policy: {
      fieldKey: 'profile.phone',
      sectionKey: 'profile',
      authority: 'bidirectional_manual',
      riskLevel: 'critical',
      importable: true,
      exportable: true,
      requiresManualReview: true,
      googleWriteGroup: 'location.profile',
      semanticComparator: 'phone',
      canonicalizer: 'canonicalizePhone',
      destructiveWritePossible: false,
    },
    importable: true,
    exportable: true,
    sortOrder: 0,
    coreValue: '+44 1223 000000',
    gbpValue: '+44 1223 111111',
    coreCanonicalHash: 'core-phone-hash',
    gbpCanonicalHash: 'gbp-phone-hash',
    capability: { canImport: true, canExport: true, canIgnore: true, blockedReasons: [] },
    state: 'core_dirty',
    lastInSyncAt: null,
    lastInSyncHash: null,
    lastCoreChangeAt: '2026-05-09T10:00:00.000Z',
    lastGbpChangeAt: null,
    openCandidate: null,
    ...over,
  };
}

function makeState(
  fields: ReadonlyArray<DualSyncFieldSummary> = [makeField()],
): GetDualSyncStateResponse {
  return {
    restaurantId: 'restaurant-1',
    coreSnapshot: {},
    gbpSnapshot: {},
    coreSnapshotHash: 'state-core-hash',
    gbpSnapshotHash: 'state-gbp-hash',
    fields,
    outboundQueue: {
      totalOpen: 0,
      autoExportable: 0,
      missingBaseline: 0,
      lastQueuedAt: null,
    },
    lastSnapshot: {
      runId: 'snapshot-run-1',
      runKind: 'scheduled',
      startedAt: '2026-05-09T10:00:00.000Z',
      finishedAt: '2026-05-09T10:00:01.000Z',
    },
    control: {
      restaurantId: 'restaurant-1',
      provider: 'google_business_profile',
      syncPaused: false,
      pauseReason: null,
      pausedByUserId: null,
      pausedAt: null,
      resumedAt: null,
      createdAt: null,
      updatedAt: null,
    },
  };
}

function makePlan(): DualSyncPublishPlan {
  return {
    restaurantId: 'restaurant-1',
    coreSnapshotHash: 'plan-core-hash',
    gbpSnapshotHash: 'plan-gbp-hash',
    acceptedCount: 1,
    rejectedCount: 0,
    ignoredCount: 0,
    groups: [
      {
        groupId: 'export_to_google:profile:location.profile',
        direction: 'export_to_google',
        sectionKey: 'profile',
        writeGroup: 'location.profile',
        fields: [
          {
            fieldKey: 'profile.phone',
            sectionKey: 'profile',
            action: 'export_to_google',
            pinnedCoreHash: 'core-phone-hash',
            pinnedGbpHash: 'gbp-phone-hash',
          },
        ],
        riskLevel: 'critical',
        requiresPreflight: true,
        requiresManualConfirmation: true,
        destructiveWritePossible: false,
        googleUpdateMasks: ['phoneNumbers'],
      },
    ],
    rejected: [],
    warnings: [
      {
        code: 'HIGH_RISK',
        groupId: 'export_to_google:profile:location.profile',
        message: 'Profile phone updates public Google Business Profile data.',
      },
    ],
  };
}

function makeResult(): DualSyncPublishResponse {
  return {
    publishJobId: 'publish-job-1',
    restaurantId: 'restaurant-1',
    totalDecisions: 1,
    succeededCount: 1,
    failedCount: 0,
    skippedCount: 0,
    operations: [
      {
        id: 'operation-1',
        restaurantId: 'restaurant-1',
        publishJobId: 'publish-job-1',
        publishBatchId: 'batch-1',
        operationGroupId: 'group-1',
        sectionKey: 'profile',
        fieldKey: 'profile.phone',
        direction: 'export_to_google',
        status: 'succeeded',
        attemptCount: 1,
        beforeCoreHash: 'core-phone-hash',
        beforeGbpHash: 'gbp-phone-hash',
        afterCoreHash: 'after-core-phone-hash',
        afterGbpHash: 'after-gbp-phone-hash',
        googleUpdateMask: 'phoneNumbers',
        errorCode: null,
        errorMessage: null,
        externalResponse: null,
        startedAt: '2026-05-09T10:01:00.000Z',
        finishedAt: '2026-05-09T10:01:01.000Z',
        createdAt: '2026-05-09T10:01:00.000Z',
        updatedAt: '2026-05-09T10:01:01.000Z',
      },
    ],
    failures: [],
  };
}

function makeQuery<T>(data: T) {
  return {
    data,
    error: null,
    isError: false,
    isFetching: false,
    isLoading: false,
    isPending: false,
    refetch: vi.fn(),
  };
}

function makeMutation<TInput, TOutput>(mutateAsync: (input: TInput) => Promise<TOutput>) {
  return {
    error: null,
    isError: false,
    isPending: false,
    mutateAsync,
  };
}

beforeEach(() => {
  mocks.useOpsDualSync.mockReset();
  mocks.useOpsGoogleBusinessProfileConnection.mockReturnValue(
    makeQuery({
      isConfigured: true,
      provider: 'google_business_profile',
      status: 'linked',
      pushEnabled: true,
      connectedGoogleEmail: 'ops@example.test',
      connectedGoogleName: 'Ops Test',
      externalAccountId: 'account-1',
      externalAccountName: 'Ops Test',
      externalLocationId: 'locations/1',
      externalLocationName: 'locations/1',
      externalLocationTitle: 'QA GBP Restaurant',
      externalPlaceId: 'places/1',
      providerTimezone: 'Europe/London',
      lastPullAt: null,
      lastPushAt: null,
      lastError: null,
      availableLocations: [],
      businessInfo: {},
    }),
  );
  mocks.useOpsStartGoogleBusinessProfileAuthorization.mockReturnValue({
    isPending: false,
    mutate: vi.fn(),
  });
});

describe('DualSyncShell publish flow', () => {
  it('previews selected decisions, publishes accepted plan fields, and opens the result dialog', async () => {
    const user = userEvent.setup();
    const previewPublish = vi.fn<
      [(request: DualSyncPublishRequest) => Promise<DualSyncPublishPlan>]
    >(async () => makePlan());
    const publish = vi.fn<[(request: DualSyncPublishRequest) => Promise<DualSyncPublishResponse>]>(
      async () => makeResult(),
    );

    mocks.useOpsDualSync.mockReturnValue({
      stateQuery: makeQuery(makeState()),
      refreshMutation: makeMutation(async () => ({})),
      publishMutation: makeMutation(publish),
      previewPublishMutation: makeMutation(previewPublish),
      autoExportMutation: makeMutation(async () => ({
        restaurantId: 'restaurant-1',
        candidatesConsidered: 0,
        decisionsExecuted: 0,
        publishResult: null,
        skipped: [],
      })),
      retryJobMutation: makeMutation(async () => ({})),
      cancelCandidateMutation: makeMutation(async () => ({})),
      controlMutation: makeMutation(async () => ({
        restaurantId: 'restaurant-1',
        control: makeState().control,
      })),
      operationsQuery: makeQuery({ restaurantId: 'restaurant-1', operations: [] }),
      jobsQuery: makeQuery({ restaurantId: 'restaurant-1', jobs: [] }),
      candidatesQuery: makeQuery({ restaurantId: 'restaurant-1', candidates: [] }),
      metricsQuery: makeQuery(null),
      publishJobsQuery: makeQuery({ restaurantId: 'restaurant-1', jobs: [] }),
      publishJobDetailQuery: makeQuery(null),
    });

    render(<DualSyncShell restaurantId="restaurant-1" sections={['profile']} />);

    await user.click(screen.getByRole('button', { name: 'Export (1)' }));
    await user.click(screen.getByRole('button', { name: 'Review and publish (1)' }));

    expect(await screen.findByText('Review publish plan')).toBeInTheDocument();
    expect(previewPublish).toHaveBeenCalledWith(
      expect.objectContaining({
        pinnedCoreSnapshotHash: 'state-core-hash',
        pinnedGbpSnapshotHash: 'state-gbp-hash',
        decisions: [
          {
            fieldKey: 'profile.phone',
            sectionKey: 'profile',
            action: 'export_to_google',
            pinnedCoreHash: 'core-phone-hash',
            pinnedGbpHash: 'gbp-phone-hash',
          },
        ],
      }),
    );

    await user.click(
      screen.getByRole('checkbox', {
        name: 'I understand this may update public Google Business Profile data.',
      }),
    );
    await user.click(screen.getByRole('button', { name: 'Publish 1 field' }));

    await waitFor(() => {
      expect(publish).toHaveBeenCalledWith(
        expect.objectContaining({
          pinnedCoreSnapshotHash: 'plan-core-hash',
          pinnedGbpSnapshotHash: 'plan-gbp-hash',
          decisions: [
            {
              fieldKey: 'profile.phone',
              sectionKey: 'profile',
              action: 'export_to_google',
              pinnedCoreHash: 'core-phone-hash',
              pinnedGbpHash: 'gbp-phone-hash',
            },
          ],
        }),
      );
    });
    expect(await screen.findByText('Publish completed')).toBeInTheDocument();
    expect(screen.getByText('1 succeeded')).toBeInTheDocument();
    expect(screen.getByText('profile.phone')).toBeInTheDocument();
    expect(screen.getByText('phoneNumbers')).toBeInTheDocument();
  });

  it('disables write-affecting actions when the restaurant is paused', () => {
    const state = {
      ...makeState(),
      control: {
        ...makeState().control,
        syncPaused: true,
        pauseReason: 'Maintenance window.',
        pausedAt: '2026-05-09T10:00:00.000Z',
      },
    };

    mocks.useOpsDualSync.mockReturnValue({
      stateQuery: makeQuery(state),
      refreshMutation: makeMutation(async () => ({})),
      publishMutation: makeMutation(async () => makeResult()),
      previewPublishMutation: makeMutation(async () => makePlan()),
      autoExportMutation: makeMutation(async () => ({
        restaurantId: 'restaurant-1',
        candidatesConsidered: 0,
        decisionsExecuted: 0,
        publishResult: null,
        skipped: [],
      })),
      retryJobMutation: makeMutation(async () => ({})),
      cancelCandidateMutation: makeMutation(async () => ({})),
      controlMutation: makeMutation(async () => ({
        restaurantId: 'restaurant-1',
        control: makeState().control,
      })),
      operationsQuery: makeQuery({ restaurantId: 'restaurant-1', operations: [] }),
      jobsQuery: makeQuery({ restaurantId: 'restaurant-1', jobs: [] }),
      candidatesQuery: makeQuery({ restaurantId: 'restaurant-1', candidates: [] }),
      metricsQuery: makeQuery(null),
      publishJobsQuery: makeQuery({ restaurantId: 'restaurant-1', jobs: [] }),
      publishJobDetailQuery: makeQuery(null),
    });

    render(<DualSyncShell restaurantId="restaurant-1" sections={['profile']} />);

    expect(screen.getByText('Dual-sync is paused.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /import latest google details/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /^review and publish$/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /resume sync/i })).toBeEnabled();
  });

  it('counts only fields that need an operator choice for section bulk actions', () => {
    mocks.useOpsDualSync.mockReturnValue({
      stateQuery: makeQuery(
        makeState([
          makeField({ fieldKey: 'profile.phone', state: 'core_dirty' }),
          makeField({
            fieldKey: 'profile.website',
            label: 'Website',
            state: 'in_sync',
          }),
          makeField({
            fieldKey: 'profile.pendingExport',
            label: 'Pending export',
            state: 'pending_export',
          }),
        ]),
      ),
      refreshMutation: makeMutation(async () => ({})),
      publishMutation: makeMutation(async () => makeResult()),
      previewPublishMutation: makeMutation(async () => makePlan()),
      autoExportMutation: makeMutation(async () => ({
        restaurantId: 'restaurant-1',
        candidatesConsidered: 0,
        decisionsExecuted: 0,
        publishResult: null,
        skipped: [],
      })),
      retryJobMutation: makeMutation(async () => ({})),
      cancelCandidateMutation: makeMutation(async () => ({})),
      controlMutation: makeMutation(async () => ({
        restaurantId: 'restaurant-1',
        control: makeState().control,
      })),
      operationsQuery: makeQuery({ restaurantId: 'restaurant-1', operations: [] }),
      jobsQuery: makeQuery({ restaurantId: 'restaurant-1', jobs: [] }),
      candidatesQuery: makeQuery({ restaurantId: 'restaurant-1', candidates: [] }),
      metricsQuery: makeQuery(null),
      publishJobsQuery: makeQuery({ restaurantId: 'restaurant-1', jobs: [] }),
      publishJobDetailQuery: makeQuery(null),
    });

    render(<DualSyncShell restaurantId="restaurant-1" sections={['profile']} />);

    expect(screen.getByText('Draft progress')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Import (1)' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Export (1)' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Ignore (1)' })).toBeEnabled();
  });

  it('lazy-loads the pending changes panel when expanded', async () => {
    const user = userEvent.setup();
    mocks.useOpsDualSync.mockReturnValue({
      stateQuery: makeQuery(makeState()),
      refreshMutation: makeMutation(async () => ({})),
      publishMutation: makeMutation(async () => makeResult()),
      previewPublishMutation: makeMutation(async () => makePlan()),
      autoExportMutation: makeMutation(async () => ({
        restaurantId: 'restaurant-1',
        candidatesConsidered: 0,
        decisionsExecuted: 0,
        publishResult: null,
        skipped: [],
      })),
      retryJobMutation: makeMutation(async () => ({})),
      cancelCandidateMutation: makeMutation(async () => ({})),
      controlMutation: makeMutation(async () => ({
        restaurantId: 'restaurant-1',
        control: makeState().control,
      })),
      operationsQuery: makeQuery({ restaurantId: 'restaurant-1', operations: [] }),
      jobsQuery: makeQuery({ restaurantId: 'restaurant-1', jobs: [] }),
      candidatesQuery: makeQuery({ restaurantId: 'restaurant-1', candidates: [] }),
      metricsQuery: makeQuery(null),
      publishJobsQuery: makeQuery({ restaurantId: 'restaurant-1', jobs: [] }),
      publishJobDetailQuery: makeQuery(null),
    });

    render(<DualSyncShell restaurantId="restaurant-1" sections={['profile']} />);

    expect(mocks.useOpsDualSync).toHaveBeenLastCalledWith(
      expect.objectContaining({ candidatesRequest: undefined }),
    );

    await user.click(screen.getByRole('button', { name: 'Load pending changes' }));

    expect(mocks.useOpsDualSync).toHaveBeenLastCalledWith(
      expect.objectContaining({ candidatesRequest: { limit: 50, statuses: ['open'] } }),
    );
    expect(
      screen.getByText('No pending Core changes are waiting for Google export.'),
    ).toBeInTheDocument();
  });
});

import { render, screen, waitFor, within } from '@testing-library/react';
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
  it('uses the frozen exact preview and publish mutations on the shipped workspace', async () => {
    const user = userEvent.setup();
    const hash = 'a'.repeat(64);
    const exactPreview = vi.fn(async () => ({
      confirmationVersion: 'gbp-exact-consent-v1' as const,
      policyVersion: 'gbp-write-policy-v1' as const,
      rendererVersion: 'gbp-renderer-v1' as const,
      listing: {
        restaurantId: 'restaurant-1',
        externalProfileRowId: 'profile-row-1',
        accountId: 'account-1',
        profileId: 'profile-1',
        locationId: 'location-1',
        connectionGeneration: 7,
        consentEpoch: 4,
      },
      snapshotPins: { core: hash, google: hash },
      groups: [
        {
          groupId: 'profile-group',
          writeGroup: 'location.profile',
          direction: 'export_to_google' as const,
          fieldKeys: ['profile.phone'],
          method: 'PATCH' as const,
          resource: 'locations/location-1',
          updateMasks: ['phoneNumbers'],
          beforeDisplay: {
            core: { 'profile.phone': '+44 1223 000000' },
            google: { 'profile.phone': '+44 1223 111111' },
          },
          afterDisplay: {
            core: { 'profile.phone': '+44 1223 000000' },
            google: { 'profile.phone': '+44 1223 000000' },
          },
          beforeHashes: {
            core: { 'profile.phone': hash },
            google: { 'profile.phone': hash },
          },
          afterHashes: {
            core: { 'profile.phone': hash },
            google: { 'profile.phone': hash },
          },
          requestHash: hash,
          decisionHash: hash,
          warnings: ['This updates public contact data.'],
          riskLevel: 'critical' as const,
          fullReplacement: false,
        },
      ],
      planFingerprint: hash,
      issuedAt: '2099-08-09T10:00:00.000Z',
      expiresAt: '2099-08-09T10:15:00.000Z',
    }));
    const exactPublish = vi.fn(async () => ({
      mode: 'immediate' as const,
      bundleId: 'bundle-1',
      grantIds: ['grant-1'],
      outcomes: [
        {
          groupId: 'profile-group',
          status: 'outcome_unknown' as const,
          reasonCode: 'provider_outcome_unknown',
        },
      ],
    }));

    mocks.useOpsDualSync.mockReturnValue({
      stateQuery: makeQuery(makeState()),
      refreshMutation: makeMutation(async () => ({})),
      publishMutation: makeMutation(async () => makeResult()),
      previewPublishMutation: makeMutation(async () => makePlan()),
      exactPreviewPublishMutation: makeMutation(exactPreview),
      exactPublishMutation: makeMutation(exactPublish),
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
    expect(screen.getByText('0 to send · 0 to use from Google · 0 ignored')).toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: 'Send to Google' }));
    expect(screen.getByText('1 to send · 0 to use from Google · 0 ignored')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Review and publish (1)' }));

    expect(await screen.findByText('Confirm exact Google publish')).toBeInTheDocument();
    await user.click(screen.getByLabelText(/public google business profile data/i));
    await user.click(screen.getByRole('button', { name: 'Publish exact plan' }));

    expect(exactPreview).toHaveBeenCalledTimes(1);
    expect(exactPublish).toHaveBeenCalledWith(
      expect.objectContaining({
        confirmationVersion: 'gbp-exact-consent-v1',
        acknowledged: true,
        mode: 'immediate',
      }),
    );
    expect(await screen.findByText('Google publish outcome')).toBeInTheDocument();
    expect(mocks.toast.warning).toHaveBeenCalledWith(
      'Provider outcome unknown. Refresh Google, verify the listing, and create a new preview.',
    );
    expect(mocks.toast.success).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Back to review' }));
    const results = screen.getByRole('region', { name: 'Publish results' });
    expect(within(results).getByText('Outcome unknown')).toBeInTheDocument();
    expect(within(results).getByText('provider_outcome_unknown')).toBeInTheDocument();
    expect(within(results).queryByText('Confirmed by Google')).not.toBeInTheDocument();
    expect(within(results).getByText('Google did not confirm every change')).toBeInTheDocument();
  });

  it('saves Use Google choices in Nabatable only through the non-exact publish path', async () => {
    const user = userEvent.setup();
    const exactPreview = vi.fn();
    const exactPublish = vi.fn();
    const importPlan: DualSyncPublishPlan = {
      ...makePlan(),
      groups: [
        {
          ...makePlan().groups[0]!,
          groupId: 'import_from_google:profile:location.profile',
          direction: 'import_from_google',
          fields: [
            {
              fieldKey: 'profile.phone',
              sectionKey: 'profile',
              action: 'import_from_google',
              pinnedCoreHash: 'core-phone-hash',
              pinnedGbpHash: 'gbp-phone-hash',
            },
          ],
          riskLevel: 'low',
          requiresManualConfirmation: false,
        },
      ],
      warnings: [],
    };
    const previewPublish = vi.fn(async () => importPlan);
    const publish = vi.fn(async () => makeResult());

    mocks.useOpsDualSync.mockReturnValue({
      stateQuery: makeQuery(
        makeState([
          makeField(),
          makeField({
            fieldKey: 'profile.website',
            label: 'Website',
            coreCanonicalHash: 'core-web-hash',
            gbpCanonicalHash: 'gbp-web-hash',
          }),
        ]),
      ),
      refreshMutation: makeMutation(async () => ({})),
      publishMutation: makeMutation(publish),
      previewPublishMutation: makeMutation(previewPublish),
      exactPreviewPublishMutation: makeMutation(exactPreview),
      exactPublishMutation: makeMutation(exactPublish),
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

    const phone = screen.getByRole('group', { name: 'What to do with Phone number' });
    const website = screen.getByRole('group', { name: 'What to do with Website' });
    await user.click(within(phone).getByRole('radio', { name: 'Use Google’s' }));
    await user.click(within(website).getByRole('radio', { name: 'Send to Google' }));

    expect(screen.getByText('1 to send · 1 to use from Google · 0 ignored')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Use 1 Google value' }));

    const dialog = await screen.findByRole('dialog', { name: 'Use values from Google?' });
    expect(previewPublish).toHaveBeenCalledWith(
      expect.objectContaining({
        decisions: [
          {
            fieldKey: 'profile.phone',
            sectionKey: 'profile',
            action: 'import_from_google',
            pinnedCoreHash: 'core-phone-hash',
            pinnedGbpHash: 'gbp-phone-hash',
          },
        ],
      }),
    );
    expect(exactPreview).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole('button', { name: 'Use 1 Google value' }));

    await waitFor(() => {
      expect(publish).toHaveBeenCalledWith(
        expect.objectContaining({
          decisions: [expect.objectContaining({ action: 'import_from_google' })],
        }),
      );
    });
    expect(exactPublish).not.toHaveBeenCalled();
    expect(await screen.findByText('Google values saved in Nabatable')).toBeInTheDocument();
  });

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

    await user.click(screen.getByRole('button', { name: 'Send all to Google (1)' }));
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
    expect(screen.getByRole('button', { name: /get latest from google/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /^review and publish$/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /resume sync/i })).toBeEnabled();
    for (const radio of screen.getAllByRole('radio')) {
      expect(radio).toBeDisabled();
    }
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

    expect(screen.getByText(/0 of 1 chosen/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Use all Google’s (1)' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Send all to Google (1)' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Ignore all (1)' })).toBeEnabled();
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

    render(
      <DualSyncShell
        restaurantId="restaurant-1"
        sections={['profile']}
        renderEvidence={(evidence) => (
          <div data-testid="evidence">
            {evidence.syncControls}
            {evidence.operationalPanels}
          </div>
        )}
      />,
    );

    expect(mocks.useOpsDualSync).toHaveBeenLastCalledWith(
      expect.objectContaining({ candidatesRequest: undefined }),
    );
    const evidence = screen.getByTestId('evidence');
    expect(within(evidence).getByRole('button', { name: 'Pause sync' })).toBeEnabled();
    expect(
      within(evidence).getByRole('button', { name: 'Publish queued changes (0)' }),
    ).toBeDisabled();

    await user.click(within(evidence).getByRole('button', { name: 'Pending changes' }));

    expect(mocks.useOpsDualSync).toHaveBeenLastCalledWith(
      expect.objectContaining({ candidatesRequest: { limit: 50, statuses: ['open'] } }),
    );
    expect(
      screen.getByText('No pending Core changes are waiting for Google export.'),
    ).toBeInTheDocument();
  });
});

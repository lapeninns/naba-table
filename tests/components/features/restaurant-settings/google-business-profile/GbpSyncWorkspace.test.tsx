import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { GbpSyncWorkspace } from '@/components/features/restaurant-settings/google-business-profile/components/GbpSyncWorkspace';
import { HttpError } from '@/lib/http/errors';

import type { GbpOperatorQueries } from '@/components/features/restaurant-settings/google-business-profile/components/GbpOperationsPanel';
import type { GoogleBusinessProfileSectionState } from '@/components/features/restaurant-settings/google-business-profile/useGoogleBusinessProfileSectionState';
import type { DualSyncPublishPlan } from '@/server/dual-sync/publish/types';
import type {
  DualSyncFieldSummary,
  DualSyncPublishResponse,
  GetDualSyncStateResponse,
} from '@/services/ops/dual-sync';
import type { GoogleBusinessProfileConnection } from '@/services/ops/restaurants';

// Seams: the dual-sync data hook, the GBP connection hooks the reconnect action reads, and sonner.
// The shell controller, decision state, review table, decision bar and publish dialogs run for real.
const mocks = vi.hoisted(() => ({
  useOpsDualSync: vi.fn(),
  toast: { error: vi.fn(), info: vi.fn(), success: vi.fn(), warning: vi.fn(), message: vi.fn() },
}));

vi.mock('@/hooks/ops/useOpsDualSync', () => ({ useOpsDualSync: mocks.useOpsDualSync }));
vi.mock('@/hooks/ops/useOpsGoogleBusinessProfile', () => ({
  useOpsGoogleBusinessProfileConnection: () => ({ data: connection(), isFetching: false }),
  useOpsStartGoogleBusinessProfileAuthorization: () => ({ isPending: false, mutate: vi.fn() }),
}));
vi.mock('sonner', () => ({ toast: mocks.toast }));

const SENTINEL = 'SECRET_DB_DETAIL relation "x" does not exist';

function connection(
  overrides: Partial<GoogleBusinessProfileConnection> = {},
): GoogleBusinessProfileConnection {
  return {
    isConfigured: true,
    provider: 'google_business_profile',
    status: 'linked',
    pushEnabled: true,
    connectedGoogleEmail: 'ops@example.test',
    connectedGoogleName: 'Ops Test',
    externalAccountId: 'account-1',
    externalAccountName: 'accounts/1',
    externalLocationId: 'location-1',
    externalLocationName: 'locations/1',
    externalLocationTitle: 'QA GBP Restaurant',
    externalPlaceId: 'places/1',
    providerTimezone: 'Europe/London',
    lastPullAt: null,
    lastPushAt: null,
    lastError: null,
    availableLocations: [],
    businessInfo: {} as GoogleBusinessProfileConnection['businessInfo'],
    ...overrides,
  };
}

function section(
  overrides: Partial<GoogleBusinessProfileConnection> = {},
): GoogleBusinessProfileSectionState {
  return {
    data: connection(overrides),
    linkedLocation: { business: 'QA GBP Restaurant', account: 'Ops', address: '1 QA Street' },
    summary: {
      accountLabel: 'ops@example.test',
      manageOnGoogleHref: 'https://maps.example/qa',
      canDisconnect: true,
      status: overrides.status ?? 'linked',
    },
    handleRequestDisconnect: vi.fn(),
    disconnectMutation: { isPending: false },
  } as unknown as GoogleBusinessProfileSectionState;
}

function field(over: Partial<DualSyncFieldSummary> = {}): DualSyncFieldSummary {
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

function state(
  fields: ReadonlyArray<DualSyncFieldSummary> = [field()],
  control: Partial<GetDualSyncStateResponse['control']> = {},
): GetDualSyncStateResponse {
  return {
    restaurantId: 'restaurant-1',
    coreSnapshot: {} as GetDualSyncStateResponse['coreSnapshot'],
    gbpSnapshot: {} as GetDualSyncStateResponse['gbpSnapshot'],
    coreSnapshotHash: 'state-core-hash',
    gbpSnapshotHash: 'state-gbp-hash',
    fields,
    outboundQueue: { totalOpen: 0, autoExportable: 0, missingBaseline: 0, lastQueuedAt: null },
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
      ...control,
    },
  };
}

function plan(direction: 'export_to_google' | 'import_from_google'): DualSyncPublishPlan {
  return {
    restaurantId: 'restaurant-1',
    coreSnapshotHash: 'plan-core-hash',
    gbpSnapshotHash: 'plan-gbp-hash',
    acceptedCount: 1,
    rejectedCount: 0,
    ignoredCount: 0,
    groups: [
      {
        groupId: `${direction}:profile:location.profile`,
        direction,
        sectionKey: 'profile',
        writeGroup: 'location.profile',
        fields: [
          {
            fieldKey: 'profile.phone',
            sectionKey: 'profile',
            action: direction,
            pinnedCoreHash: 'core-phone-hash',
            pinnedGbpHash: 'gbp-phone-hash',
          },
        ],
        riskLevel: direction === 'export_to_google' ? 'critical' : 'low',
        requiresPreflight: true,
        requiresManualConfirmation: direction === 'export_to_google',
        destructiveWritePossible: false,
        googleUpdateMasks: ['phoneNumbers'],
      },
    ],
    rejected: [],
    warnings: [],
  };
}

function publishResult(): DualSyncPublishResponse {
  return {
    publishJobId: 'publish-job-1',
    restaurantId: 'restaurant-1',
    totalDecisions: 1,
    succeededCount: 1,
    failedCount: 0,
    skippedCount: 0,
    operations: [],
    failures: [],
  } as DualSyncPublishResponse;
}

function query<T>(data: T, extra: Record<string, unknown> = {}) {
  return {
    data,
    error: null,
    isError: false,
    isFetching: false,
    isLoading: false,
    isPending: false,
    refetch: vi.fn(),
    ...extra,
  };
}

function mutation<TInput, TOutput>(mutateAsync: (input: TInput) => Promise<TOutput>) {
  return { error: null, isError: false, isPending: false, mutateAsync, mutate: vi.fn() };
}

function dualSync(overrides: Record<string, unknown> = {}) {
  return {
    stateQuery: query(state()),
    refreshMutation: mutation(async () => ({})),
    publishMutation: mutation(async () => publishResult()),
    previewPublishMutation: mutation(async () => plan('export_to_google')),
    autoExportMutation: mutation(async () => ({})),
    retryJobMutation: mutation(async () => ({})),
    cancelCandidateMutation: mutation(async () => ({})),
    controlMutation: mutation(async () => ({})),
    operationsQuery: query({ restaurantId: 'restaurant-1', operations: [] }),
    jobsQuery: query({ restaurantId: 'restaurant-1', jobs: [] }),
    candidatesQuery: query({ restaurantId: 'restaurant-1', candidates: [] }),
    metricsQuery: query(null),
    publishJobsQuery: query({ restaurantId: 'restaurant-1', jobs: [] }),
    publishJobDetailQuery: query(null),
    ...overrides,
  };
}

function exactPreviewResponse() {
  const hash = 'a'.repeat(64);
  return {
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
        beforeHashes: { core: { 'profile.phone': hash }, google: { 'profile.phone': hash } },
        afterHashes: { core: { 'profile.phone': hash }, google: { 'profile.phone': hash } },
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
  };
}

function operator(writeState: 'eligible' | 'blocked' = 'eligible'): GbpOperatorQueries {
  return {
    connectionQuery: query({
      version: 'v1',
      restaurantId: 'restaurant-1',
      provider: 'google_business_profile',
      connectionStatus: 'linked',
      writeState,
      connectionGeneration: 7,
      consentEpoch: 4,
      reasonCode: writeState === 'eligible' ? null : 'writes_turned_off',
      rollout: { eligible: true, cohort: 'canary', evaluatedAt: '2026-09-26T12:00:00.000Z' },
      pendingUpdates: { version: 'v1', restaurantId: 'restaurant-1', state: 'none' },
      notifications: { enabled: true, refCount: 2 },
      refresh: {
        status: 'succeeded',
        lastAttemptAt: null,
        lastSucceededAt: '2026-09-26T12:00:00.000Z',
        safeErrorCode: null,
      },
    }),
    terminalNoticesQuery: query({
      notices: [],
      census: {},
      asOf: '2026-09-26T12:00:00.000Z',
    }),
    setWriteAccessMutation: mutation(async () => ({})),
    setNotificationParticipationMutation: mutation(async () => ({})),
  } as unknown as GbpOperatorQueries;
}

function renderWorkspace(options: { operator?: GbpOperatorQueries | null } = {}) {
  return render(
    <GbpSyncWorkspace
      restaurantId="restaurant-1"
      section={section()}
      operator={options.operator ?? null}
    />,
  );
}

function decisionBar() {
  return screen.getByRole('region', { name: 'Publish decisions' });
}

beforeEach(() => {
  mocks.useOpsDualSync.mockReset();
  Object.values(mocks.toast).forEach((fn) => fn.mockReset());
});

describe('GbpSyncWorkspace', () => {
  it('@contract publishes Send to Google choices through the exact plan and never shows an unknown outcome as success', async () => {
    const user = userEvent.setup();
    const exactPreview = vi.fn(async () => exactPreviewResponse());
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
    mocks.useOpsDualSync.mockReturnValue(
      dualSync({
        exactPreviewPublishMutation: mutation(exactPreview),
        exactPublishMutation: mutation(exactPublish),
      }),
    );

    renderWorkspace();
    expect(decisionBar()).toHaveTextContent(
      '0 to send to Google · 0 to use from Google · 0 ignored',
    );
    const phone = screen.getByRole('group', { name: 'What to do with Phone number' });
    await user.click(within(phone).getByRole('radio', { name: 'Send to Google' }));
    expect(decisionBar()).toHaveTextContent(
      '1 to send to Google · 0 to use from Google · 0 ignored',
    );
    await user.click(within(decisionBar()).getByRole('button', { name: 'Review exact plan (1)' }));

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
    expect(mocks.toast.success).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Back to review' }));
    const alert = screen.getByTestId('gbp-alert-last-publish');
    expect(alert).toHaveTextContent('Outcome unknown for part of the last publish');
    expect(alert).not.toHaveTextContent('Google confirmed');
  });

  it('@contract saves Use Google’s choices in Nabatable only, never through the exact Google path', async () => {
    const user = userEvent.setup();
    const exactPreview = vi.fn();
    const exactPublish = vi.fn();
    const previewPublish = vi.fn(async () => plan('import_from_google'));
    const publish = vi.fn(async () => publishResult());
    mocks.useOpsDualSync.mockReturnValue(
      dualSync({
        stateQuery: query(
          state([
            field(),
            field({
              fieldKey: 'profile.website',
              label: 'Website',
              coreCanonicalHash: 'core-web-hash',
              gbpCanonicalHash: 'gbp-web-hash',
            }),
          ]),
        ),
        publishMutation: mutation(publish),
        previewPublishMutation: mutation(previewPublish),
        exactPreviewPublishMutation: mutation(exactPreview),
        exactPublishMutation: mutation(exactPublish),
      }),
    );

    renderWorkspace();
    const phone = screen.getByRole('group', { name: 'What to do with Phone number' });
    const website = screen.getByRole('group', { name: 'What to do with Website' });
    await user.click(within(phone).getByRole('radio', { name: 'Use Google’s' }));
    await user.click(within(website).getByRole('radio', { name: 'Send to Google' }));

    expect(decisionBar()).toHaveTextContent(
      '1 to send to Google · 1 to use from Google · 0 ignored',
    );
    await user.click(
      within(decisionBar()).getByRole('button', { name: 'Save 1 Google value in Nabatable' }),
    );

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
    await user.click(within(dialog).getByRole('button', { name: 'Use 1 Google value' }));

    await waitFor(() =>
      expect(publish).toHaveBeenCalledWith(
        expect.objectContaining({
          decisions: [expect.objectContaining({ action: 'import_from_google' })],
        }),
      ),
    );
    expect(exactPreview).not.toHaveBeenCalled();
    expect(exactPublish).not.toHaveBeenCalled();
  });

  it('@contract previews through the legacy plan when exact publishing is unavailable', async () => {
    const user = userEvent.setup();
    const previewPublish = vi.fn(async () => plan('export_to_google'));
    mocks.useOpsDualSync.mockReturnValue(
      dualSync({ previewPublishMutation: mutation(previewPublish) }),
    );

    renderWorkspace();
    await user.click(
      within(screen.getByRole('group', { name: 'What to do with Phone number' })).getByRole(
        'radio',
        { name: 'Send to Google' },
      ),
    );
    await user.click(within(decisionBar()).getByRole('button', { name: 'Review exact plan (1)' }));

    expect(await screen.findByText('Review publish plan')).toBeInTheDocument();
    expect(previewPublish).toHaveBeenCalledWith(
      expect.objectContaining({
        pinnedCoreSnapshotHash: 'state-core-hash',
        pinnedGbpSnapshotHash: 'state-gbp-hash',
        decisions: [expect.objectContaining({ action: 'export_to_google' })],
      }),
    );
  });

  it('@contract locks choices and publishing while sync is paused, and offers to resume', () => {
    mocks.useOpsDualSync.mockReturnValue(
      dualSync({
        stateQuery: query(
          state([field()], {
            syncPaused: true,
            pauseReason: 'Maintenance window.',
            pausedAt: '2026-05-09T10:00:00.000Z',
          }),
        ),
      }),
    );

    renderWorkspace();

    const paused = screen.getByTestId('gbp-alert-paused');
    expect(paused).toHaveTextContent('Maintenance window.');
    expect(within(paused).getByRole('button', { name: 'Resume sync' })).toBeEnabled();
    expect(screen.getAllByRole('button', { name: /get latest from google/i })[0]).toBeDisabled();
    expect(
      within(decisionBar()).getByRole('button', { name: /review exact plan/i }),
    ).toBeDisabled();
    expect(decisionBar()).toHaveTextContent('Sync is paused.');
    for (const radio of screen.getAllByRole('radio')) expect(radio).toBeDisabled();
  });

  it('@contract disables Send to Google, with the reason, when Google writes are off', () => {
    mocks.useOpsDualSync.mockReturnValue(dualSync());

    renderWorkspace({ operator: operator('blocked') });

    const phone = screen.getByRole('group', { name: 'What to do with Phone number' });
    expect(within(phone).getByRole('radio', { name: 'Send to Google' })).toBeDisabled();
    expect(within(phone).getByRole('radio', { name: 'Use Google’s' })).toBeEnabled();
    expect(decisionBar()).toHaveTextContent(
      'Google writes are off. Turn them on under Operations.',
    );
    expect(screen.getByText('Google writes')).toBeInTheDocument();
  });

  it('offers section bulk choices only for fields that need a choice', async () => {
    const user = userEvent.setup();
    mocks.useOpsDualSync.mockReturnValue(
      dualSync({
        stateQuery: query(
          state([
            field({ fieldKey: 'profile.phone', state: 'core_dirty' }),
            field({ fieldKey: 'profile.website', label: 'Website', state: 'in_sync' }),
            field({ fieldKey: 'profile.email', label: 'Email', state: 'gbp_dirty' }),
          ]),
        ),
      }),
    );

    renderWorkspace();
    expect(screen.getByText('2 of 3 differ')).toBeInTheDocument();
    await user.click(screen.getByRole('combobox', { name: 'Set every difference in Profile' }));

    expect(
      await screen.findByRole('option', { name: 'Send all to Google (2)' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Use all of Google’s (2)' })).toBeInTheDocument();
    await user.click(screen.getByRole('option', { name: 'Ignore all (2)' }));

    expect(decisionBar()).toHaveTextContent(
      '0 to send to Google · 0 to use from Google · 2 ignored',
    );
  });

  it('lazy-loads diagnostics from the Operations tab', async () => {
    const user = userEvent.setup();
    mocks.useOpsDualSync.mockReturnValue(dualSync());

    renderWorkspace();
    expect(mocks.useOpsDualSync).toHaveBeenLastCalledWith(
      expect.objectContaining({ candidatesRequest: undefined }),
    );

    await user.click(screen.getByRole('tab', { name: /operations/i }));
    expect(screen.getByRole('button', { name: 'Pause sync' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Publish queued changes (0)' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Pending changes' }));

    expect(mocks.useOpsDualSync).toHaveBeenLastCalledWith(
      expect.objectContaining({ candidatesRequest: { limit: 50, statuses: ['open'] } }),
    );
  });

  it('@contract shows fixed copy, never the server message, when the comparison fails to load', () => {
    mocks.useOpsDualSync.mockReturnValue(
      dualSync({
        stateQuery: query(undefined, {
          isError: true,
          error: new HttpError({ status: 500, message: SENTINEL }),
        }),
      }),
    );

    renderWorkspace();

    expect(
      screen.getByText(/The differences could not be loaded\. Reason code: HTTP_500\./),
    ).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('SECRET_DB_DETAIL');
  });
});

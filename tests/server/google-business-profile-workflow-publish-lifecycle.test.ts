import { beforeEach, describe, expect, it, vi } from 'vitest';

const getGoogleBusinessProfileWorkflowStateMock = vi.hoisted(() => vi.fn());
const buildPublishPreflightContextMock = vi.hoisted(() => vi.fn());
const readCoreSnapshotsMock = vi.hoisted(() => vi.fn());
const readPublishJobByIdMock = vi.hoisted(() => vi.fn());
const upsertPublishJobFromPreflightMock = vi.hoisted(() => vi.fn());
const claimPublishJobForPublishingMock = vi.hoisted(() => vi.fn());
const claimPublishJobForGoogleRetryMock = vi.hoisted(() => vi.fn());
const readDraftByIdMock = vi.hoisted(() => vi.fn());
const findExternalProfileMock = vi.hoisted(() => vi.fn());
const publishDraftToNabatableMock = vi.hoisted(() => vi.fn());
const pushDraftToGoogleMock = vi.hoisted(() => vi.fn());
const restoreCoreSnapshotAfterFailedPublishMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/google-business-profile/workflowDraftLifecycle', () => ({
  getGoogleBusinessProfileWorkflowState: getGoogleBusinessProfileWorkflowStateMock,
}));

vi.mock('@/server/google-business-profile/workflowPreflightContext', () => ({
  buildPublishPreflightContext: buildPublishPreflightContextMock,
  readCoreSnapshots: readCoreSnapshotsMock,
}));

vi.mock('@/server/google-business-profile/workflowRepository', () => ({
  GOOGLE_BUSINESS_PROFILE_PROVIDER: 'google_business_profile',
  readPublishJobById: readPublishJobByIdMock,
  upsertPublishJobFromPreflight: upsertPublishJobFromPreflightMock,
  claimPublishJobForPublishing: claimPublishJobForPublishingMock,
  claimPublishJobForGoogleRetry: claimPublishJobForGoogleRetryMock,
  readDraftById: readDraftByIdMock,
  findExternalProfile: findExternalProfileMock,
}));

vi.mock('@/server/google-business-profile/workflowPublishExecution', () => ({
  publishDraftToNabatable: publishDraftToNabatableMock,
  pushDraftToGoogle: pushDraftToGoogleMock,
  restoreCoreSnapshotAfterFailedPublish: restoreCoreSnapshotAfterFailedPublishMock,
}));

import {
  publishGoogleBusinessProfileWorkflowDraftState,
  retryGoogleBusinessProfileWorkflowGooglePushState,
} from '@/server/google-business-profile/workflowPublishLifecycle';
import { buildCoreSnapshotHashes } from '@/server/google-business-profile/workflowMappers';

import type { GoogleBusinessProfileWorkflowResponse } from '@/server/google-business-profile/workflow';
import type { PublishJobRow } from '@/server/google-business-profile/workflowRepository';

function buildWorkflowResponse(): GoogleBusinessProfileWorkflowResponse {
  return {
    latestDraft: null,
    sectionSummaries: [],
    publishableSections: [],
    blockedReasons: [],
    auditEvents: [],
    activePublishJob: null,
  };
}

function buildPublishJob(overrides: Partial<PublishJobRow> = {}): PublishJobRow {
  return {
    id: 'job-1',
    restaurant_id: 'rest-1',
    draft_id: 'draft-1',
    external_profile_id: 'profile-1',
    provider: 'google_business_profile',
    idempotency_key: 'idem-1',
    mode: 'nabatable_and_google',
    direction_intent: 'push_to_google',
    status: 'preflight_ready',
    selected_approvals: {},
    nabatable_sections: [],
    google_update_masks: [],
    post_nabatable_core_hashes: {},
    error_classification: null,
    errors: [],
    nabatable_publish_event_id: null,
    google_publish_event_id: null,
    nabatable_published_at: null,
    google_pushed_at: null,
    published_by_user_id: null,
    google_retry_by_user_id: null,
    retried_at: null,
    failed_at: null,
    created_at: '2026-05-21T20:00:00.000Z',
    updated_at: '2026-05-21T20:00:00.000Z',
    ...overrides,
  } as PublishJobRow;
}

function buildDraftRow() {
  return {
    id: 'draft-1',
    status: 'partially_published',
    fetched_at: '2026-05-21T20:00:00.000Z',
    approved_at: null,
    published_at: null,
    stale_sections: [],
    conflict_metadata: {},
    selected_approvals: {},
    source_snapshot_refs: {},
    core_snapshot_hashes: {},
    section_diffs: [],
    created_at: '2026-05-21T20:00:00.000Z',
    updated_at: '2026-05-21T20:00:00.000Z',
  };
}

function buildCoreSnapshot(name = 'Reviewed') {
  return {
    profile: {
      name,
      contactPhone: '+441234567890',
      address: '1 Test Street',
      googleMapUrl: null,
      googleReviewUrl: null,
    },
    operatingHours: { weekly: [], overrides: [] },
    servicePeriods: [],
    businessContext: {
      core: { categories: [], serviceAreas: [], attributes: [], serviceItems: [] },
    },
  };
}

function clientWithUpdateResults(results: Array<{ error: unknown }>) {
  const updates: unknown[] = [];
  const from = vi.fn(() => ({
    update: vi.fn((payload: unknown) => {
      updates.push(payload);
      const result = results.shift() ?? { error: null };
      return {
        eq: vi.fn(async () => result),
      };
    }),
  }));
  return { client: { from }, updates };
}

describe('google business profile workflow publish lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getGoogleBusinessProfileWorkflowStateMock.mockResolvedValue(buildWorkflowResponse());
    buildPublishPreflightContextMock.mockResolvedValue({
      idempotencyKey: 'idem-1',
      selectedApprovals: {},
      decisions: [],
    });
  });

  it('returns a published job idempotently without re-running side effects', async () => {
    readPublishJobByIdMock.mockResolvedValue(
      buildPublishJob({
        status: 'published',
        nabatable_publish_event_id: 'nab-event-1',
        google_publish_event_id: 'google-event-1',
      }),
    );

    const result = await publishGoogleBusinessProfileWorkflowDraftState({
      restaurantId: 'rest-1',
      draftId: 'draft-1',
      actorUserId: 'user-1',
      publishJobId: 'job-1',
      idempotencyKey: 'idem-1',
      client: {} as never,
    });

    expect(result).toEqual({
      ...buildWorkflowResponse(),
      result: 'published',
      nabatableEventId: 'nab-event-1',
      googleEventId: 'google-event-1',
    });
    expect(buildPublishPreflightContextMock).toHaveBeenCalledWith(
      expect.objectContaining({
        restaurantId: 'rest-1',
        draftId: 'draft-1',
        actorUserId: 'user-1',
      }),
    );
    expect(upsertPublishJobFromPreflightMock).not.toHaveBeenCalled();
    expect(claimPublishJobForPublishingMock).not.toHaveBeenCalled();
    expect(publishDraftToNabatableMock).not.toHaveBeenCalled();
    expect(pushDraftToGoogleMock).not.toHaveBeenCalled();
  });

  it('rejects publish confirmations with a stale idempotency key before rebuilding preflight', async () => {
    readPublishJobByIdMock.mockResolvedValue(
      buildPublishJob({
        idempotency_key: 'current-idem',
      }),
    );

    await expect(
      publishGoogleBusinessProfileWorkflowDraftState({
        restaurantId: 'rest-1',
        draftId: 'draft-1',
        actorUserId: 'user-1',
        publishJobId: 'job-1',
        idempotencyKey: 'old-idem',
        client: {} as never,
      }),
    ).rejects.toMatchObject({ name: 'GBP_PUBLISH_JOB_MISMATCH' });

    expect(buildPublishPreflightContextMock).not.toHaveBeenCalled();
    expect(claimPublishJobForPublishingMock).not.toHaveBeenCalled();
  });

  it('rejects Google retry before loading drafts when the job is not retryable', async () => {
    readPublishJobByIdMock.mockResolvedValue(
      buildPublishJob({
        status: 'published',
        google_update_masks: ['title'],
      }),
    );

    await expect(
      retryGoogleBusinessProfileWorkflowGooglePushState({
        restaurantId: 'rest-1',
        draftId: 'draft-1',
        publishJobId: 'job-1',
        actorUserId: 'user-1',
        client: {} as never,
      }),
    ).rejects.toMatchObject({ name: 'GBP_PUBLISH_JOB_INVALID_STATE' });

    expect(readDraftByIdMock).not.toHaveBeenCalled();
    expect(claimPublishJobForGoogleRetryMock).not.toHaveBeenCalled();
    expect(pushDraftToGoogleMock).not.toHaveBeenCalled();
  });

  it('rejects Google retry for reconciliation-only failures before claiming the job', async () => {
    readPublishJobByIdMock.mockResolvedValue(
      buildPublishJob({
        status: 'google_failed',
        google_update_masks: ['title'],
        errors: [
          {
            message: 'Google push succeeded but local persistence failed.',
            retryable: false,
            reconciliationRequired: true,
          },
        ],
      }),
    );

    await expect(
      retryGoogleBusinessProfileWorkflowGooglePushState({
        restaurantId: 'rest-1',
        draftId: 'draft-1',
        publishJobId: 'job-1',
        actorUserId: 'user-1',
        client: {} as never,
      }),
    ).rejects.toMatchObject({ name: 'GBP_PUBLISH_JOB_INVALID_STATE' });

    expect(readDraftByIdMock).not.toHaveBeenCalled();
    expect(claimPublishJobForGoogleRetryMock).not.toHaveBeenCalled();
    expect(pushDraftToGoogleMock).not.toHaveBeenCalled();
  });

  it('does not mark Google retry as retryable when local status persistence fails after push', async () => {
    readPublishJobByIdMock.mockResolvedValue(
      buildPublishJob({
        status: 'google_failed',
        google_update_masks: ['title'],
      }),
    );
    readDraftByIdMock.mockResolvedValue(buildDraftRow());
    readCoreSnapshotsMock.mockResolvedValue({
      profile: {},
      operatingHours: { weekly: [], overrides: [] },
      servicePeriods: [],
      businessContext: {
        core: { categories: [], serviceAreas: [], attributes: [], serviceItems: [] },
      },
    });
    findExternalProfileMock.mockResolvedValue({ push_enabled: true });
    claimPublishJobForGoogleRetryMock.mockResolvedValue(
      buildPublishJob({
        status: 'publishing',
        google_update_masks: ['title'],
      }),
    );
    pushDraftToGoogleMock.mockResolvedValue('google-event-1');
    const { client, updates } = clientWithUpdateResults([
      { error: new Error('job update failed') },
      { error: null },
    ]);

    await expect(
      retryGoogleBusinessProfileWorkflowGooglePushState({
        restaurantId: 'rest-1',
        draftId: 'draft-1',
        publishJobId: 'job-1',
        actorUserId: 'user-1',
        client: client as never,
      }),
    ).rejects.toThrow('job update failed');

    expect(updates[1]).toMatchObject({
      status: 'failed',
      google_publish_event_id: 'google-event-1',
      error_classification: null,
      errors: [
        expect.objectContaining({
          retryable: false,
          reconciliationRequired: true,
        }),
      ],
    });
  });

  it('rechecks approved core hashes after claiming a Google retry and before pushing', async () => {
    const reviewedCore = buildCoreSnapshot('Reviewed');
    const editedCore = buildCoreSnapshot('Edited after retry check');
    readPublishJobByIdMock.mockResolvedValue(
      buildPublishJob({
        status: 'google_failed',
        google_update_masks: ['title'],
        selected_approvals: { 'profile.name': true },
        post_nabatable_core_hashes: buildCoreSnapshotHashes(reviewedCore as never),
      }),
    );
    readDraftByIdMock.mockResolvedValue({
      ...buildDraftRow(),
      selected_approvals: { 'profile.name': true },
      section_diffs: [
        {
          sectionKey: 'profile',
          items: [
            {
              sectionKey: 'profile',
              fieldKey: 'profile.name',
              label: 'Name',
              status: 'ready',
              selected: true,
              nabatableValueHash: 'reviewed-nabatable',
              googleValueHash: 'reviewed-google',
              capabilities: {
                canImportFromGoogle: true,
                canExportToGoogle: true,
                canIgnore: true,
              },
              canPublishToNabatable: true,
              canPushToGoogle: true,
              currentValue: 'Reviewed',
              providerValue: 'Google',
            },
          ],
        },
      ],
    });
    readCoreSnapshotsMock
      .mockResolvedValueOnce(reviewedCore)
      .mockResolvedValueOnce(reviewedCore)
      .mockResolvedValueOnce(editedCore);
    findExternalProfileMock.mockResolvedValue({ push_enabled: true });
    claimPublishJobForGoogleRetryMock.mockResolvedValue(
      buildPublishJob({
        status: 'publishing',
        google_update_masks: ['title'],
      }),
    );
    const { client, updates } = clientWithUpdateResults([{ error: null }]);

    await expect(
      retryGoogleBusinessProfileWorkflowGooglePushState({
        restaurantId: 'rest-1',
        draftId: 'draft-1',
        publishJobId: 'job-1',
        actorUserId: 'user-1',
        client: client as never,
      }),
    ).rejects.toMatchObject({ name: 'GBP_PUBLISH_JOB_CORE_CHANGED' });

    expect(pushDraftToGoogleMock).not.toHaveBeenCalled();
    expect(updates[0]).toMatchObject({
      status: 'google_failed',
      error_classification: null,
      errors: [
        expect.objectContaining({
          retryable: false,
          reconciliationRequired: true,
        }),
      ],
    });
  });
});

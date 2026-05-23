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
});

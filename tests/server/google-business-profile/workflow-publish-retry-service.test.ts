import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const readPublishJobByIdMock = vi.hoisted(() => vi.fn());
const readDraftByIdMock = vi.hoisted(() => vi.fn());
const findExternalProfileMock = vi.hoisted(() => vi.fn());
const claimPublishJobForGoogleRetryMock = vi.hoisted(() => vi.fn());
const readCoreSnapshotsMock = vi.hoisted(() => vi.fn());
const buildCoreSnapshotHashesMock = vi.hoisted(() => vi.fn());
const mapDraftMock = vi.hoisted(() => vi.fn());
const pushDraftToGoogleMock = vi.hoisted(() => vi.fn());
const getWorkflowStateMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/google-business-profile/workflowRepository', () => ({
  claimPublishJobForGoogleRetry: claimPublishJobForGoogleRetryMock,
  findExternalProfile: findExternalProfileMock,
  readDraftById: readDraftByIdMock,
  readPublishJobById: readPublishJobByIdMock,
}));

vi.mock('@/server/google-business-profile/workflowPreflightContext', () => ({
  readCoreSnapshots: readCoreSnapshotsMock,
}));

vi.mock('@/server/google-business-profile/workflowMappers', () => ({
  buildCoreSnapshotHashes: buildCoreSnapshotHashesMock,
  mapDraft: mapDraftMock,
}));

vi.mock('@/server/google-business-profile/workflowPublishExecution', () => ({
  pushDraftToGoogle: pushDraftToGoogleMock,
}));

vi.mock('@/server/google-business-profile/workflowDraftLifecycle', () => ({
  getGoogleBusinessProfileWorkflowState: getWorkflowStateMock,
}));

import { retryGoogleBusinessProfileWorkflowGooglePushState } from '@/server/google-business-profile/workflowPublishRetryService';

const FIXED_NOW = '2026-07-11T12:00:00.000Z';

const coreSnapshots = { profile: { name: 'Old Crown' } };
const mappedDraft = { id: 'draft-1', sectionDiffs: [], coreSnapshotHashes: {}, decisions: [] };
const workflowState = { connection: { status: 'linked' }, draft: null };

type UpdateCall = { table: string; payload: Record<string, unknown> };

function createDbClient(updateErrors: Record<string, unknown[]> = {}) {
  const updates: UpdateCall[] = [];
  const client = {
    from: vi.fn((table: string) => ({
      update: (payload: Record<string, unknown>) => ({
        eq: async () => {
          updates.push({ table, payload });
          const queue = updateErrors[table];
          return { error: queue && queue.length > 0 ? queue.shift() : null };
        },
      }),
    })),
  } as never;
  return { client, updates };
}

function publishJob(overrides: Record<string, unknown> = {}) {
  return {
    id: 'job-1',
    mode: 'nabatable_and_google',
    status: 'google_failed',
    google_update_masks: ['title', 'title', 'not-a-real-mask'],
    errors: [],
    selected_approvals: { 'profile:name': true },
    post_nabatable_core_hashes: { profile: 'hash-profile-v1' },
    nabatable_sections: ['profile'],
    google_publish_event_id: 'evt-prev',
    ...overrides,
  };
}

function retry(client: unknown) {
  return retryGoogleBusinessProfileWorkflowGooglePushState({
    restaurantId: 'rest-1',
    draftId: 'draft-1',
    publishJobId: 'job-1',
    actorUserId: 'user-1',
    client: client as never,
  });
}

function jobUpdates(updates: UpdateCall[]) {
  return updates.filter((call) => call.table === 'restaurant_external_profile_publish_jobs');
}

function draftUpdates(updates: UpdateCall[]) {
  return updates.filter((call) => call.table === 'restaurant_external_profile_drafts');
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(FIXED_NOW));
  for (const mock of [
    readPublishJobByIdMock,
    readDraftByIdMock,
    findExternalProfileMock,
    claimPublishJobForGoogleRetryMock,
    readCoreSnapshotsMock,
    buildCoreSnapshotHashesMock,
    mapDraftMock,
    pushDraftToGoogleMock,
    getWorkflowStateMock,
  ]) {
    mock.mockReset();
  }
  readPublishJobByIdMock.mockResolvedValue(publishJob());
  readDraftByIdMock.mockResolvedValue({ id: 'draft-1', status: 'publishing' });
  findExternalProfileMock.mockResolvedValue({ id: 'profile-1', push_enabled: true });
  claimPublishJobForGoogleRetryMock.mockResolvedValue(publishJob({ status: 'publishing' }));
  readCoreSnapshotsMock.mockResolvedValue(coreSnapshots);
  buildCoreSnapshotHashesMock.mockReturnValue({ profile: 'hash-profile-v1' });
  mapDraftMock.mockReturnValue(mappedDraft);
  pushDraftToGoogleMock.mockResolvedValue('google-event-1');
  getWorkflowStateMock.mockResolvedValue(workflowState);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('retryGoogleBusinessProfileWorkflowGooglePushState', () => {
  it('rejects retries for unknown publish jobs before touching anything @contract', async () => {
    const { client, updates } = createDbClient();
    readPublishJobByIdMock.mockResolvedValue(null);

    await expect(retry(client)).rejects.toMatchObject({ name: 'GBP_PUBLISH_JOB_NOT_FOUND' });

    expect(readPublishJobByIdMock).toHaveBeenCalledWith({
      restaurantId: 'rest-1',
      draftId: 'draft-1',
      publishJobId: 'job-1',
      client,
    });
    expect(claimPublishJobForGoogleRetryMock).not.toHaveBeenCalled();
    expect(pushDraftToGoogleMock).not.toHaveBeenCalled();
    expect(updates).toEqual([]);
  });

  it('rejects retries for nabatable-only jobs @contract', async () => {
    const { client } = createDbClient();
    readPublishJobByIdMock.mockResolvedValue(publishJob({ mode: 'nabatable_only' }));

    await expect(retry(client)).rejects.toMatchObject({ name: 'GBP_PUBLISH_JOB_INVALID_STATE' });
    expect(claimPublishJobForGoogleRetryMock).not.toHaveBeenCalled();
  });

  it('rejects retries when no valid Google update masks survive normalization @contract', async () => {
    const { client } = createDbClient();
    readPublishJobByIdMock.mockResolvedValue(
      publishJob({ google_update_masks: ['not-a-real-mask'] }),
    );

    await expect(retry(client)).rejects.toMatchObject({ name: 'GBP_PUBLISH_JOB_INVALID_STATE' });
  });

  it('rejects retries for jobs outside the retryable statuses @contract', async () => {
    const { client } = createDbClient();
    readPublishJobByIdMock.mockResolvedValue(publishJob({ status: 'published' }));

    await expect(retry(client)).rejects.toMatchObject({ name: 'GBP_PUBLISH_JOB_INVALID_STATE' });
  });

  it('gives up permanently when prior errors carry non-retryable evidence @contract', async () => {
    const { client } = createDbClient();
    readPublishJobByIdMock.mockResolvedValue(
      publishJob({ errors: [{ message: 'validation failed', retryable: false }] }),
    );
    await expect(retry(client)).rejects.toMatchObject({ name: 'GBP_PUBLISH_JOB_INVALID_STATE' });

    readPublishJobByIdMock.mockResolvedValue(
      publishJob({ errors: [{ message: 'drifted', reconciliationRequired: true }] }),
    );
    await expect(retry(client)).rejects.toMatchObject({ name: 'GBP_PUBLISH_JOB_INVALID_STATE' });

    expect(claimPublishJobForGoogleRetryMock).not.toHaveBeenCalled();
    expect(pushDraftToGoogleMock).not.toHaveBeenCalled();
  });

  it('fails when the backing draft row is missing @contract', async () => {
    const { client } = createDbClient();
    readDraftByIdMock.mockResolvedValue(null);

    await expect(retry(client)).rejects.toThrow('Google Business Profile review was not found.');
    expect(claimPublishJobForGoogleRetryMock).not.toHaveBeenCalled();
  });

  it('blocks the retry when Nabatable core data changed after the publish @contract', async () => {
    const { client, updates } = createDbClient();
    buildCoreSnapshotHashesMock.mockReturnValue({ profile: 'hash-profile-v2' });

    const error = await retry(client).then(
      () => {
        throw new Error('expected retry to reject');
      },
      (caught: unknown) => caught as Error,
    );

    expect(error.name).toBe('GBP_PUBLISH_JOB_CORE_CHANGED');
    expect(error.message).toContain('profile');
    expect(claimPublishJobForGoogleRetryMock).not.toHaveBeenCalled();
    expect(pushDraftToGoogleMock).not.toHaveBeenCalled();
    expect(updates).toEqual([]);
  });

  it('refuses to push when Google writes are disabled for the linked profile @contract @security', async () => {
    const { client } = createDbClient();
    findExternalProfileMock.mockResolvedValue({ id: 'profile-1', push_enabled: false });

    await expect(retry(client)).rejects.toMatchObject({ name: 'GBP_GOOGLE_PUSH_DISABLED' });
    expect(claimPublishJobForGoogleRetryMock).not.toHaveBeenCalled();
  });

  it('records a reconciliation-required failure when core changes land between check and claim @contract', async () => {
    const { client, updates } = createDbClient();
    buildCoreSnapshotHashesMock
      .mockReturnValueOnce({ profile: 'hash-profile-v1' })
      .mockReturnValueOnce({ profile: 'hash-profile-v2' });

    await expect(retry(client)).rejects.toMatchObject({ name: 'GBP_PUBLISH_JOB_CORE_CHANGED' });

    expect(pushDraftToGoogleMock).not.toHaveBeenCalled();
    expect(jobUpdates(updates)).toEqual([
      {
        table: 'restaurant_external_profile_publish_jobs',
        payload: {
          status: 'google_failed',
          google_retry_by_user_id: 'user-1',
          retried_at: FIXED_NOW,
          error_classification: null,
          errors: [
            {
              message: expect.stringContaining('profile'),
              classification: null,
              retryable: false,
              reconciliationRequired: true,
            },
          ],
        },
      },
    ]);
  });

  it('propagates claim conflicts without pushing to Google @contract', async () => {
    const { client, updates } = createDbClient();
    const claimConflict = Object.assign(new Error('already being applied'), {
      name: 'GBP_PUBLISH_JOB_INVALID_STATE',
    });
    claimPublishJobForGoogleRetryMock.mockRejectedValue(claimConflict);

    await expect(retry(client)).rejects.toBe(claimConflict);
    expect(pushDraftToGoogleMock).not.toHaveBeenCalled();
    expect(updates).toEqual([]);
  });

  it('marks the job google_failed with the classified error when the push fails @contract @external-mock', async () => {
    const { client, updates } = createDbClient();
    const pushFailure = Object.assign(new Error('Rate limit exceeded for write requests'), {
      classification: 'quota',
      retryable: true,
      googleEventId: 'evt-9',
    });
    pushDraftToGoogleMock.mockRejectedValue(pushFailure);

    await expect(retry(client)).rejects.toBe(pushFailure);

    expect(jobUpdates(updates)).toEqual([
      {
        table: 'restaurant_external_profile_publish_jobs',
        payload: {
          status: 'google_failed',
          google_publish_event_id: 'evt-9',
          google_retry_by_user_id: 'user-1',
          retried_at: FIXED_NOW,
          error_classification: 'quota',
          errors: [
            {
              classification: 'quota',
              message: 'Rate limit exceeded for write requests',
              retryable: true,
            },
          ],
        },
      },
    ]);
    expect(draftUpdates(updates)).toEqual([]);
  });

  it('classifies unclassified push failures as retryable and keeps the previous event id @contract @external-mock', async () => {
    const { client, updates } = createDbClient();
    pushDraftToGoogleMock.mockRejectedValue(new Error('socket hang up'));

    await expect(retry(client)).rejects.toThrow('socket hang up');

    const [failureUpdate] = jobUpdates(updates);
    expect(failureUpdate?.payload).toMatchObject({
      status: 'google_failed',
      error_classification: 'retryable',
      google_publish_event_id: 'evt-prev',
      retried_at: FIXED_NOW,
    });
  });

  it('preserves an explicit null classification from the push failure @contract @external-mock', async () => {
    const { client, updates } = createDbClient();
    pushDraftToGoogleMock.mockRejectedValue(
      Object.assign(new Error('nothing to send'), { classification: null }),
    );

    await expect(retry(client)).rejects.toThrow('nothing to send');

    expect(jobUpdates(updates)[0]?.payload).toMatchObject({ error_classification: null });
  });

  it('publishes the job and draft with pinned timestamps on a successful retry @contract @external-mock', async () => {
    const { client, updates } = createDbClient();

    const result = await retry(client);

    expect(claimPublishJobForGoogleRetryMock).toHaveBeenCalledWith({
      jobId: 'job-1',
      actorUserId: 'user-1',
      client,
    });
    expect(pushDraftToGoogleMock).toHaveBeenCalledWith({
      restaurantId: 'rest-1',
      draft: mappedDraft,
      externalProfile: { id: 'profile-1', push_enabled: true },
      actorUserId: 'user-1',
      googleUpdateMasks: ['title'],
      currentCore: coreSnapshots,
      client,
    });
    expect(jobUpdates(updates)).toEqual([
      {
        table: 'restaurant_external_profile_publish_jobs',
        payload: {
          status: 'published',
          google_publish_event_id: 'google-event-1',
          google_pushed_at: FIXED_NOW,
          google_retry_by_user_id: 'user-1',
          retried_at: FIXED_NOW,
          error_classification: null,
          errors: [],
        },
      },
    ]);
    expect(draftUpdates(updates)).toEqual([
      {
        table: 'restaurant_external_profile_drafts',
        payload: {
          status: 'published',
          published_by_user_id: 'user-1',
          published_at: FIXED_NOW,
        },
      },
    ]);
    expect(result).toEqual({ ...workflowState, googleEventId: 'google-event-1' });
  });

  it('flags reconciliation when the local status update fails after Google succeeded @contract @external-mock', async () => {
    const draftUpdateFailure = { message: 'draft row locked' };
    const { client, updates } = createDbClient({
      restaurant_external_profile_drafts: [draftUpdateFailure],
    });

    await expect(retry(client)).rejects.toBe(draftUpdateFailure);

    const jobPayloads = jobUpdates(updates).map((call) => call.payload);
    expect(jobPayloads[0]).toMatchObject({ status: 'published' });
    expect(jobPayloads[1]).toEqual({
      status: 'failed',
      google_publish_event_id: 'google-event-1',
      google_retry_by_user_id: 'user-1',
      retried_at: FIXED_NOW,
      error_classification: null,
      errors: [
        {
          message: 'Local status update failed after Google publish succeeded.',
          classification: null,
          retryable: false,
          reconciliationRequired: true,
        },
      ],
    });
  });
});

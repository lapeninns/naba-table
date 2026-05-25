import { describe, expect, it, vi } from 'vitest';

const buildPublishPreflightContextMock = vi.hoisted(() => vi.fn());
const upsertPublishJobFromPreflightMock = vi.hoisted(() => vi.fn());
const mapPublishJobMock = vi.hoisted(() => vi.fn());
const buildPublishPreflightResponseMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/google-business-profile/workflowPreflightContext', () => ({
  buildPublishPreflightContext: buildPublishPreflightContextMock,
}));

vi.mock('@/server/google-business-profile/workflowRepository', () => ({
  upsertPublishJobFromPreflight: upsertPublishJobFromPreflightMock,
}));

vi.mock('@/server/google-business-profile/workflowMappers', () => ({
  mapPublishJob: mapPublishJobMock,
}));

vi.mock('@/server/google-business-profile/workflowPublishPreflight', () => ({
  buildPublishPreflightResponse: buildPublishPreflightResponseMock,
}));

import { preflightGoogleBusinessProfileWorkflowDraftForClient } from '@/server/google-business-profile/workflowPreflightService';

const client = { from: vi.fn() };

describe('google business profile workflow preflight service', () => {
  it('builds context, upserts the publish job, and returns the mapped response', async () => {
    const context = {
      selectedApprovals: { 'profile.name': true },
      warnings: [],
      errors: [],
    };
    const job = { id: 'job-1', status: 'preflight_ready' };
    const activePublishJob = { id: 'job-1', canRetryGooglePush: false };
    const response = {
      publishJobId: 'job-1',
      canPublish: true,
      activePublishJob,
    };

    buildPublishPreflightContextMock.mockResolvedValueOnce(context);
    upsertPublishJobFromPreflightMock.mockResolvedValueOnce(job);
    mapPublishJobMock.mockReturnValueOnce(activePublishJob);
    buildPublishPreflightResponseMock.mockReturnValueOnce(response);

    await expect(
      preflightGoogleBusinessProfileWorkflowDraftForClient({
        restaurantId: 'rest-1',
        draftId: 'draft-1',
        actorUserId: 'user-1',
        selectedApprovals: { 'profile.name': true },
        decisions: [],
        directionIntent: 'export_to_google',
        pushToGoogle: true,
        client: client as never,
      }),
    ).resolves.toBe(response);

    expect(buildPublishPreflightContextMock).toHaveBeenCalledWith({
      restaurantId: 'rest-1',
      draftId: 'draft-1',
      selectedApprovals: { 'profile.name': true },
      decisions: [],
      actorUserId: 'user-1',
      directionIntent: 'export_to_google',
      pushToGoogle: true,
      client,
    });
    expect(upsertPublishJobFromPreflightMock).toHaveBeenCalledWith({
      restaurantId: 'rest-1',
      actorUserId: 'user-1',
      context,
      client,
    });
    expect(mapPublishJobMock).toHaveBeenCalledWith(job);
    expect(buildPublishPreflightResponseMock).toHaveBeenCalledWith({
      context,
      job,
      activePublishJob,
    });
  });
});

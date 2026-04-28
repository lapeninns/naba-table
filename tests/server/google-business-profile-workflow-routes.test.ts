import { NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const ensureRestaurantAdminAccessMock = vi.hoisted(() => vi.fn());
const resolveRestaurantIdMock = vi.hoisted(() => vi.fn());
const getWorkflowMock = vi.hoisted(() => vi.fn());
const createDraftMock = vi.hoisted(() => vi.fn());
const updateDraftMock = vi.hoisted(() => vi.fn());
const preflightDraftPublishMock = vi.hoisted(() => vi.fn());
const publishDraftMock = vi.hoisted(() => vi.fn());
const retryGooglePushMock = vi.hoisted(() => vi.fn());
const verifyUserPasswordConfirmationMock = vi.hoisted(() => vi.fn());
const PasswordConfirmationErrorMock = vi.hoisted(
  () =>
    class PasswordConfirmationError extends Error {
      code: string;
      status: number;

      constructor(message: string, options: { code?: string; status?: number } = {}) {
        super(message);
        this.code = options.code ?? 'PASSWORD_CONFIRMATION_FAILED';
        this.status = options.status ?? 403;
      }
    },
);

vi.mock('@/app/api/ops/restaurants/[id]/_shared', () => ({
  ensureRestaurantAdminAccess: ensureRestaurantAdminAccessMock,
  resolveRestaurantId: resolveRestaurantIdMock,
}));

vi.mock('@/server/google-business-profile/workflow', () => ({
  getGoogleBusinessProfileWorkflow: getWorkflowMock,
  createGoogleBusinessProfileWorkflowDraft: createDraftMock,
  updateGoogleBusinessProfileWorkflowDraft: updateDraftMock,
  preflightGoogleBusinessProfileWorkflowDraft: preflightDraftPublishMock,
  publishGoogleBusinessProfileWorkflowDraft: publishDraftMock,
  retryGoogleBusinessProfileWorkflowGooglePush: retryGooglePushMock,
}));

vi.mock('@/server/auth/password-confirmation', () => ({
  PasswordConfirmationError: PasswordConfirmationErrorMock,
  verifyUserPasswordConfirmation: verifyUserPasswordConfirmationMock,
}));

import { POST as preflightDraftPublishPOST } from '@/src/app/api/ops/restaurants/[id]/google-business-profile/drafts/[draftId]/publish/preflight/route';
import { POST as publishDraftPOST } from '@/src/app/api/ops/restaurants/[id]/google-business-profile/drafts/[draftId]/publish/route';
import { POST as retryGooglePushPOST } from '@/src/app/api/ops/restaurants/[id]/google-business-profile/drafts/[draftId]/publish-jobs/[jobId]/retry-google-push/route';
import { PATCH as updateDraftPATCH } from '@/src/app/api/ops/restaurants/[id]/google-business-profile/drafts/[draftId]/route';
import { POST as createDraftPOST } from '@/src/app/api/ops/restaurants/[id]/google-business-profile/drafts/route';
import { GET as workflowGET } from '@/src/app/api/ops/restaurants/[id]/google-business-profile/workflow/route';

const workflowPayload = {
  latestDraft: null,
  sectionSummaries: [],
  publishableSections: [],
  blockedReasons: [],
  auditEvents: [],
  activePublishJob: null,
};

function buildInvalidStateError(
  message = 'Google Business Profile draft is archived and cannot be edited.',
) {
  const error = new Error(message);
  error.name = 'GBP_DRAFT_INVALID_STATE';
  return error;
}

describe('google business profile workflow routes', () => {
  beforeEach(() => {
    ensureRestaurantAdminAccessMock.mockReset();
    resolveRestaurantIdMock.mockReset();
    getWorkflowMock.mockReset();
    createDraftMock.mockReset();
    updateDraftMock.mockReset();
    preflightDraftPublishMock.mockReset();
    publishDraftMock.mockReset();
    retryGooglePushMock.mockReset();
    verifyUserPasswordConfirmationMock.mockReset();
  });

  it('returns the shared auth response from workflow GET', async () => {
    resolveRestaurantIdMock.mockResolvedValue('rest-1');
    ensureRestaurantAdminAccessMock.mockResolvedValue(
      NextResponse.json({ error: 'Authentication required' }, { status: 401 }),
    );

    const response = await workflowGET(
      new NextRequest(
        'https://example.com/api/ops/restaurants/rest-1/google-business-profile/workflow',
      ),
      { params: Promise.resolve({ id: 'rest-1' }) },
    );

    expect(response.status).toBe(401);
    expect(getWorkflowMock).not.toHaveBeenCalled();
  });

  it('creates a draft with the authenticated actor id', async () => {
    resolveRestaurantIdMock.mockResolvedValue('rest-1');
    ensureRestaurantAdminAccessMock.mockResolvedValue({
      userId: 'user-1',
      userEmail: 'ops@example.com',
    });
    createDraftMock.mockResolvedValue(workflowPayload);

    const response = await createDraftPOST(
      new NextRequest(
        'https://example.com/api/ops/restaurants/rest-1/google-business-profile/drafts',
        { method: 'POST' },
      ),
      { params: Promise.resolve({ id: 'rest-1' }) },
    );

    expect(response.status).toBe(201);
    expect(createDraftMock).toHaveBeenCalledWith({
      restaurantId: 'rest-1',
      actorUserId: 'user-1',
    });
  });

  it('updates draft approvals only after payload validation', async () => {
    resolveRestaurantIdMock.mockResolvedValue('rest-1');
    ensureRestaurantAdminAccessMock.mockResolvedValue({
      userId: 'user-1',
      userEmail: 'ops@example.com',
    });
    updateDraftMock.mockResolvedValue(workflowPayload);

    const response = await updateDraftPATCH(
      new NextRequest(
        'https://example.com/api/ops/restaurants/rest-1/google-business-profile/drafts/draft-1',
        {
          method: 'PATCH',
          body: JSON.stringify({
            status: 'approved',
            selectedApprovals: { 'profile.name': true },
          }),
        },
      ),
      { params: Promise.resolve({ id: 'rest-1', draftId: 'draft-1' }) },
    );

    expect(response.status).toBe(200);
    expect(updateDraftMock).toHaveBeenCalledWith({
      restaurantId: 'rest-1',
      draftId: 'draft-1',
      actorUserId: 'user-1',
      status: 'approved',
      selectedApprovals: { 'profile.name': true },
    });
  });

  it('returns workflow update errors in the shared client message field', async () => {
    resolveRestaurantIdMock.mockResolvedValue('rest-1');
    ensureRestaurantAdminAccessMock.mockResolvedValue({
      userId: 'user-1',
      userEmail: 'ops@example.com',
    });
    updateDraftMock.mockRejectedValue({
      message: 'JSON object requested, multiple (or no) rows returned',
    });

    const response = await updateDraftPATCH(
      new NextRequest(
        'https://example.com/api/ops/restaurants/rest-1/google-business-profile/drafts/archived-draft',
        {
          method: 'PATCH',
          body: JSON.stringify({
            status: 'approved',
            selectedApprovals: { 'businessContext.categories': true },
          }),
        },
      ),
      { params: Promise.resolve({ id: 'rest-1', draftId: 'archived-draft' }) },
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      message: 'Unable to update Google Business Profile review draft.',
      error: 'Unable to update Google Business Profile review draft.',
    });
  });

  it('returns conflict when a draft update targets a non-editable state', async () => {
    resolveRestaurantIdMock.mockResolvedValue('rest-1');
    ensureRestaurantAdminAccessMock.mockResolvedValue({
      userId: 'user-1',
      userEmail: 'ops@example.com',
    });
    updateDraftMock.mockRejectedValue(buildInvalidStateError());

    const response = await updateDraftPATCH(
      new NextRequest(
        'https://example.com/api/ops/restaurants/rest-1/google-business-profile/drafts/archived-draft',
        {
          method: 'PATCH',
          body: JSON.stringify({
            status: 'approved',
            selectedApprovals: { 'profile.name': true },
          }),
        },
      ),
      { params: Promise.resolve({ id: 'rest-1', draftId: 'archived-draft' }) },
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      message: 'Google Business Profile draft is archived and cannot be edited.',
      error: 'Google Business Profile draft is archived and cannot be edited.',
      code: 'GBP_DRAFT_INVALID_STATE',
    });
  });

  it('requires password confirmation before publish', async () => {
    resolveRestaurantIdMock.mockResolvedValue('rest-1');
    ensureRestaurantAdminAccessMock.mockResolvedValue({
      userId: 'user-1',
      userEmail: 'ops@example.com',
    });
    verifyUserPasswordConfirmationMock.mockRejectedValue(
      new PasswordConfirmationErrorMock('Password confirmation failed.', {
        code: 'PASSWORD_CONFIRMATION_FAILED',
        status: 403,
      }),
    );

    const response = await publishDraftPOST(
      new NextRequest(
        'https://example.com/api/ops/restaurants/rest-1/google-business-profile/drafts/draft-1/publish',
        {
          method: 'POST',
          body: JSON.stringify({
            password: 'bad-password',
            publishJobId: 'job-1',
            idempotencyKey: 'key-1',
            pushToGoogle: true,
          }),
        },
      ),
      { params: Promise.resolve({ id: 'rest-1', draftId: 'draft-1' }) },
    );

    expect(response.status).toBe(403);
    expect(publishDraftMock).not.toHaveBeenCalled();
  });

  it('preflights selected approvals without password confirmation', async () => {
    resolveRestaurantIdMock.mockResolvedValue('rest-1');
    ensureRestaurantAdminAccessMock.mockResolvedValue({
      userId: 'user-1',
      userEmail: 'ops@example.com',
    });
    preflightDraftPublishMock.mockResolvedValue({
      publishJobId: 'job-1',
      idempotencyKey: 'key-1',
      mode: 'nabatable_only',
      directionIntent: 'google_to_nabatable',
      selectedApprovals: { 'profile.name': true },
      nabatableUpdates: [],
      pullOnlyItems: [],
      googleUpdateMasks: [],
      warnings: [],
      errors: [],
      canPublish: true,
      canPushToGoogle: false,
      activePublishJob: {
        id: 'job-1',
        draftId: 'draft-1',
        idempotencyKey: 'key-1',
        mode: 'nabatable_only',
        directionIntent: 'google_to_nabatable',
        status: 'preflight_ready',
        selectedApprovals: { 'profile.name': true },
        nabatableSections: ['profile'],
        googleUpdateMasks: [],
        postNabatableCoreHashes: {},
        errorClassification: null,
        errors: [],
        nabatableEventId: null,
        googleEventId: null,
        canRetryGooglePush: false,
        retryBlockedReason: 'This publish job was Nabatable-only.',
        createdAt: '2026-04-26T11:33:00.000Z',
        updatedAt: '2026-04-26T11:33:00.000Z',
      },
    });

    const response = await preflightDraftPublishPOST(
      new NextRequest(
        'https://example.com/api/ops/restaurants/rest-1/google-business-profile/drafts/draft-1/publish/preflight',
        {
          method: 'POST',
          body: JSON.stringify({
            selectedApprovals: { 'profile.name': true },
            directionIntent: 'google_to_nabatable',
          }),
        },
      ),
      { params: Promise.resolve({ id: 'rest-1', draftId: 'draft-1' }) },
    );

    expect(response.status).toBe(200);
    expect(verifyUserPasswordConfirmationMock).not.toHaveBeenCalled();
    expect(preflightDraftPublishMock).toHaveBeenCalledWith({
      restaurantId: 'rest-1',
      draftId: 'draft-1',
      actorUserId: 'user-1',
      selectedApprovals: { 'profile.name': true },
      directionIntent: 'google_to_nabatable',
      pushToGoogle: undefined,
    });
  });

  it('preflights a reviewed Google-only write-back request', async () => {
    resolveRestaurantIdMock.mockResolvedValue('rest-1');
    ensureRestaurantAdminAccessMock.mockResolvedValue({
      userId: 'user-1',
      userEmail: 'ops@example.com',
    });
    preflightDraftPublishMock.mockResolvedValue({
      publishJobId: 'job-1',
      idempotencyKey: 'key-1',
      mode: 'google_only',
      directionIntent: 'nabatable_to_google',
      selectedApprovals: { 'profile.name': true },
      nabatableUpdates: [],
      pullOnlyItems: [],
      googleUpdateMasks: ['title'],
      warnings: [],
      errors: [],
      canPublish: true,
      canPushToGoogle: true,
      activePublishJob: {
        id: 'job-1',
        draftId: 'draft-1',
        idempotencyKey: 'key-1',
        mode: 'google_only',
        directionIntent: 'nabatable_to_google',
        status: 'preflight_ready',
        selectedApprovals: { 'profile.name': true },
        nabatableSections: ['profile'],
        googleUpdateMasks: ['title'],
        postNabatableCoreHashes: {},
        errorClassification: null,
        errors: [],
        nabatableEventId: null,
        googleEventId: null,
        canRetryGooglePush: false,
        retryBlockedReason:
          'Google write retry is available only for failed or partial Google publish jobs.',
        createdAt: '2026-04-26T11:33:00.000Z',
        updatedAt: '2026-04-26T11:33:00.000Z',
      },
    });

    const response = await preflightDraftPublishPOST(
      new NextRequest(
        'https://example.com/api/ops/restaurants/rest-1/google-business-profile/drafts/draft-1/publish/preflight',
        {
          method: 'POST',
          body: JSON.stringify({
            selectedApprovals: { 'profile.name': true },
            directionIntent: 'nabatable_to_google',
          }),
        },
      ),
      { params: Promise.resolve({ id: 'rest-1', draftId: 'draft-1' }) },
    );

    expect(response.status).toBe(200);
    expect(preflightDraftPublishMock).toHaveBeenCalledWith({
      restaurantId: 'rest-1',
      draftId: 'draft-1',
      actorUserId: 'user-1',
      selectedApprovals: { 'profile.name': true },
      directionIntent: 'nabatable_to_google',
      pushToGoogle: undefined,
    });
  });

  it('returns conflict when the workflow publish detects a stale draft', async () => {
    resolveRestaurantIdMock.mockResolvedValue('rest-1');
    ensureRestaurantAdminAccessMock.mockResolvedValue({
      userId: 'user-1',
      userEmail: 'ops@example.com',
    });
    verifyUserPasswordConfirmationMock.mockResolvedValue(undefined);
    const staleError = new Error('Draft is stale for section: profile');
    staleError.name = 'GBP_DRAFT_STALE';
    publishDraftMock.mockRejectedValue(staleError);

    const response = await publishDraftPOST(
      new NextRequest(
        'https://example.com/api/ops/restaurants/rest-1/google-business-profile/drafts/draft-1/publish',
        {
          method: 'POST',
          body: JSON.stringify({
            password: 'valid-password',
            publishJobId: 'job-1',
            idempotencyKey: 'key-1',
          }),
        },
      ),
      { params: Promise.resolve({ id: 'rest-1', draftId: 'draft-1' }) },
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      message: 'Draft is stale for section: profile',
      error: 'Draft is stale for section: profile',
      code: 'GBP_DRAFT_STALE',
    });
  });

  it('returns conflict with stage guidance when publishing a draft still in review', async () => {
    resolveRestaurantIdMock.mockResolvedValue('rest-1');
    ensureRestaurantAdminAccessMock.mockResolvedValue({
      userId: 'user-1',
      userEmail: 'ops@example.com',
    });
    verifyUserPasswordConfirmationMock.mockResolvedValue(undefined);
    const notApprovedError = new Error(
      'Approve the Google Business Profile draft in Step 1 before publishing.',
    );
    notApprovedError.name = 'GBP_DRAFT_NOT_APPROVED';
    publishDraftMock.mockRejectedValue(notApprovedError);

    const response = await publishDraftPOST(
      new NextRequest(
        'https://example.com/api/ops/restaurants/rest-1/google-business-profile/drafts/draft-1/publish',
        {
          method: 'POST',
          body: JSON.stringify({
            password: 'valid-password',
            publishJobId: 'job-1',
            idempotencyKey: 'key-1',
          }),
        },
      ),
      { params: Promise.resolve({ id: 'rest-1', draftId: 'draft-1' }) },
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      message: 'Approve the Google Business Profile draft in Step 1 before publishing.',
      error: 'Approve the Google Business Profile draft in Step 1 before publishing.',
      code: 'GBP_DRAFT_NOT_APPROVED',
    });
  });

  it('returns conflict when preflight is run against a draft still in review', async () => {
    resolveRestaurantIdMock.mockResolvedValue('rest-1');
    ensureRestaurantAdminAccessMock.mockResolvedValue({
      userId: 'user-1',
      userEmail: 'ops@example.com',
    });
    const notApprovedError = new Error(
      'Approve the Google Business Profile draft in Step 1 before publishing.',
    );
    notApprovedError.name = 'GBP_DRAFT_NOT_APPROVED';
    preflightDraftPublishMock.mockRejectedValue(notApprovedError);

    const response = await preflightDraftPublishPOST(
      new NextRequest(
        'https://example.com/api/ops/restaurants/rest-1/google-business-profile/drafts/draft-1/publish/preflight',
        {
          method: 'POST',
          body: JSON.stringify({
            selectedApprovals: { 'profile.name': true },
          }),
        },
      ),
      { params: Promise.resolve({ id: 'rest-1', draftId: 'draft-1' }) },
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      message: 'Approve the Google Business Profile draft in Step 1 before publishing.',
      error: 'Approve the Google Business Profile draft in Step 1 before publishing.',
      code: 'GBP_DRAFT_NOT_APPROVED',
    });
  });

  it('returns conflict when publish targets a non-publishable draft state', async () => {
    resolveRestaurantIdMock.mockResolvedValue('rest-1');
    ensureRestaurantAdminAccessMock.mockResolvedValue({
      userId: 'user-1',
      userEmail: 'ops@example.com',
    });
    verifyUserPasswordConfirmationMock.mockResolvedValue(undefined);
    publishDraftMock.mockRejectedValue(
      buildInvalidStateError('Google Business Profile draft is archived and cannot be published.'),
    );

    const response = await publishDraftPOST(
      new NextRequest(
        'https://example.com/api/ops/restaurants/rest-1/google-business-profile/drafts/archived-draft/publish',
        {
          method: 'POST',
          body: JSON.stringify({
            password: 'valid-password',
            publishJobId: 'job-1',
            idempotencyKey: 'key-1',
          }),
        },
      ),
      { params: Promise.resolve({ id: 'rest-1', draftId: 'archived-draft' }) },
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      message: 'Google Business Profile draft is archived and cannot be published.',
      error: 'Google Business Profile draft is archived and cannot be published.',
      code: 'GBP_DRAFT_INVALID_STATE',
    });
  });

  it('publishes a reviewed Google-only write-back request', async () => {
    resolveRestaurantIdMock.mockResolvedValue('rest-1');
    ensureRestaurantAdminAccessMock.mockResolvedValue({
      userId: 'user-1',
      userEmail: 'ops@example.com',
    });
    verifyUserPasswordConfirmationMock.mockResolvedValue(undefined);
    publishDraftMock.mockResolvedValue({ latestDraft: null, auditEvents: [] });

    const response = await publishDraftPOST(
      new NextRequest(
        'https://example.com/api/ops/restaurants/rest-1/google-business-profile/drafts/draft-1/publish',
        {
          method: 'POST',
          body: JSON.stringify({
            password: 'valid-password',
            publishJobId: 'job-1',
            idempotencyKey: 'key-1',
            directionIntent: 'nabatable_to_google',
          }),
        },
      ),
      { params: Promise.resolve({ id: 'rest-1', draftId: 'draft-1' }) },
    );

    expect(response.status).toBe(200);
    expect(publishDraftMock).toHaveBeenCalledWith({
      restaurantId: 'rest-1',
      draftId: 'draft-1',
      actorUserId: 'user-1',
      publishJobId: 'job-1',
      idempotencyKey: 'key-1',
      selectedApprovals: undefined,
      directionIntent: 'nabatable_to_google',
      pushToGoogle: undefined,
    });
  });

  it('returns a sanitized message for unexpected workflow publish errors', async () => {
    resolveRestaurantIdMock.mockResolvedValue('rest-1');
    ensureRestaurantAdminAccessMock.mockResolvedValue({
      userId: 'user-1',
      userEmail: 'ops@example.com',
    });
    verifyUserPasswordConfirmationMock.mockResolvedValue(undefined);
    publishDraftMock.mockRejectedValue(new Error('Provider row id already exists.'));

    const response = await publishDraftPOST(
      new NextRequest(
        'https://example.com/api/ops/restaurants/rest-1/google-business-profile/drafts/draft-1/publish',
        {
          method: 'POST',
          body: JSON.stringify({
            password: 'valid-password',
            publishJobId: 'job-1',
            idempotencyKey: 'key-1',
          }),
        },
      ),
      { params: Promise.resolve({ id: 'rest-1', draftId: 'draft-1' }) },
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      message: 'Unable to publish Google Business Profile review draft.',
      error: 'Unable to publish Google Business Profile review draft.',
    });
  });

  it('sanitizes non-Error workflow publish messages', async () => {
    resolveRestaurantIdMock.mockResolvedValue('rest-1');
    ensureRestaurantAdminAccessMock.mockResolvedValue({
      userId: 'user-1',
      userEmail: 'ops@example.com',
    });
    verifyUserPasswordConfirmationMock.mockResolvedValue(undefined);
    publishDraftMock.mockRejectedValue({
      message:
        'duplicate key value violates unique constraint "restaurant_categories_primary_unique"',
    });

    const response = await publishDraftPOST(
      new NextRequest(
        'https://example.com/api/ops/restaurants/rest-1/google-business-profile/drafts/draft-1/publish',
        {
          method: 'POST',
          body: JSON.stringify({
            password: 'valid-password',
            publishJobId: 'job-1',
            idempotencyKey: 'key-1',
          }),
        },
      ),
      { params: Promise.resolve({ id: 'rest-1', draftId: 'draft-1' }) },
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      message: 'Unable to publish Google Business Profile review draft.',
      error: 'Unable to publish Google Business Profile review draft.',
    });
  });

  it('retries Google push only after password confirmation', async () => {
    resolveRestaurantIdMock.mockResolvedValue('rest-1');
    ensureRestaurantAdminAccessMock.mockResolvedValue({
      userId: 'user-1',
      userEmail: 'ops@example.com',
    });
    verifyUserPasswordConfirmationMock.mockResolvedValue(undefined);
    retryGooglePushMock.mockResolvedValue(workflowPayload);

    const response = await retryGooglePushPOST(
      new NextRequest(
        'https://example.com/api/ops/restaurants/rest-1/google-business-profile/drafts/draft-1/publish-jobs/job-1/retry-google-push',
        {
          method: 'POST',
          body: JSON.stringify({ password: 'valid-password' }),
        },
      ),
      { params: Promise.resolve({ id: 'rest-1', draftId: 'draft-1', jobId: 'job-1' }) },
    );

    expect(response.status).toBe(200);
    expect(retryGooglePushMock).toHaveBeenCalledWith({
      restaurantId: 'rest-1',
      draftId: 'draft-1',
      publishJobId: 'job-1',
      actorUserId: 'user-1',
    });
  });

  it('returns conflict when Google push is disabled during retry', async () => {
    resolveRestaurantIdMock.mockResolvedValue('rest-1');
    ensureRestaurantAdminAccessMock.mockResolvedValue({
      userId: 'user-1',
      userEmail: 'ops@example.com',
    });
    verifyUserPasswordConfirmationMock.mockResolvedValue(undefined);
    const disabledError = new Error(
      'Google writes are disabled for this linked Google Business Profile location.',
    );
    disabledError.name = 'GBP_GOOGLE_PUSH_DISABLED';
    retryGooglePushMock.mockRejectedValue(disabledError);

    const response = await retryGooglePushPOST(
      new NextRequest(
        'https://example.com/api/ops/restaurants/rest-1/google-business-profile/drafts/draft-1/publish-jobs/job-1/retry-google-push',
        {
          method: 'POST',
          body: JSON.stringify({ password: 'valid-password' }),
        },
      ),
      { params: Promise.resolve({ id: 'rest-1', draftId: 'draft-1', jobId: 'job-1' }) },
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      message: 'Google writes are disabled for this linked Google Business Profile location.',
      error: 'Google writes are disabled for this linked Google Business Profile location.',
      code: 'GBP_GOOGLE_PUSH_DISABLED',
    });
  });
});

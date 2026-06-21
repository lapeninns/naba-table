import { describe, expect, it } from 'vitest';

import {
  buildDraftPublishingPatch,
  classifyWorkflowGooglePushFailure,
  describeWorkflowPublishError,
  extractGoogleEventIdFromPublishError,
  resolveCompletedPublishJobOutcome,
} from '@/server/google-business-profile/workflowPublishLifecycleDomain';

import type { GoogleBusinessProfileFieldDecision } from '@/server/google-business-profile/workflow';

const decision: GoogleBusinessProfileFieldDecision = {
  sectionKey: 'profile',
  fieldKey: 'profile.name',
  action: 'import_from_google',
  decidedByUserId: 'user-1',
  decidedAt: '2026-05-22T19:00:00.000Z',
  reviewedNabatableValueHash: 'core-hash',
  reviewedGoogleValueHash: 'google-hash',
};

describe('workflow publish lifecycle domain helpers', () => {
  it('maps completed publish jobs to idempotent publish outcomes', () => {
    expect(
      resolveCompletedPublishJobOutcome({
        status: 'published',
        nabatable_publish_event_id: 'nab-1',
        google_publish_event_id: 'google-1',
      }),
    ).toEqual({
      result: 'published',
      nabatableEventId: 'nab-1',
      googleEventId: 'google-1',
    });

    expect(
      resolveCompletedPublishJobOutcome({
        status: 'google_failed',
        nabatable_publish_event_id: 'nab-2',
        google_publish_event_id: null,
      }),
    ).toEqual({
      result: 'partially_published',
      nabatableEventId: 'nab-2',
      googleEventId: null,
    });

    expect(
      resolveCompletedPublishJobOutcome({
        status: 'preflight_ready',
        nabatable_publish_event_id: null,
        google_publish_event_id: null,
      }),
    ).toBeNull();
  });

  it('builds the publishing patch and stamps missing approval metadata', () => {
    const patch = buildDraftPublishingPatch({
      selectedApprovals: { profile: true },
      decisions: [decision],
      approvedAt: null,
      approvedByUserId: null,
      actorUserId: 'user-2',
      nowIso: '2026-05-22T20:00:00.000Z',
    });

    expect(patch).toMatchObject({
      status: 'publishing',
      approved_at: '2026-05-22T20:00:00.000Z',
      approved_by_user_id: 'user-2',
      selected_approvals: {
        profile: true,
        __fieldDecisions: [decision],
      },
    });
  });

  it('preserves existing approval metadata in the publishing patch', () => {
    const patch = buildDraftPublishingPatch({
      selectedApprovals: {},
      decisions: [],
      approvedAt: '2026-05-21T10:00:00.000Z',
      approvedByUserId: 'approver-1',
      actorUserId: 'publisher-1',
      nowIso: '2026-05-22T20:00:00.000Z',
    });

    expect(patch.approved_at).toBeUndefined();
    expect(patch.approved_by_user_id).toBeUndefined();
    expect(patch).toMatchObject({
      status: 'publishing',
      selected_approvals: {},
    });
  });

  it('describes workflow errors from Error, message, details, or fallback', () => {
    expect(describeWorkflowPublishError(new Error('Boom'), 'Fallback')).toBe('Boom');
    expect(describeWorkflowPublishError({ message: 'From message' }, 'Fallback')).toBe(
      'From message',
    );
    expect(describeWorkflowPublishError({ details: 'From details' }, 'Fallback')).toBe(
      'From details',
    );
    expect(describeWorkflowPublishError({}, 'Fallback')).toBe('Fallback');
  });

  it('preserves custom Google classification errors and event ids', () => {
    const error = {
      classification: 'permission' as const,
      message: 'Missing OAuth scope',
      googleEventId: 'google-event-1',
    };

    expect(classifyWorkflowGooglePushFailure(error)).toEqual({
      classification: 'permission',
      message: 'Missing OAuth scope',
    });
    expect(extractGoogleEventIdFromPublishError(error, null)).toBe('google-event-1');
  });

  it('falls back to generic Google classification and fallback event ids', () => {
    expect(classifyWorkflowGooglePushFailure({ status: 429, message: 'quota exhausted' })).toEqual({
      classification: 'quota',
      message: 'quota exhausted',
    });
    expect(extractGoogleEventIdFromPublishError(new Error('no event'), 'previous-event')).toBe(
      'previous-event',
    );
  });
});

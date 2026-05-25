import { describe, expect, it } from 'vitest';

import {
  assertGooglePushEnabled,
  buildPublishPreflightResponse,
  buildPreflightWarnings,
  buildPublishJobIdempotencyKey,
  createWorkflowNamedError,
  publishModeForDecisions,
} from '@/server/google-business-profile/workflowPublishPreflight';

import type { GoogleBusinessProfileFieldDecision } from '@/server/google-business-profile/workflowFieldDecisions';

function decision(
  fieldKey: string,
  action: GoogleBusinessProfileFieldDecision<'profile'>['action'],
): GoogleBusinessProfileFieldDecision<'profile'> {
  return {
    sectionKey: 'profile',
    fieldKey,
    action,
    decidedByUserId: 'user-1',
    decidedAt: '2026-05-21T20:42:00.000Z',
    reviewedNabatableValueHash: `${fieldKey}:nabatable`,
    reviewedGoogleValueHash: `${fieldKey}:google`,
  };
}

describe('google business profile workflow publish preflight policy', () => {
  it('creates stable named workflow errors', () => {
    const error = createWorkflowNamedError('GBP_EXAMPLE', 'Example failure.');

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('GBP_EXAMPLE');
    expect(error.message).toBe('Example failure.');
  });

  it('guards Google push when profile writes are disabled', () => {
    expect(() => assertGooglePushEnabled({ push_enabled: true })).not.toThrow();
    expect(() => assertGooglePushEnabled({ push_enabled: false })).toThrow(
      /Google writes are disabled/,
    );
    expect(() => assertGooglePushEnabled(null)).toThrow(/Google writes are disabled/);
  });

  it('derives publish mode from reviewer decisions', () => {
    expect(publishModeForDecisions([])).toBeNull();
    expect(publishModeForDecisions([decision('profile.name', 'import_from_google')])).toBe(
      'nabatable_only',
    );
    expect(publishModeForDecisions([decision('profile.name', 'export_to_google')])).toBe(
      'google_only',
    );
    expect(
      publishModeForDecisions([
        decision('profile.name', 'import_from_google'),
        decision('profile.contactPhone', 'export_to_google'),
      ]),
    ).toBe('nabatable_and_google');
  });

  it('builds deterministic idempotency keys from stable publish inputs', () => {
    const input = {
      restaurantId: 'restaurant-1',
      draftId: 'draft-1',
      mode: 'nabatable_and_google' as const,
      selectedApprovals: { 'profile.name': true },
      decisions: [decision('profile.name', 'import_from_google')],
      currentHashes: { profile: 'profile-hash' },
    };

    expect(buildPublishJobIdempotencyKey(input)).toBe(buildPublishJobIdempotencyKey(input));
    expect(buildPublishJobIdempotencyKey(input)).toMatch(/^gbp-publish:restaurant-1:draft-1:/);
    expect(
      buildPublishJobIdempotencyKey({
        ...input,
        currentHashes: { profile: 'changed-profile-hash' },
      }),
    ).not.toBe(buildPublishJobIdempotencyKey(input));
  });

  it('returns no warnings for Nabatable-only preflight', () => {
    expect(
      buildPreflightWarnings({
        mode: 'nabatable_only',
        selectedDraftItems: [
          {
            fieldKey: 'profile.name',
            label: 'Name',
            sectionKey: 'profile',
            status: 'unsupported',
            canPushToGoogle: false,
          },
        ],
        googleUpdateMasks: [],
      }),
    ).toEqual([]);
  });

  it('warns about unsupported and read-only Google push fields', () => {
    expect(
      buildPreflightWarnings({
        mode: 'nabatable_and_google',
        selectedDraftItems: [
          {
            fieldKey: 'profile.address',
            label: 'Address',
            sectionKey: 'profile',
            status: 'ready',
            canPushToGoogle: false,
          },
          {
            fieldKey: 'profile.googleMapUrl',
            label: 'Google Map URL',
            sectionKey: 'profile',
            status: 'unsupported',
            canPushToGoogle: false,
          },
        ],
        googleUpdateMasks: ['title'],
      }),
    ).toEqual([
      {
        code: 'google_read_only',
        message: 'Address will update Nabatable only and will not be sent to Google.',
        fieldKey: 'profile.address',
        sectionKey: 'profile',
      },
      {
        code: 'unsupported_field',
        message: 'Google Map URL will update Nabatable only and will not be sent to Google.',
        fieldKey: 'profile.googleMapUrl',
        sectionKey: 'profile',
      },
    ]);
  });

  it('warns when Google push mode has no update masks', () => {
    expect(
      buildPreflightWarnings({
        mode: 'google_only',
        selectedDraftItems: [],
        googleUpdateMasks: [],
      }),
    ).toEqual([
      {
        code: 'no_google_masks',
        message: 'No selected fields can be sent to Google.',
      },
    ]);
  });

  it('builds preflight responses with publishability and active job metadata', () => {
    const response = buildPublishPreflightResponse({
      context: {
        mode: 'google_only',
        directionIntent: 'nabatable_to_google',
        selectedApprovals: { 'profile.name': true },
        decisions: [decision('profile.name', 'export_to_google')],
        nabatableUpdates: [],
        googleUpdates: [
          {
            fieldKey: 'profile.name',
            label: 'Name',
            sectionKey: 'profile',
          },
        ],
        pullOnlyItems: [],
        googleUpdateMasks: ['title'],
        warnings: [],
        errors: [],
      },
      job: {
        id: 'job-1',
        idempotency_key: 'gbp-publish:restaurant-1:draft-1:hash',
      },
      activePublishJob: {
        id: 'job-1',
        status: 'preflight_ready',
      },
    });

    expect(response).toMatchObject({
      publishJobId: 'job-1',
      publishPlanId: 'job-1',
      idempotencyKey: 'gbp-publish:restaurant-1:draft-1:hash',
      mode: 'google_only',
      directionIntent: 'nabatable_to_google',
      canPublish: true,
      canPushToGoogle: true,
      activePublishJob: {
        id: 'job-1',
        status: 'preflight_ready',
      },
    });
  });

  it('blocks preflight response publishing when errors or missing masks are present', () => {
    expect(
      buildPublishPreflightResponse({
        context: {
          mode: 'google_only',
          directionIntent: 'nabatable_to_google',
          selectedApprovals: {},
          decisions: [],
          nabatableUpdates: [],
          googleUpdates: [],
          pullOnlyItems: [],
          googleUpdateMasks: [],
          warnings: [],
          errors: [],
        },
        job: {
          id: 'job-1',
          idempotency_key: 'key-1',
        },
        activePublishJob: null,
      }).canPublish,
    ).toBe(false);

    expect(
      buildPublishPreflightResponse({
        context: {
          mode: 'nabatable_only',
          directionIntent: 'google_to_nabatable',
          selectedApprovals: {},
          decisions: [],
          nabatableUpdates: [{ fieldKey: 'profile.name', label: 'Name', sectionKey: 'profile' }],
          googleUpdates: [],
          pullOnlyItems: [],
          googleUpdateMasks: [],
          warnings: [],
          errors: [{ code: 'stale', message: 'Review is stale.' }],
        },
        job: {
          id: 'job-1',
          idempotency_key: 'key-1',
        },
        activePublishJob: null,
      }).canPublish,
    ).toBe(false);
  });
});

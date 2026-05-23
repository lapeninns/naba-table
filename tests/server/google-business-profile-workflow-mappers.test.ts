import { describe, expect, it } from 'vitest';

import {
  buildCoreSnapshotHashes,
  buildWorkflowResponse,
  mapDraft,
  mapEvent,
  mapPublishJob,
} from '@/server/google-business-profile/workflowMappers';

import type {
  GoogleBusinessProfileDraftSection,
  GoogleBusinessProfileWorkflowDraft,
} from '@/server/google-business-profile/workflow';
import type { GoogleBusinessProfileWorkflowCoreSnapshots } from '@/server/google-business-profile/workflowDraftSections';

function buildCore(
  overrides: Partial<GoogleBusinessProfileWorkflowCoreSnapshots['profile']> = {},
): GoogleBusinessProfileWorkflowCoreSnapshots {
  return {
    profile: {
      restaurantId: 'rest-1',
      name: 'Nabatable Name',
      slug: 'nabatable-name',
      timezone: 'Europe/London',
      capacity: 40,
      contactEmail: 'hello@example.com',
      contactPhone: '02070000000',
      address: '1 Nabatable Street',
      businessDescription: null,
      managerDailySummaryEnabled: false,
      managerNotificationPhone: null,
      googleMapUrl: null,
      googleReviewUrl: null,
      bookingPolicy: null,
      logoUrl: null,
      updatedAt: '2026-05-20T10:00:00.000Z',
      ...overrides,
    },
    operatingHours: {
      weekly: [
        {
          dayOfWeek: 1,
          opensAt: '09:00',
          closesAt: '17:00',
          isClosed: false,
          reservationIntervalMinutes: 15,
          reservationSlotTimes: null,
        },
      ],
      overrides: [],
    },
    servicePeriods: [
      {
        id: 'period-1',
        name: 'Dinner',
        dayOfWeek: 1,
        startTime: '18:00',
        endTime: '22:00',
        bookingOption: 'dinner',
        updatedAt: '2026-05-20T10:00:00.000Z',
      },
    ],
    businessContext: {
      core: {
        categories: [{ id: 'cat-1', displayName: 'Restaurant', isPrimary: true }],
        serviceAreas: [],
        attributes: [],
        serviceItems: [],
      },
      providerSnapshot: {
        categories: [],
        serviceAreas: [],
        attributes: [],
        serviceItems: [],
      },
    } as unknown as GoogleBusinessProfileWorkflowCoreSnapshots['businessContext'],
  };
}

function buildSection(): GoogleBusinessProfileDraftSection {
  return {
    sectionKey: 'profile',
    label: 'Profile',
    status: 'ready',
    summary: '1 change ready to review.',
    canPublishToNabatable: true,
    canPushToGoogle: true,
    blockedReasons: [],
    items: [
      {
        sectionKey: 'profile',
        fieldKey: 'profile.name',
        label: 'Business name',
        currentValue: 'Nabatable Name',
        providerValue: 'Google Name',
        proposedValue: 'Google Name',
        direction: 'pull_from_gbp',
        status: 'ready',
        selected: false,
        normalizedNabatableValue: 'Nabatable Name',
        normalizedGoogleValue: 'Google Name',
        nabatableValueHash: 'nabatable-hash',
        googleValueHash: 'google-hash',
        capabilities: {
          canImportFromGoogle: true,
          canExportToGoogle: true,
          canIgnore: true,
        },
        blockedReasons: [],
        canPublishToNabatable: true,
        canPushToGoogle: true,
        warnings: [],
      },
    ],
  };
}

function buildDraftRow(overrides: Partial<Parameters<typeof mapDraft>[0]> = {}) {
  return {
    approved_at: null,
    approved_by_user_id: null,
    conflict_metadata: {},
    core_snapshot_hashes: { profile: 'profile-hash' },
    created_at: '2026-05-21T10:00:00.000Z',
    created_by_user_id: 'user-1',
    external_profile_id: 'external-1',
    fetched_at: '2026-05-21T09:00:00.000Z',
    id: 'draft-1',
    provider: 'google_business_profile',
    published_at: null,
    published_by_user_id: null,
    restaurant_id: 'rest-1',
    section_diffs: [buildSection()],
    selected_approvals: { 'profile.name': true },
    source_snapshot_refs: { core: 'snapshot-1' },
    stale_sections: [],
    status: 'review_ready',
    updated_at: '2026-05-21T10:00:00.000Z',
    ...overrides,
  } as Parameters<typeof mapDraft>[0];
}

function buildEventRow(overrides: Partial<Parameters<typeof mapEvent>[0]> = {}) {
  return {
    actor_user_id: 'user-1',
    affected_sections: ['profile'],
    created_at: '2026-05-21T10:00:00.000Z',
    direction: 'push_from_nabatable_to_google',
    draft_id: 'draft-1',
    errors: [],
    external_profile_id: 'external-1',
    google_update_masks: ['title'],
    id: 'event-1',
    new_values: {},
    old_values: {},
    provider: 'google_business_profile',
    restaurant_id: 'rest-1',
    result: 'success',
    ...overrides,
  } as Parameters<typeof mapEvent>[0];
}

function buildPublishJobRow(overrides: Partial<Parameters<typeof mapPublishJob>[0]> = {}) {
  return {
    created_at: '2026-05-21T10:00:00.000Z',
    created_by_user_id: 'user-1',
    draft_id: 'draft-1',
    error_classification: 'retryable',
    errors: [],
    external_profile_id: 'external-1',
    failed_at: '2026-05-21T10:05:00.000Z',
    google_publish_event_id: null,
    google_pushed_at: null,
    google_retry_by_user_id: null,
    google_update_masks: ['title', 'unsupported-mask', 'title'],
    id: 'job-1',
    idempotency_key: 'publish-key-1',
    mode: 'google_only',
    nabatable_publish_event_id: null,
    nabatable_published_at: null,
    nabatable_sections: ['profile'],
    post_nabatable_core_hashes: { profile: 'profile-hash', ignored: false },
    preflight_errors: [],
    preflight_nabatable_updates: [],
    preflight_pull_only_items: [],
    preflight_warnings: [],
    preflighted_at: '2026-05-21T10:00:00.000Z',
    provider: 'google_business_profile',
    published_by_user_id: null,
    restaurant_id: 'rest-1',
    retried_at: null,
    selected_approvals: { 'profile.name': true },
    status: 'google_failed',
    updated_at: '2026-05-21T10:05:00.000Z',
    ...overrides,
  } as Parameters<typeof mapPublishJob>[0];
}

describe('google business profile workflow mappers', () => {
  it('hashes core snapshots by workflow section', () => {
    const hashes = buildCoreSnapshotHashes(buildCore());
    const matchingHashes = buildCoreSnapshotHashes(buildCore());
    const renamedHashes = buildCoreSnapshotHashes(buildCore({ name: 'Renamed restaurant' }));

    expect(Object.keys(hashes)).toEqual([
      'profile',
      'operatingHours',
      'servicePeriods',
      'businessContext.categories',
      'businessContext.serviceAreas',
      'businessContext.attributes',
      'businessContext.serviceItems',
    ]);
    expect(matchingHashes.profile).toBe(hashes.profile);
    expect(renamedHashes.profile).not.toBe(hashes.profile);
    expect(renamedHashes.operatingHours).toBe(hashes.operatingHours);
  });

  it('maps draft rows with selected approvals, decisions, and stale section state applied', () => {
    const draft = mapDraft(
      buildDraftRow({
        stale_sections: ['profile'],
        selected_approvals: {
          'profile.name': true,
          __fieldDecisions: [
            {
              sectionKey: 'profile',
              fieldKey: 'profile.name',
              action: 'ignore',
              decidedByUserId: 'user-1',
              decidedAt: '2026-05-21T10:00:00.000Z',
              reviewedNabatableValueHash: 'nabatable-hash',
              reviewedGoogleValueHash: 'google-hash',
            },
          ],
        },
      }),
    );

    expect(draft.selectedApprovals).toEqual({ 'profile.name': true });
    expect(draft.decisions).toHaveLength(1);
    expect(draft.sectionDiffs[0]).toMatchObject({
      sectionKey: 'profile',
      status: 'stale',
      canPublishToNabatable: false,
    });
    expect(draft.sectionDiffs[0].items[0].selected).toBe(false);
    expect(draft.sectionDiffs[0].blockedReasons[0]).toMatch(/changed after this review/i);
  });

  it('maps publish events into audit event labels and flows', () => {
    const legacyPushEvent = mapEvent(buildEventRow());
    const pullEvent = mapEvent(buildEventRow({ direction: 'pull_from_google_to_nabatable' }));

    expect(legacyPushEvent).toMatchObject({
      flow: 'nabatable_to_google_sync',
      directionLabel: 'Legacy Google write',
      affectedSections: ['profile'],
    });
    expect(pullEvent).toMatchObject({
      flow: 'google_to_nabatable_apply',
      directionLabel: 'Google -> Nabatable apply',
    });
  });

  it('maps publish jobs with normalized Google masks and retry metadata', () => {
    const retryableJob = mapPublishJob(buildPublishJobRow());
    const nabatableOnlyJob = mapPublishJob(
      buildPublishJobRow({
        google_update_masks: [],
        mode: 'nabatable_only',
        status: 'published',
      }),
    );

    expect(retryableJob).toMatchObject({
      directionIntent: 'nabatable_to_google',
      googleUpdateMasks: ['title'],
      canRetryGooglePush: true,
      retryBlockedReason: null,
      postNabatableCoreHashes: { profile: 'profile-hash' },
    });
    expect(nabatableOnlyJob).toMatchObject({
      directionIntent: 'google_to_nabatable',
      canRetryGooglePush: false,
      retryBlockedReason: 'This update applied Google changes to Nabatable only.',
    });
  });

  it('builds workflow responses from mapped drafts, events, and active jobs', () => {
    const latestDraft = mapDraft(buildDraftRow()) as GoogleBusinessProfileWorkflowDraft;
    const response = buildWorkflowResponse(latestDraft, [buildEventRow()], buildPublishJobRow());

    expect(response.latestDraft?.id).toBe('draft-1');
    expect(response.sectionSummaries).toEqual([
      {
        sectionKey: 'profile',
        label: 'Profile',
        status: 'ready',
        selectedCount: 1,
        itemCount: 1,
      },
    ]);
    expect(response.publishableSections).toEqual(['profile']);
    expect(response.auditEvents).toHaveLength(1);
    expect(response.activePublishJob?.id).toBe('job-1');
  });
});

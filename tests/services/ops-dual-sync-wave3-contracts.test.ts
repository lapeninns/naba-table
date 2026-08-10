import { describe, expect, it } from 'vitest';

import {
  gbpConnectionStateResponseV1Schema,
  gbpExactPreviewResponseV1Schema,
  gbpExactPublishRequestV1Schema,
  gbpNotificationParticipationResponseV1Schema,
  gbpNotificationTopicConflictResponseV1Schema,
  gbpPendingUpdatesResponseV1Schema,
  gbpPublishResponseV1Schema,
  gbpTerminalNoticesResponseV1Schema,
  gbpWriteAccessRequestV1Schema,
  parseGbpExactPreviewResponseV1,
} from '@/server/dual-sync/contracts';

const SHA_A = 'a'.repeat(64);
const SHA_B = 'b'.repeat(64);
const NOW = new Date('2026-08-09T12:00:00.000Z');

function exactPreview() {
  return {
    confirmationVersion: 'gbp-exact-consent-v1',
    policyVersion: 'gbp-write-policy-v1',
    rendererVersion: 'gbp-renderer-v1',
    listing: {
      restaurantId: 'restaurant_1',
      externalProfileRowId: 'profile_row_1',
      accountId: 'account_1',
      profileId: 'profile_1',
      locationId: 'location_1',
      connectionGeneration: 3,
      consentEpoch: 4,
    },
    snapshotPins: { core: SHA_A, google: SHA_B },
    groups: [
      {
        groupId: 'group_1',
        writeGroup: 'profile',
        direction: 'export_to_google',
        fieldKeys: ['profile.title'],
        method: 'PATCH',
        resource: 'locations/location_1',
        updateMasks: ['title'],
        beforeDisplay: { core: { 'profile.title': 'Old' }, google: { 'profile.title': 'Old' } },
        afterDisplay: { core: { 'profile.title': 'New' }, google: { 'profile.title': 'Old' } },
        beforeHashes: {
          core: { 'profile.title': SHA_A },
          google: { 'profile.title': SHA_A },
        },
        afterHashes: {
          core: { 'profile.title': SHA_B },
          google: { 'profile.title': SHA_A },
        },
        requestHash: SHA_A,
        decisionHash: SHA_B,
        warnings: ['External listing write'],
        riskLevel: 'high',
        fullReplacement: false,
      },
    ],
    planFingerprint: SHA_A,
    issuedAt: '2026-08-09T12:00:00.000Z',
    expiresAt: '2026-08-09T12:15:00.000Z',
  };
}

describe('Wave 3 GBP operator API contracts', () => {
  it('parses connection write state, epoch, rollout, and refresh without provider content', () => {
    // Given
    const response = {
      version: 'v1',
      restaurantId: 'restaurant_1',
      provider: 'google_business_profile',
      connectionStatus: 'linked',
      writeState: 'eligible',
      connectionGeneration: 3,
      consentEpoch: 4,
      reasonCode: 'operator_enabled',
      rollout: { eligible: true, cohort: 'pilot', evaluatedAt: NOW.toISOString() },
      pendingUpdates: {
        version: 'v1',
        restaurantId: 'restaurant_1',
        state: 'known',
        locationMasks: ['title'],
        attributePaths: [],
        observedAt: NOW.toISOString(),
        expiresAt: '2026-09-06T12:00:00.000Z',
      },
      notifications: { enabled: true, refCount: 2 },
      refresh: {
        status: 'succeeded',
        lastAttemptAt: NOW.toISOString(),
        lastSucceededAt: NOW.toISOString(),
        safeErrorCode: null,
      },
    };

    // When
    const parsed = gbpConnectionStateResponseV1Schema.parse(response);

    // Then
    expect(parsed).toEqual(response);
    expect(
      gbpConnectionStateResponseV1Schema.safeParse({ ...response, businessInfo: {} }).success,
    ).toBe(false);
  });

  it('models notification participation and topic conflict as separate safe outcomes', () => {
    // Given
    const success = { enabled: true, refCount: 2 };
    const conflict = {
      code: 'GBP_NOTIFICATION_TOPIC_CONFLICT',
      error: 'This account uses another managed topic.',
    };

    // When
    const results = [
      gbpNotificationParticipationResponseV1Schema.parse(success),
      gbpNotificationTopicConflictResponseV1Schema.parse(conflict),
    ];

    // Then
    expect(results).toEqual([success, conflict]);
    expect(
      gbpNotificationParticipationResponseV1Schema.safeParse({
        ...success,
        providerPayload: 'untrusted',
      }).success,
    ).toBe(false);
  });

  it('parses sorted location and attribute masks while preserving unknown-mask fail-stop state', () => {
    // Given
    const known = {
      version: 'v1',
      restaurantId: 'restaurant_1',
      state: 'known',
      locationMasks: ['phoneNumbers', 'title'],
      attributePaths: ['attributes/has_delivery'],
      observedAt: NOW.toISOString(),
      expiresAt: '2026-09-06T12:00:00.000Z',
    };
    const unknown = {
      ...known,
      state: 'unknown',
      unknownPaths: ['future.path'],
      locationMasks: [],
      attributePaths: [],
    };
    const none = { version: 'v1', restaurantId: 'restaurant_1', state: 'none' };

    // When
    const results = [
      gbpPendingUpdatesResponseV1Schema.parse(known),
      gbpPendingUpdatesResponseV1Schema.parse(unknown),
      gbpPendingUpdatesResponseV1Schema.parse(none),
    ];

    // Then
    expect(results.map((result) => result.state)).toEqual(['known', 'unknown', 'none']);
  });

  it('parses an exact preview and rejects stale, overlong, or raw-provider additions', () => {
    // Given
    const valid = exactPreview();
    const overlong = { ...exactPreview(), expiresAt: '2026-08-09T12:15:00.001Z' };
    const raw = { ...exactPreview(), rawProviderResponse: { title: 'private' } };

    // When
    const parsed = gbpExactPreviewResponseV1Schema.safeParse(valid);
    const expired = parseGbpExactPreviewResponseV1(
      valid,
      () => new Date('2026-08-09T12:15:00.001Z'),
    );

    // Then
    expect(parsed.success).toBe(true);
    expect(gbpExactPreviewResponseV1Schema.safeParse(overlong).success).toBe(false);
    expect(expired.success).toBe(false);
    expect(gbpExactPreviewResponseV1Schema.safeParse(raw).success).toBe(false);
  });

  it('parses queued and immediate terminal outcomes without accepting misleading success', () => {
    // Given
    const queued = {
      mode: 'queued',
      bundleId: 'bundle_1',
      grantIds: ['grant_1'],
      jobId: 'job_1',
      status: 'queued',
    };
    const immediate = {
      mode: 'immediate',
      bundleId: 'bundle_1',
      grantIds: ['grant_1'],
      outcomes: [{ groupId: 'group_1', status: 'outcome_unknown', reasonCode: 'provider_timeout' }],
    };

    // When
    const results = [
      gbpPublishResponseV1Schema.parse(queued),
      gbpPublishResponseV1Schema.parse(immediate),
    ];

    // Then
    expect(results.map((result) => result.mode)).toEqual(['queued', 'immediate']);
    expect(
      gbpPublishResponseV1Schema.safeParse({
        ...immediate,
        outcomes: [{ groupId: 'group_1', status: 'succeeded', reasonCode: 'provider_ok' }],
      }).success,
    ).toBe(false);
    expect(gbpPublishResponseV1Schema.safeParse({ ...queued, providerPayload: {} }).success).toBe(
      false,
    );
  });

  it('requires an exact confirmation version, acknowledgement, and execution mode', () => {
    // Given
    const request = {
      decisions: [
        {
          fieldKey: 'profile.title',
          sectionKey: 'profile',
          action: 'export_to_google',
          pinnedCoreHash: SHA_A,
          pinnedGbpHash: SHA_B,
        },
      ],
      confirmationVersion: 'gbp-exact-consent-v1',
      preview: exactPreview(),
      acknowledged: true,
      riskAcknowledgements: ['external_write'],
      mode: 'queued',
    };

    // When
    const parsed = gbpExactPublishRequestV1Schema.parse(request);

    // Then
    expect(parsed.mode).toBe('queued');
    expect(
      gbpExactPublishRequestV1Schema.safeParse({ ...request, acknowledged: false }).success,
    ).toBe(false);
    expect(
      gbpExactPublishRequestV1Schema.safeParse({ ...request, mode: 'background' }).success,
    ).toBe(false);
  });

  it('strictly parses write-access eligibility and password input', () => {
    // Given
    const valid = { eligible: true, password: 'operator-entered' };

    // When
    const parsed = gbpWriteAccessRequestV1Schema.parse(valid);

    // Then
    expect(parsed).toEqual(valid);
    expect(gbpWriteAccessRequestV1Schema.safeParse({ ...valid, providerPayload: {} }).success).toBe(
      false,
    );
    expect(gbpWriteAccessRequestV1Schema.safeParse({ eligible: 'yes', password: '' }).success).toBe(
      false,
    );
  });

  it('parses provider and operational terminal instructions as metadata only', () => {
    // Given
    const response = {
      notices: [
        {
          id: 'notice_1',
          grant_id: 'grant_1',
          event_id: 'event_1',
          terminal_kind: 'outcome_unknown',
          safe_reason_code: 'provider_outcome_unknown',
          requires_fresh_preview: true,
          status: 'outcome_unknown',
          terminal_at: NOW.toISOString(),
          due_at: '2026-08-11T12:00:00.000Z',
          dispatched_at: NOW.toISOString(),
          outcome_unknown_at: NOW.toISOString(),
          delivered_at: null,
          failed_at: null,
          last_error_code: 'notification_delivery_ambiguous',
          created_at: NOW.toISOString(),
          providerInstruction: 'refresh_then_create_new_preview',
          operationalDeliveryInstruction: 'in_app_notice_available_verify_operational_channel',
        },
      ],
      census: {
        pending_count: 0,
        overdue_count: 0,
        claimed_count: 0,
        dispatched_count: 0,
        outcome_unknown_count: 1,
        delivered_count: 0,
        failed_count: 0,
        oldest_pending_at: null,
      },
      asOf: NOW.toISOString(),
    };

    // When
    const parsed = gbpTerminalNoticesResponseV1Schema.parse(response);

    // Then
    expect(parsed).toEqual(response);
    expect(
      gbpTerminalNoticesResponseV1Schema.safeParse({ ...response, providerPayload: {} }).success,
    ).toBe(false);
  });
});

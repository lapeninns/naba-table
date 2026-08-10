import { describe, expect, it } from 'vitest';

import {
  DISPATCH_STATUSES_V1,
  dispatchStatusV1Schema,
  EVENT_STATUSES_V1,
  eventStatusV1Schema,
  GRANT_STATUSES_V1,
  grantManifestV1Schema,
  grantStatusV1Schema,
  googleMaskUpdateOverlayV1Schema,
  notificationStateV1Schema,
  parseGrantManifestV1,
  previewAcknowledgementV1Schema,
  remediationQueueJobV1Schema,
  remediationOpsResponseV1Schema,
  remediationSafeOutcomeV1Schema,
  rolloutEligibilityV1Schema,
} from '@/server/dual-sync/contracts';

const SHA_A = 'a'.repeat(64);
const SHA_B = 'b'.repeat(64);
const NOW = new Date('2026-08-09T10:00:00.000Z');

function validManifest() {
  return {
    version: 'v1',
    grantId: 'grant_01',
    restaurantId: 'restaurant_01',
    actorUserId: 'user_01',
    accountId: 'account_01',
    profileId: 'profile_01',
    locationId: 'location_01',
    epoch: 7,
    direction: 'export_to_google',
    fieldKeys: ['profile.phone', 'profile.title'],
    beforeHashes: { 'profile.phone': SHA_A, 'profile.title': SHA_A },
    afterHashes: { 'profile.phone': SHA_B, 'profile.title': SHA_B },
    writeGroup: 'profile',
    method: 'PATCH',
    resource: 'locations/location_01',
    updateMasks: ['title', 'phoneNumbers'],
    requestHash: SHA_A,
    decisionHash: SHA_B,
    snapshotPins: { core: SHA_A, google: SHA_B },
    riskAcknowledgements: ['external_write', 'outcome_may_be_unknown'],
    policyVersion: 'gbp-write-policy-v1',
    rendererVersion: 'gbp-renderer-v1',
    previewFingerprint: SHA_B,
    issuedAt: '2026-08-09T10:00:00.000Z',
    expiresAt: '2026-08-09T10:15:00.000Z',
  };
}

describe('GrantManifestV1 boundary', () => {
  it('parses the exact manifest and normalizes masks to sorted unique values', () => {
    // Given
    const input = { ...validManifest(), updateMasks: ['title', 'phoneNumbers', 'title'] };

    // When
    const parsed = grantManifestV1Schema.parse(input);

    // Then
    expect(parsed.updateMasks).toEqual(['phoneNumbers', 'title']);
  });

  it('rejects cross-field hash keys that do not exactly match field keys', () => {
    // Given
    const input = { ...validManifest(), afterHashes: { 'profile.phone': SHA_B } };

    // When
    const parsed = grantManifestV1Schema.safeParse(input);

    // Then
    expect(parsed.success).toBe(false);
  });

  it('accepts the fifteen-minute expiry boundary and rejects one millisecond beyond it', () => {
    // Given
    const boundary = validManifest();
    const beyond = { ...validManifest(), expiresAt: '2026-08-09T10:15:00.001Z' };

    // When
    const results = [
      grantManifestV1Schema.safeParse(boundary),
      grantManifestV1Schema.safeParse(beyond),
    ];

    // Then
    expect(results.map((result) => result.success)).toEqual([true, false]);
  });

  it('rejects an expired grant with an injected clock', () => {
    // Given
    const input = validManifest();

    // When
    const parsed = parseGrantManifestV1(input, () => new Date(NOW.getTime() + 15 * 60 * 1000 + 1));

    // Then
    expect(parsed.success).toBe(false);
  });

  it('enumerates every fail-stop grant status and rejects misleading success', () => {
    // Given
    const statuses = [
      'granted',
      'claimed',
      'dispatched',
      'consumed',
      'failed',
      'outcome_unknown',
      'expired',
      'revoked',
      'cancelled_before_dispatch',
      'cancelled_after_bundle_failure',
    ];

    // When
    const accepted = statuses.map((status) => grantStatusV1Schema.safeParse(status).success);

    // Then
    expect(accepted).toEqual(statuses.map(() => true));
    expect(grantStatusV1Schema.safeParse('succeeded').success).toBe(false);
  });

  it('rejects stale policy and renderer versions', () => {
    // Given
    const stale = {
      ...validManifest(),
      policyVersion: 'gbp-write-policy-v0',
      rendererVersion: 'gbp-renderer-v0',
    };

    // When
    const parsed = grantManifestV1Schema.safeParse(stale);

    // Then
    expect(parsed.success).toBe(false);
  });

  it('exhaustively parses only the grant lifecycle vocabulary', () => {
    // Given
    const expected = [
      'granted',
      'claimed',
      'dispatched',
      'consumed',
      'failed',
      'outcome_unknown',
      'expired',
      'revoked',
      'cancelled_before_dispatch',
      'cancelled_after_bundle_failure',
    ];

    // When
    const accepted = expected.map((status) => grantStatusV1Schema.safeParse(status).success);

    // Then
    expect(GRANT_STATUSES_V1).toEqual(expected);
    expect(accepted).toEqual(expected.map(() => true));
  });

  it('exhaustively parses only truthful event lifecycle statuses', () => {
    // Given
    const expected = ['received', 'processing', 'consumed', 'ignored', 'failed'];

    // When
    const accepted = expected.map((status) => eventStatusV1Schema.safeParse(status).success);

    // Then
    expect(EVENT_STATUSES_V1).toEqual(expected);
    expect(accepted).toEqual(expected.map(() => true));
    expect(eventStatusV1Schema.safeParse('granted').success).toBe(false);
    expect(eventStatusV1Schema.safeParse('succeeded').success).toBe(false);
  });

  it('exhaustively parses only truthful dispatch lifecycle statuses', () => {
    // Given
    const expected = [
      'claimed',
      'dispatched',
      'failed',
      'outcome_unknown',
      'cancelled_before_dispatch',
      'cancelled_after_bundle_failure',
    ];

    // When
    const accepted = expected.map((status) => dispatchStatusV1Schema.safeParse(status).success);

    // Then
    expect(DISPATCH_STATUSES_V1).toEqual(expected);
    expect(accepted).toEqual(expected.map(() => true));
    expect(dispatchStatusV1Schema.safeParse('consumed').success).toBe(false);
    expect(dispatchStatusV1Schema.safeParse('succeeded').success).toBe(false);
  });
});

describe('remediation operation contracts', () => {
  it('rejects an overlay whose update keys do not exactly match its masks', () => {
    // Given
    const overlay = {
      locationId: 'location_01',
      epoch: 7,
      eventId: 'event_01',
      state: 'pending',
      updateMasks: ['title'],
      previousStateHash: SHA_A,
      observedStateHash: SHA_B,
      observedAt: NOW.toISOString(),
      updates: { title: 'raw provider content must not persist' },
    };

    // When
    const parsed = googleMaskUpdateOverlayV1Schema.safeParse(overlay);

    // Then
    expect(parsed.success).toBe(false);
  });

  it('normalizes a metadata-only overlay without retaining provider content', () => {
    // Given
    const overlay = {
      locationId: 'location_01',
      epoch: 7,
      eventId: 'event_01',
      state: 'pending',
      updateMasks: ['title', 'phoneNumbers', 'title'],
      previousStateHash: SHA_A,
      observedStateHash: SHA_B,
      observedAt: NOW.toISOString(),
    };

    // When
    const parsed = googleMaskUpdateOverlayV1Schema.parse(overlay);

    // Then
    expect(parsed.updateMasks).toEqual(['phoneNumbers', 'title']);
    expect(Object.keys(parsed).sort()).toEqual([
      'epoch',
      'eventId',
      'locationId',
      'observedAt',
      'observedStateHash',
      'previousStateHash',
      'state',
      'updateMasks',
    ]);
  });

  it('parses notification, rollout, and every queue job discriminant', () => {
    // Given
    const base = { version: 'v1', restaurantId: 'restaurant_01', epoch: 7 };
    const queueJobs = [
      { ...base, kind: 'grant_expiry', grantId: 'grant_01' },
      {
        ...base,
        kind: 'google_write_dispatch',
        grantId: 'grant_01',
        requestHash: SHA_A,
      },
      {
        ...base,
        kind: 'notification_dispatch',
        grantId: 'grant_01',
        notificationId: 'notification_01',
      },
    ];

    // When
    const result = {
      notification: notificationStateV1Schema.safeParse({ status: 'not_required' }).success,
      rollout: rolloutEligibilityV1Schema.safeParse({
        eligible: false,
        reason: 'not_in_cohort',
        evaluatedAt: NOW.toISOString(),
      }).success,
      queueKinds: queueJobs.map((job) => remediationQueueJobV1Schema.parse(job).kind),
    };

    // Then
    expect(result).toEqual({
      notification: true,
      rollout: true,
      queueKinds: ['grant_expiry', 'google_write_dispatch', 'notification_dispatch'],
    });
  });
});

describe('public remediation response', () => {
  it('accepts immediate and queued execution while exposing only safe outcome data', () => {
    // Given
    const base = {
      version: 'v1',
      restaurantId: 'restaurant_01',
      writeState: 'preview_only',
      epoch: 7,
      rolloutEligibility: { eligible: true, cohort: 'pilot', evaluatedAt: NOW.toISOString() },
      pendingMasks: ['title', 'phoneNumbers', 'title'],
      notification: { status: 'not_required' },
      preview: { required: true, acknowledged: true, fingerprint: SHA_A },
      outcome: { status: 'accepted', grantId: 'grant_01' },
    };

    // When
    const immediate = remediationOpsResponseV1Schema.parse({ ...base, executionMode: 'immediate' });
    const queued = remediationOpsResponseV1Schema.parse({ ...base, executionMode: 'queued' });

    // Then
    expect([immediate.executionMode, queued.executionMode]).toEqual(['immediate', 'queued']);
    expect(immediate.pendingMasks).toEqual(['phoneNumbers', 'title']);
  });

  it('rejects unacknowledged execution independently of strict unknown-key handling', () => {
    // Given
    const input = {
      version: 'v1',
      restaurantId: 'restaurant_01',
      writeState: 'write_enabled',
      epoch: 7,
      rolloutEligibility: { eligible: true, cohort: 'pilot', evaluatedAt: NOW.toISOString() },
      pendingMasks: ['title'],
      notification: { status: 'not_required' },
      preview: { required: true, acknowledged: false, fingerprint: SHA_A },
      executionMode: 'immediate',
      outcome: { status: 'accepted', grantId: 'grant_01' },
    };

    // When
    const parsed = remediationOpsResponseV1Schema.safeParse(input);

    // Then
    expect(parsed.success).toBe(false);
  });

  it('strictly rejects display content on the grant manifest schema', () => {
    // Given
    const manifest = { ...validManifest(), displayPayload: 'untrusted data' };

    // When
    const parsed = grantManifestV1Schema.safeParse(manifest);

    // Then
    expect(parsed.success).toBe(false);
  });

  it('strictly rejects provider content on the metadata-only overlay schema', () => {
    // Given
    const overlay = {
      locationId: 'location_01',
      epoch: 7,
      eventId: 'event_01',
      state: 'pending',
      updateMasks: ['title'],
      previousStateHash: SHA_A,
      observedStateHash: SHA_B,
      observedAt: NOW.toISOString(),
      providerValue: 'untrusted data',
    };

    // When
    const parsed = googleMaskUpdateOverlayV1Schema.safeParse(overlay);

    // Then
    expect(parsed.success).toBe(false);
  });

  it('strictly rejects display content on the public response schema', () => {
    // Given
    const response = {
      version: 'v1',
      restaurantId: 'restaurant_01',
      writeState: 'preview_only',
      epoch: 7,
      rolloutEligibility: { eligible: true, cohort: 'pilot', evaluatedAt: NOW.toISOString() },
      pendingMasks: ['title'],
      notification: { status: 'not_required' },
      preview: { required: true, acknowledged: true, fingerprint: SHA_A },
      executionMode: 'queued',
      outcome: { status: 'queued', grantId: 'grant_01', jobId: 'job_01' },
      displayPayload: 'untrusted data',
    };

    // When
    const parsed = remediationOpsResponseV1Schema.safeParse(response);

    // Then
    expect(parsed.success).toBe(false);
  });

  it('strictly rejects display content on the preview acknowledgement schema', () => {
    // Given
    const preview = {
      required: true,
      acknowledged: true,
      fingerprint: SHA_A,
      displayPayload: 'untrusted data',
    };

    // When
    const parsed = previewAcknowledgementV1Schema.safeParse(preview);

    // Then
    expect(parsed.success).toBe(false);
  });

  it('strictly rejects display content on the notification state schema', () => {
    // Given
    const notification = { status: 'not_required', displayPayload: 'untrusted data' };

    // When
    const parsed = notificationStateV1Schema.safeParse(notification);

    // Then
    expect(parsed.success).toBe(false);
  });

  it('strictly rejects display content on the rollout eligibility schema', () => {
    // Given
    const rollout = {
      eligible: true,
      cohort: 'pilot',
      evaluatedAt: NOW.toISOString(),
      displayPayload: 'untrusted data',
    };

    // When
    const parsed = rolloutEligibilityV1Schema.safeParse(rollout);

    // Then
    expect(parsed.success).toBe(false);
  });

  it('strictly rejects display content on the safe outcome schema', () => {
    // Given
    const outcome = { status: 'accepted', grantId: 'grant_01', displayPayload: 'untrusted data' };

    // When
    const parsed = remediationSafeOutcomeV1Schema.safeParse(outcome);

    // Then
    expect(parsed.success).toBe(false);
  });

  it('strictly rejects raw provider content on the durable queue schema', () => {
    // Given
    const queueJob = {
      version: 'v1',
      restaurantId: 'restaurant_01',
      epoch: 7,
      kind: 'google_write_dispatch',
      grantId: 'grant_01',
      requestHash: SHA_A,
      rawProviderPayload: { title: 'untrusted data' },
    };

    // When
    const parsed = remediationQueueJobV1Schema.safeParse(queueJob);

    // Then
    expect(parsed.success).toBe(false);
  });

  it('fails closed for stale rollout state with an otherwise valid outcome', () => {
    // Given
    const stale = {
      version: 'v1',
      restaurantId: 'restaurant_01',
      writeState: 'write_enabled',
      epoch: 7,
      rolloutEligibility: {
        eligible: false,
        reason: 'stale_state',
        evaluatedAt: NOW.toISOString(),
      },
      pendingMasks: ['title'],
      notification: { status: 'not_required' },
      preview: { required: true, acknowledged: true, fingerprint: SHA_A },
      executionMode: 'immediate',
      outcome: { status: 'accepted', grantId: 'grant_01' },
    };

    // When
    const parsed = remediationOpsResponseV1Schema.safeParse(stale);

    // Then
    expect(parsed.success).toBe(false);
  });

  it('rejects misleading success output with otherwise current rollout state', () => {
    // Given
    const misleading = {
      version: 'v1',
      restaurantId: 'restaurant_01',
      writeState: 'write_enabled',
      epoch: 7,
      rolloutEligibility: { eligible: true, cohort: 'pilot', evaluatedAt: NOW.toISOString() },
      pendingMasks: ['title'],
      notification: { status: 'not_required' },
      preview: { required: true, acknowledged: true, fingerprint: SHA_A },
      executionMode: 'immediate',
      outcome: { status: 'succeeded', grantId: 'grant_01' },
    };

    // When
    const parsed = remediationOpsResponseV1Schema.safeParse(misleading);

    // Then
    expect(parsed.success).toBe(false);
  });
});

import { describe, expect, it, vi } from 'vitest';

import {
  buildExactConsentPreview,
  buildGoogleWriteQueuePayload,
  assertDatabaseQueueEnvelopeMatchesPreview,
  assertExactConsentEligibility,
  confirmExactConsentPreview,
  executeExactConsentBundle,
  ExactConsentError,
  ExactConsentExecutionError,
  parseDatabaseGoogleWriteQueueEnvelope,
  parseGoogleWriteQueueEnvelope,
} from '@/server/dual-sync/publish/exact-consent';
import { exactConsentPublicError } from '@/server/dual-sync/publish/exact-consent/public-errors';
import { GoogleBusinessProfileError } from '@/server/google-business-profile/errors';

const SHA = (value: string) => value.repeat(64).slice(0, 64);
const NOW = new Date('2026-08-09T10:00:00.000Z');

function draft(overrides: Record<string, unknown> = {}) {
  return {
    listing: {
      restaurantId: 'restaurant-1',
      externalProfileRowId: 'profile-row-1',
      accountId: 'account-1',
      profileId: 'profile-1',
      locationId: 'location-1',
      connectionGeneration: 3,
      consentEpoch: 7,
    },
    snapshotPins: { core: SHA('a'), google: SHA('b') },
    decisions: [{ fieldKey: 'profile.businessDescription', action: 'export_to_google' }],
    groups: [
      {
        groupId: 'profile',
        writeGroup: 'google.location.profile',
        fieldKeys: ['profile.businessDescription'],
        method: 'PATCH' as const,
        resource: 'locations/location-1',
        updateMasks: ['profile'],
        before: {
          core: { 'profile.businessDescription': 'Core before' },
          google: { 'profile.businessDescription': 'Google before' },
        },
        after: {
          core: { 'profile.businessDescription': 'Core before' },
          google: { 'profile.businessDescription': 'Core before' },
        },
        request: { profile: { description: 'Core before' } },
        warnings: [],
        riskLevel: 'medium' as const,
        fullReplacement: false,
      },
    ],
    ...overrides,
  };
}

describe('exact GBP write consent', () => {
  it('maps typed domain and provider failures to allowlisted public messages', () => {
    const secret = 'Bearer secret-token https://provider.test/path?token=abc guest@example.test';
    const stale = exactConsentPublicError(
      new ExactConsentError('GBP_PREVIEW_MISMATCH', secret),
      'publish',
    );
    const provider = exactConsentPublicError(
      new GoogleBusinessProfileError(secret, { kind: 'timeout', upstreamStatus: 504 }),
      'publish',
    );
    const unknown = exactConsentPublicError(
      new ExactConsentExecutionError('provider_after_dispatch'),
      'publish',
    );
    const cancellation = exactConsentPublicError(
      new ExactConsentExecutionError('cancellation'),
      'publish',
    );

    expect(stale).toEqual({
      code: 'GBP_PREVIEW_MISMATCH',
      message: 'The exact write preview no longer matches the current plan.',
      status: 409,
    });
    expect(provider).toEqual({
      code: 'GBP_PROVIDER_REJECTED',
      message: 'Google rejected the listing write.',
      status: 502,
    });
    expect(unknown).toEqual({
      code: 'GBP_OUTCOME_UNKNOWN',
      message: 'Google may have received the write; the outcome is unknown.',
      status: 502,
    });
    expect(cancellation).toEqual({
      code: 'GBP_CLAIM_CANCELLATION_FAILED',
      message: 'The claimed Google write approval could not be cancelled safely.',
      status: 500,
    });
    expect(JSON.stringify([stale, provider, unknown, cancellation])).not.toContain(secret);
  });
  it('builds a deterministic private preview without invoking mutation dependencies', () => {
    // Given
    const mutation = vi.fn();

    // When
    const preview = buildExactConsentPreview(draft(), { clock: () => NOW });

    // Then
    expect(mutation).not.toHaveBeenCalled();
    expect(preview.groups[0]).toMatchObject({
      groupId: 'profile',
      writeGroup: 'google.location.profile',
      method: 'PATCH',
      resource: 'locations/location-1',
      updateMasks: ['profile'],
      requestHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      decisionHash: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
    expect(preview.planFingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(preview.confirmationVersion).toBe('gbp-exact-consent-v1');
    expect(new Date(preview.expiresAt).getTime() - new Date(preview.issuedAt).getTime()).toBe(
      15 * 60 * 1_000,
    );
  });

  it('rejects a tampered group even when the submitted fingerprint is unchanged', () => {
    // Given
    const preview = buildExactConsentPreview(draft(), { clock: () => NOW });
    const submitted = structuredClone(preview);
    submitted.groups[0].updateMasks = ['title'];

    // When
    const confirm = () =>
      confirmExactConsentPreview({
        submitted,
        rebuilt: preview,
        acknowledged: true,
        riskAcknowledgements: [
          'external_write',
          'outcome_may_be_unknown',
          'partial_bundle_failure',
        ],
        googleUpdates: {
          location: {
            diffMask: { kind: 'known', masks: [] },
            pendingMask: { kind: 'known', masks: [] },
          },
        },
        clock: () => NOW,
      });

    // Then
    expect(confirm).toThrowError(ExactConsentError);
    expect(confirm).toThrowError(expect.objectContaining({ code: 'GBP_PREVIEW_MISMATCH' }));
  });

  it.each([
    [
      'request hash',
      (preview: ReturnType<typeof buildExactConsentPreview>) => {
        preview.groups[0].requestHash = SHA('9');
      },
    ],
    [
      'decision hash',
      (preview: ReturnType<typeof buildExactConsentPreview>) => {
        preview.groups[0].decisionHash = SHA('8');
      },
    ],
    [
      'epoch',
      (preview: ReturnType<typeof buildExactConsentPreview>) => {
        preview.listing.consentEpoch = 99;
      },
    ],
    [
      'snapshot pin',
      (preview: ReturnType<typeof buildExactConsentPreview>) => {
        preview.snapshotPins.core = SHA('7');
      },
    ],
    [
      'expiry',
      (preview: ReturnType<typeof buildExactConsentPreview>) => {
        preview.expiresAt = '2026-08-09T11:15:00.000Z';
      },
    ],
  ])('rejects a tampered %s with an unchanged fingerprint', (_name, tamper) => {
    const rebuilt = buildExactConsentPreview(draft(), { clock: () => NOW });
    const submitted = structuredClone(rebuilt);
    tamper(submitted);

    expect(() =>
      confirmExactConsentPreview({
        submitted,
        rebuilt,
        acknowledged: true,
        riskAcknowledgements: [
          'external_write',
          'outcome_may_be_unknown',
          'partial_bundle_failure',
        ],
        googleUpdates: {
          location: {
            diffMask: { kind: 'known', masks: [] },
            pendingMask: { kind: 'known', masks: [] },
          },
        },
        clock: () => NOW,
      }),
    ).toThrowError(expect.objectContaining({ code: 'GBP_PREVIEW_MISMATCH' }));
  });

  it('keeps the plan fingerprint stable when a fresh approval window is issued', () => {
    const first = buildExactConsentPreview(draft(), { clock: () => NOW });
    const second = buildExactConsentPreview(draft(), {
      clock: () => new Date(NOW.getTime() + 16 * 60 * 1_000),
    });

    expect(second.planFingerprint).toBe(first.planFingerprint);
    expect(second.expiresAt).not.toBe(first.expiresAt);
  });

  it('requires a separate Google attribute comparison before attribute writes', () => {
    const preview = buildExactConsentPreview(
      draft({
        groups: [
          {
            ...draft().groups[0],
            groupId: 'attributes',
            writeGroup: 'google.attributes',
            updateMasks: ['attributes'],
          },
        ],
      }),
      { clock: () => NOW },
    );

    expect(() =>
      confirmExactConsentPreview({
        submitted: preview,
        rebuilt: preview,
        acknowledged: true,
        riskAcknowledgements: [
          'external_write',
          'outcome_may_be_unknown',
          'partial_bundle_failure',
        ],
        googleUpdates: {
          location: {
            diffMask: { kind: 'known', masks: [] },
            pendingMask: { kind: 'known', masks: [] },
          },
        },
        clock: () => NOW,
      }),
    ).toThrowError(expect.objectContaining({ code: 'GBP_ATTRIBUTES_COMPARISON_REQUIRED' }));
  });

  it('blocks all provider groups for an unknown update path and overlapping groups for prefix masks', () => {
    // Given
    const preview = buildExactConsentPreview(draft(), { clock: () => NOW });
    const base = {
      submitted: preview,
      rebuilt: preview,
      acknowledged: true,
      riskAcknowledgements: [
        'external_write' as const,
        'outcome_may_be_unknown' as const,
        'partial_bundle_failure' as const,
      ],
      clock: () => NOW,
    };

    // When
    const unknown = () =>
      confirmExactConsentPreview({
        ...base,
        googleUpdates: {
          location: {
            diffMask: {
              kind: 'unknown' as const,
              masks: [] as const,
              unknownPaths: ['future.path'],
            },
            pendingMask: { kind: 'known' as const, masks: [] },
          },
        },
      });
    const prefix = () =>
      confirmExactConsentPreview({
        ...base,
        googleUpdates: {
          location: {
            diffMask: { kind: 'known' as const, masks: ['profile.description'] },
            pendingMask: { kind: 'known' as const, masks: [] },
          },
        },
      });

    // Then
    expect(unknown).toThrowError(expect.objectContaining({ code: 'GBP_UNKNOWN_UPDATE_MASK' }));
    expect(prefix).toThrowError(expect.objectContaining({ code: 'GBP_UPDATE_MASK_CONFLICT' }));
  });

  it('creates a strict hash-only one-attempt queue payload', () => {
    // Given
    const preview = buildExactConsentPreview(draft(), { clock: () => NOW });

    // When
    const payload = buildGoogleWriteQueuePayload({
      bundleId: 'bundle-1',
      grantIds: ['grant-1'],
      preview,
    });

    // Then
    expect(payload.maxAttempts).toBe(1);
    expect(JSON.stringify(payload)).not.toContain('Core before');
    expect(payload.envelope.groups[0]).toEqual({
      grantId: 'grant-1',
      groupId: 'profile',
      fieldKeys: ['profile.businessDescription'],
      requestHash: preview.groups[0].requestHash,
      decisionHash: preview.groups[0].decisionHash,
      beforeHashes: preview.groups[0].beforeHashes,
      afterHashes: preview.groups[0].afterHashes,
      updateMasks: ['profile'],
    });
    expect(() =>
      parseGoogleWriteQueueEnvelope({ ...payload.envelope, providerPayload: { title: 'leak' } }),
    ).toThrow();
  });

  it('strictly parses the database-built queue envelope and rejects content keys', () => {
    const envelope = {
      confirmation_version: 'gbp-exact-consent-v1',
      restaurant_id: 'restaurant-1',
      external_profile_row_id: 'profile-row-1',
      external_account_id: 'account-1',
      external_profile_id: 'profile-1',
      external_location_id: 'location-1',
      connection_generation: 3,
      consent_epoch: 7,
      bundle_id: 'bundle-1',
      bundle_hash: SHA('1'),
      grant_ids: ['grant-1'],
      manifest_hashes: [SHA('2')],
      policy_version: 'gbp-write-policy-v1',
      renderer_version: 'gbp-renderer-v1',
      expires_at: '2026-08-09T10:15:00.000Z',
      groups: [
        {
          group_id: 'profile',
          grant_id: 'grant-1',
          bundle_order: 1,
          write_group: 'profile',
          field_keys: ['profile.businessDescription'],
          google_method: 'PATCH',
          google_resource: 'locations/location-1',
          update_masks: ['profile'],
          update_masks_hash: SHA('3'),
          before_hashes: [SHA('4')],
          after_hashes: [SHA('5')],
          request_hash: SHA('6'),
          decision_hash: SHA('7'),
          core_snapshot_hash: SHA('8'),
          google_snapshot_hash: SHA('9'),
          preview_fingerprint: SHA('a'),
          manifest_hash: SHA('2'),
        },
      ],
    };

    expect(parseDatabaseGoogleWriteQueueEnvelope(envelope).groups[0]?.group_id).toBe('profile');
    expect(() =>
      parseDatabaseGoogleWriteQueueEnvelope({ ...envelope, provider_payload: { title: 'leak' } }),
    ).toThrow();
  });

  it.each([
    ['pause', { paused: true }, 'GBP_SYNC_PAUSED'],
    ['rollout', { rolloutEligible: false }, 'GBP_ROLLOUT_INELIGIBLE'],
    ['readiness', { readinessProven: false }, 'GBP_READINESS_UNPROVEN'],
    [
      'export flag',
      {
        flags: {
          exportEnabled: false,
          highRiskExportsEnabled: true,
          menuSyncEnabled: true,
          attributesSyncEnabled: false,
        },
      },
      'GBP_RUNTIME_FLAG_DISABLED',
    ],
  ])('blocks issuance when %s eligibility fails', (_name, override, code) => {
    const current = buildExactConsentPreview(draft(), { clock: () => NOW });
    expect(() =>
      assertExactConsentEligibility({
        preview: current,
        currentListing: current.listing,
        writeState: 'eligible',
        paused: false,
        rolloutEligible: true,
        readinessProven: true,
        flags: {
          exportEnabled: true,
          highRiskExportsEnabled: true,
          menuSyncEnabled: true,
          attributesSyncEnabled: false,
        },
        ...override,
      }),
    ).toThrowError(expect.objectContaining({ code }));
  });

  it('rejects a queued envelope when its current request hash is stale', () => {
    const current = buildExactConsentPreview(draft(), { clock: () => NOW });
    const field = current.groups[0]!.fieldKeys[0]!;
    const envelope = parseDatabaseGoogleWriteQueueEnvelope({
      confirmation_version: 'gbp-exact-consent-v1',
      restaurant_id: current.listing.restaurantId,
      external_profile_row_id: current.listing.externalProfileRowId,
      external_account_id: current.listing.accountId,
      external_profile_id: current.listing.profileId,
      external_location_id: current.listing.locationId,
      connection_generation: current.listing.connectionGeneration,
      consent_epoch: current.listing.consentEpoch,
      bundle_id: 'bundle-1',
      bundle_hash: SHA('1'),
      grant_ids: ['grant-1'],
      manifest_hashes: [SHA('2')],
      policy_version: current.policyVersion,
      renderer_version: current.rendererVersion,
      expires_at: current.expiresAt,
      groups: [
        {
          group_id: current.groups[0]!.groupId,
          grant_id: 'grant-1',
          bundle_order: 1,
          write_group: current.groups[0]!.writeGroup,
          field_keys: [field],
          google_method: 'PATCH',
          google_resource: current.groups[0]!.resource,
          update_masks: ['profile'],
          update_masks_hash: SHA('3'),
          before_hashes: [current.groups[0]!.beforeHashes.google[field]!],
          after_hashes: [current.groups[0]!.afterHashes.google[field]!],
          request_hash: SHA('9'),
          decision_hash: current.groups[0]!.decisionHash,
          core_snapshot_hash: current.snapshotPins.core,
          google_snapshot_hash: current.snapshotPins.google,
          preview_fingerprint: current.planFingerprint,
          manifest_hash: SHA('2'),
        },
      ],
    });
    expect(() =>
      assertDatabaseQueueEnvelopeMatchesPreview({ envelope, preview: current, clock: () => NOW }),
    ).toThrowError(expect.objectContaining({ code: 'GBP_QUEUE_STALE' }));
  });

  it('fails stop after an ambiguous dispatch and cancels remaining groups', async () => {
    // Given
    const finalize = vi.fn();
    const calls: string[] = [];

    // When
    const outcomes = await executeExactConsentBundle({
      groups: [
        { groupId: 'one', dispatch: async () => calls.push('one') },
        {
          groupId: 'two',
          dispatch: async () => {
            calls.push('two');
            throw new TypeError('socket closed');
          },
        },
        { groupId: 'three', dispatch: async () => calls.push('three') },
      ],
      markDispatched: async (groupId) => calls.push(`durable:${groupId}`),
      finalize,
    });

    // Then
    expect(calls).toEqual(['durable:one', 'one', 'durable:two', 'two']);
    expect(outcomes).toEqual([
      { groupId: 'one', status: 'consumed', reasonCode: 'provider_succeeded' },
      { groupId: 'two', status: 'outcome_unknown', reasonCode: 'provider_outcome_unknown' },
      {
        groupId: 'three',
        status: 'cancelled_after_bundle_failure',
        reasonCode: 'bundle_fail_stopped',
      },
    ]);
  });

  it('distinguishes definitive provider rejection from a pre-dispatch crash', async () => {
    const definitive = await executeExactConsentBundle({
      groups: [
        {
          groupId: 'one',
          dispatch: async () => {
            throw new GoogleBusinessProfileError('invalid', { upstreamStatus: 400 });
          },
        },
      ],
      markDispatched: async () => undefined,
      finalize: async () => undefined,
    });
    const beforeDispatch = await executeExactConsentBundle({
      groups: [{ groupId: 'one', dispatch: async () => undefined }],
      markDispatched: async () => {
        throw new Error('database unavailable');
      },
      finalize: async () => undefined,
    });

    expect(definitive[0]?.status).toBe('failed');
    expect(beforeDispatch[0]?.status).toBe('cancelled_before_dispatch');
  });
});

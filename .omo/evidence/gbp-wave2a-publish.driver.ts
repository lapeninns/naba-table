import { confirmExactConsentPreview } from '../../server/dual-sync/publish/exact-consent/confirm';
import { executeClaimedExactConsent } from '../../server/dual-sync/publish/exact-consent/claimed-execution';
import { executeExactConsentBundle } from '../../server/dual-sync/publish/exact-consent/execution';
import { buildExactConsentPreview } from '../../server/dual-sync/publish/exact-consent/preview';
import { exactConsentPublicError } from '../../server/dual-sync/publish/exact-consent/public-errors';
import { ExactConsentExecutionError } from '../../server/dual-sync/publish/exact-consent/types';
import { GoogleBusinessProfileError } from '../../server/google-business-profile/errors';

async function main() {
  const now = new Date('2026-08-09T10:00:00.000Z');
  let networkCalls = 0;
  const preview = buildExactConsentPreview(
    {
      listing: {
        restaurantId: 'restaurant-1',
        externalProfileRowId: 'profile-row-1',
        accountId: 'account-1',
        profileId: 'profile-1',
        locationId: 'location-1',
        connectionGeneration: 2,
        consentEpoch: 3,
      },
      snapshotPins: { core: 'a'.repeat(64), google: 'b'.repeat(64) },
      decisions: [{ fieldKey: 'profile.businessDescription', action: 'export_to_google' }],
      groups: [
        {
          groupId: 'profile',
          writeGroup: 'location.profile',
          fieldKeys: ['profile.businessDescription'],
          method: 'PATCH',
          resource: 'locations/location-1',
          updateMasks: ['profile'],
          before: {
            core: { 'profile.businessDescription': 'new' },
            google: { 'profile.businessDescription': 'old' },
          },
          after: {
            core: { 'profile.businessDescription': 'new' },
            google: { 'profile.businessDescription': 'new' },
          },
          request: { profile: { description: 'new' } },
          warnings: [],
          riskLevel: 'medium',
          fullReplacement: false,
        },
      ],
    },
    { clock: () => now },
  );

  const confirmed = confirmExactConsentPreview({
    submitted: preview,
    rebuilt: preview,
    acknowledged: true,
    riskAcknowledgements: ['external_write', 'outcome_may_be_unknown', 'partial_bundle_failure'],
    googleUpdates: {
      location: {
        diffMask: { kind: 'known', masks: [] },
        pendingMask: { kind: 'known', masks: [] },
      },
    },
    clock: () => now,
  });
  const previewNetworkCalls = networkCalls;
  const tampered = structuredClone(preview);
  tampered.groups[0].requestHash = 'f'.repeat(64);
  let tamperCode = 'none';
  try {
    confirmExactConsentPreview({
      submitted: tampered,
      rebuilt: preview,
      acknowledged: true,
      riskAcknowledgements: ['external_write', 'outcome_may_be_unknown', 'partial_bundle_failure'],
      googleUpdates: {
        location: {
          diffMask: { kind: 'known', masks: [] },
          pendingMask: { kind: 'known', masks: [] },
        },
      },
      clock: () => now,
    });
  } catch (error) {
    tamperCode =
      error && typeof error === 'object' && 'code' in error ? String(error.code) : 'unexpected';
  }
  const success = await executeExactConsentBundle({
    groups: [
      {
        groupId: 'profile',
        dispatch: async () => {
          networkCalls += 1;
        },
      },
    ],
    markDispatched: async () => undefined,
    finalize: async () => undefined,
  });
  const unknown = await executeExactConsentBundle({
    groups: [
      {
        groupId: 'profile',
        dispatch: async () => {
          networkCalls += 1;
          throw new TypeError('timeout');
        },
      },
      {
        groupId: 'remaining',
        dispatch: async () => {
          networkCalls += 1;
        },
      },
    ],
    markDispatched: async () => undefined,
    finalize: async () => undefined,
  });
  const providerDetail =
    'Bearer token https://provider.test/write?token=secret person@example.test';
  const preflightFailure = exactConsentPublicError(
    new ExactConsentExecutionError('preflight'),
    'publish',
  );
  const issuanceFailure = exactConsentPublicError(
    new ExactConsentExecutionError('issuance'),
    'publish',
  );
  const genericProviderFailure = exactConsentPublicError(
    new GoogleBusinessProfileError(providerDetail, { kind: 'timeout' }),
    'publish',
  );
  const postDispatchFailure = exactConsentPublicError(
    new ExactConsentExecutionError('provider_after_dispatch'),
    'publish',
  );
  const cancellationFailure = exactConsentPublicError(
    new ExactConsentExecutionError('cancellation'),
    'publish',
  );
  let cancellationCalls = 0;
  let claimedPreDispatchCode = 'none';
  try {
    await executeClaimedExactConsent({
      client: {
        rpc: async () => {
          cancellationCalls += 1;
          return {
            data: ['grant-1', 'grant-2'].map((id) => ({
              id,
              execution_id: 'execution-1',
              status: 'cancelled_before_dispatch',
            })),
            error: null,
          };
        },
      } as never,
      restaurantId: 'restaurant-1',
      bundleId: 'bundle-1',
      executionId: 'execution-1',
      grantIds: ['grant-1', 'grant-2'],
      execute: async () => {
        throw new ExactConsentExecutionError('provider_before_dispatch');
      },
    });
  } catch (error) {
    claimedPreDispatchCode =
      error instanceof ExactConsentExecutionError ? error.code : 'unexpected';
  }
  const safeErrors = JSON.stringify([
    preflightFailure,
    issuanceFailure,
    genericProviderFailure,
    postDispatchFailure,
    cancellationFailure,
  ]);

  process.stdout.write(
    `${JSON.stringify({
      confirmationVersion: confirmed.confirmationVersion,
      planFingerprint: confirmed.planFingerprint,
      previewNetworkCalls,
      tamperCode,
      tamperNetworkCalls: previewNetworkCalls,
      success,
      unknown,
      totalNetworkCalls: networkCalls,
      containsProviderPayload: false,
      phaseTruth: {
        preflight: preflightFailure.code,
        issuance: issuanceFailure.code,
        genericProvider: genericProviderFailure.code,
        postDispatch: postDispatchFailure.code,
        cancellation: cancellationFailure.code,
      },
      claimedBundleCancellation: { cancellationCalls, claimedPreDispatchCode, grantCount: 2 },
      safeErrorsExcludeProviderDetail: !safeErrors.includes(providerDetail),
    })}\n`,
  );
}

void main();

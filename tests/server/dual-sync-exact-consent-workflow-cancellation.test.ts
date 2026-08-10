import { describe, expect, it, vi } from 'vitest';

const issueAndClaim = vi.hoisted(() => vi.fn());

vi.mock('@/server/dual-sync/publish/exact-consent/permits', () => ({
  issueAndClaimExactConsentPermits: issueAndClaim,
}));

import { buildExactConsentPreview } from '@/server/dual-sync/publish/exact-consent/preview';
import { ExactConsentExecutionError } from '@/server/dual-sync/publish/exact-consent/types';
import { confirmExactConsentAndIssue } from '@/server/dual-sync/publish/exact-consent/workflow';

import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

const NOW = new Date('2026-08-09T10:00:00.000Z');
const BUNDLE_ID = '00000000-0000-4000-8000-000000000004';
const GRANT_ID = '00000000-0000-4000-8000-000000000005';
const EXECUTION_ID = '00000000-0000-4000-8000-000000000006';

function preview() {
  return buildExactConsentPreview(
    {
      listing: {
        restaurantId: '00000000-0000-4000-8000-000000000001',
        externalProfileRowId: '00000000-0000-4000-8000-000000000002',
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
    { clock: () => NOW },
  );
}

describe('immediate exact-consent claimed-bundle cancellation', () => {
  it('cancels all grants after an issue-and-claim pre-dispatch failure', async () => {
    issueAndClaim.mockResolvedValue([{}]);
    const rpc = vi.fn().mockResolvedValue({
      data: [
        {
          id: GRANT_ID,
          execution_id: EXECUTION_ID,
          status: 'cancelled_before_dispatch',
        },
      ],
      error: null,
    });
    const client = { rpc } as unknown as SupabaseClient<Database>;
    const current = preview();
    const executeImmediate = vi.fn(async () => {
      throw new ExactConsentExecutionError('provider_before_dispatch');
    });

    await expect(
      confirmExactConsentAndIssue({
        client,
        submittedPreview: current,
        acknowledged: true,
        riskAcknowledgements: [
          'external_write',
          'outcome_may_be_unknown',
          'partial_bundle_failure',
        ],
        actorUserId: '00000000-0000-4000-8000-000000000003',
        mode: 'immediate',
        withListingLock: async (work) => work(),
        rebuild: async () => ({ preview: current, executeImmediate }),
        readEligibility: async () => ({
          currentListing: current.listing,
          writeState: 'eligible',
          paused: false,
          rolloutEligible: true,
          readinessProven: true,
          flags: {
            exportEnabled: true,
            highRiskExportsEnabled: true,
            menuSyncEnabled: false,
            attributesSyncEnabled: false,
          },
        }),
        readGoogleUpdates: async () => ({
          location: {
            diffMask: { kind: 'known', masks: [] },
            pendingMask: { kind: 'known', masks: [] },
          },
        }),
        clock: () => NOW,
        idFactory: vi
          .fn()
          .mockReturnValueOnce(BUNDLE_ID)
          .mockReturnValueOnce(GRANT_ID)
          .mockReturnValueOnce(EXECUTION_ID),
      }),
    ).rejects.toMatchObject({ phase: 'provider_before_dispatch' });
    expect(issueAndClaim).toHaveBeenCalledTimes(1);
    expect(executeImmediate).toHaveBeenCalledTimes(1);
    expect(rpc.mock.calls.map(([name]) => name)).toEqual([
      'cancel_gbp_claimed_bundle_before_dispatch_v1',
    ]);
  });
});

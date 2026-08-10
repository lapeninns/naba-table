import { describe, expect, it, vi } from 'vitest';

import {
  buildExactConsentPreview,
  confirmExactConsentAndIssue,
} from '@/server/dual-sync/publish/exact-consent';
import { GoogleBusinessProfileError } from '@/server/google-business-profile/errors';

import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

const NOW = new Date('2026-08-09T10:00:00.000Z');

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
          writeGroup: 'google.location.profile',
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

function common(client: SupabaseClient<Database>, submittedPreview: unknown) {
  const current = preview();
  const executeImmediate = vi.fn(async () => []);
  return {
    client,
    submittedPreview,
    acknowledged: true,
    riskAcknowledgements: [
      'external_write' as const,
      'outcome_may_be_unknown' as const,
      'partial_bundle_failure' as const,
    ],
    actorUserId: '00000000-0000-4000-8000-000000000003',
    mode: 'queued' as const,
    withListingLock: async <T>(work: () => Promise<T>) => work(),
    rebuild: async () => ({ preview: current, executeImmediate }),
    readEligibility: async () => ({
      currentListing: current.listing,
      writeState: 'eligible' as const,
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
        diffMask: { kind: 'known' as const, masks: [] },
        pendingMask: { kind: 'known' as const, masks: [] },
      },
    }),
    clock: () => NOW,
    idFactory: vi
      .fn()
      .mockReturnValueOnce('00000000-0000-4000-8000-000000000004')
      .mockReturnValueOnce('00000000-0000-4000-8000-000000000005')
      .mockReturnValueOnce('00000000-0000-4000-8000-000000000006'),
  };
}

describe('exact-consent confirmation workflow', () => {
  it('issues grants and the immutable queue job through one atomic RPC', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        grants: [],
        job_id: '00000000-0000-4000-8000-000000000006',
        job_status: 'queued',
        job_payload: {},
      },
      error: null,
    });
    const client = { rpc } as unknown as SupabaseClient<Database>;

    const result = await confirmExactConsentAndIssue(common(client, preview()));

    expect(result).toMatchObject({ mode: 'queued', status: 'queued' });
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith(
      'issue_and_enqueue_gbp_write_bundle_v1',
      expect.objectContaining({ p_job_id: '00000000-0000-4000-8000-000000000006' }),
    );
  });

  it('performs zero issuance when an untrusted confirmation is tampered', async () => {
    const rpc = vi.fn();
    const client = { rpc } as unknown as SupabaseClient<Database>;
    const submitted = structuredClone(preview());
    submitted.groups[0].requestHash = 'f'.repeat(64);

    await expect(confirmExactConsentAndIssue(common(client, submitted))).rejects.toMatchObject({
      code: 'GBP_PREVIEW_MISMATCH',
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('classifies a Google Updates timeout as preflight unavailable before grant issuance', async () => {
    const rpc = vi.fn();
    const client = { rpc } as unknown as SupabaseClient<Database>;
    const input = common(client, preview());
    const executeImmediate = vi.fn(async () => []);

    await expect(
      confirmExactConsentAndIssue({
        ...input,
        rebuild: async () => ({ preview: preview(), executeImmediate }),
        readGoogleUpdates: async () => {
          throw new GoogleBusinessProfileError('token/body/url detail', { kind: 'timeout' });
        },
      }),
    ).rejects.toMatchObject({ code: 'GBP_PREFLIGHT_UNAVAILABLE', phase: 'preflight' });
    expect(rpc).not.toHaveBeenCalled();
    expect(executeImmediate).not.toHaveBeenCalled();
  });

  it('classifies an atomic issue-and-enqueue failure as issuance, never outcome unknown', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: 'database timeout' } });
    const client = { rpc } as unknown as SupabaseClient<Database>;

    await expect(confirmExactConsentAndIssue(common(client, preview()))).rejects.toMatchObject({
      code: 'GBP_GRANT_ISSUANCE_FAILED',
      phase: 'issuance',
    });
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it('classifies an atomic issue-and-claim failure as issuance, never outcome unknown', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: 'database timeout' } });
    const client = { rpc } as unknown as SupabaseClient<Database>;

    await expect(
      confirmExactConsentAndIssue({ ...common(client, preview()), mode: 'immediate' }),
    ).rejects.toMatchObject({
      code: 'GBP_GRANT_ISSUANCE_FAILED',
      phase: 'issuance',
    });
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('issue_and_claim_gbp_write_bundle_v1', expect.any(Object));
  });
});

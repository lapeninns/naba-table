import { describe, expect, it, vi } from 'vitest';

import { buildExactConsentPreview } from '@/server/dual-sync/publish/exact-consent';
import {
  buildExactConsentPermitClaim,
  createExactConsentPermitStore,
} from '@/server/dual-sync/publish/exact-consent/permits';
import {
  buildExactConsentGrantBundle,
  createExactConsentGrantRepository,
} from '@/server/dual-sync/publish/exact-consent/repository';

import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

const NOW = new Date('2026-08-09T10:00:00.000Z');
const HASH = 'a'.repeat(64);

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
      snapshotPins: { core: HASH, google: 'b'.repeat(64) },
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
            core: { 'profile.businessDescription': 'before' },
            google: { 'profile.businessDescription': 'old' },
          },
          after: {
            core: { 'profile.businessDescription': 'before' },
            google: { 'profile.businessDescription': 'before' },
          },
          request: { profile: { description: 'before' } },
          warnings: [],
          riskLevel: 'medium',
          fullReplacement: false,
        },
      ],
    },
    { clock: () => NOW },
  );
}

describe('exact-consent grant repository', () => {
  it('maps a preview into ordered hash-only grant issue records', () => {
    const bundle = buildExactConsentGrantBundle({
      preview: preview(),
      actorUserId: '00000000-0000-4000-8000-000000000003',
      riskAcknowledgements: ['external_write', 'outcome_may_be_unknown', 'partial_bundle_failure'],
      idFactory: vi
        .fn()
        .mockReturnValueOnce('00000000-0000-4000-8000-000000000004')
        .mockReturnValueOnce('00000000-0000-4000-8000-000000000005'),
    });

    expect(bundle.bundleId).toBe('00000000-0000-4000-8000-000000000004');
    expect(bundle.rpcArgs.p_grants[0]).toMatchObject({
      grant_id: '00000000-0000-4000-8000-000000000005',
      group_id: 'profile',
      bundle_order: 1,
      field_keys: ['profile.businessDescription'],
      google_method: 'PATCH',
      google_resource: 'locations/location-1',
      update_masks: ['profile'],
      request_hash: preview().groups[0].requestHash,
      preview_fingerprint: preview().planFingerprint,
    });
    expect(JSON.stringify(bundle.rpcArgs)).not.toContain('"before"');
  });

  it('uses the atomic issue-and-enqueue RPC and per-grant lifecycle RPCs', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { job_id: 'job-1' }, error: null });
    const repository = createExactConsentGrantRepository({
      rpc,
    } as unknown as SupabaseClient<Database>);
    const bundle = buildExactConsentGrantBundle({
      preview: preview(),
      actorUserId: '00000000-0000-4000-8000-000000000003',
      riskAcknowledgements: ['external_write', 'outcome_may_be_unknown', 'partial_bundle_failure'],
    });

    await repository.issueAndClaim(bundle.rpcArgs, '00000000-0000-4000-8000-000000000007');
    await repository.issueAndEnqueue(bundle.rpcArgs, '00000000-0000-4000-8000-000000000006');
    await repository.dispatch({
      restaurantId: preview().listing.restaurantId,
      bundleId: bundle.bundleId,
      grantId: bundle.grantIds[0] ?? '',
      executionId: '00000000-0000-4000-8000-000000000007',
      bundleOrder: 1,
    });
    await repository.finalize(
      {
        restaurantId: preview().listing.restaurantId,
        bundleId: bundle.bundleId,
        grantId: bundle.grantIds[0] ?? '',
        executionId: '00000000-0000-4000-8000-000000000007',
        bundleOrder: 1,
      },
      'outcome_unknown',
      'provider_outcome_unknown',
    );

    expect(rpc.mock.calls.map(([name]) => name)).toEqual([
      'issue_and_claim_gbp_write_bundle_v1',
      'issue_and_enqueue_gbp_write_bundle_v1',
      'dispatch_gbp_write_grant_v1',
      'finalize_gbp_write_grant_v1',
    ]);
    expect(rpc.mock.calls[1]?.[1]).toEqual(
      expect.objectContaining({ p_job_id: '00000000-0000-4000-8000-000000000006' }),
    );
  });

  it.each(['consumed', 'failed', 'outcome_unknown'] as const)(
    'materializes one idempotent notice after durable %s finalization',
    async (status) => {
      const terminalAt = '2026-08-09T10:01:00.000Z';
      const grantId = '00000000-0000-4000-8000-000000000005';
      const finalized = { id: grantId, status, terminal_at: terminalAt };
      const rpc = vi.fn().mockResolvedValue({ data: finalized, error: null });
      const materializeTerminalNotice = vi.fn().mockResolvedValue({ noticeId: 'notice-1' });
      const repository = createExactConsentGrantRepository(
        { rpc } as unknown as SupabaseClient<Database>,
        { materializeTerminalNotice },
      );

      await expect(
        repository.finalize(
          {
            restaurantId: preview().listing.restaurantId,
            bundleId: '00000000-0000-4000-8000-000000000004',
            grantId,
            executionId: '00000000-0000-4000-8000-000000000007',
            bundleOrder: 1,
          },
          status,
          `provider_${status}`,
        ),
      ).resolves.toBe(finalized);

      expect(rpc).toHaveBeenCalledTimes(1);
      expect(materializeTerminalNotice).toHaveBeenCalledOnce();
      expect(materializeTerminalNotice).toHaveBeenCalledWith({
        restaurantId: preview().listing.restaurantId,
        grantId,
        eventId: `gbp-write-terminal:${grantId}`,
        status,
        reasonCode: `provider_${status}`,
        terminalAt,
      });
      expect(rpc.mock.invocationCallOrder[0]).toBeLessThan(
        materializeTerminalNotice.mock.invocationCallOrder[0] ?? 0,
      );
    },
  );

  it('preserves durable provider truth when terminal notice materialization fails', async () => {
    const finalized = {
      id: '00000000-0000-4000-8000-000000000005',
      status: 'outcome_unknown',
      terminal_at: '2026-08-09T10:01:00.000Z',
    };
    const rpc = vi.fn().mockResolvedValue({ data: finalized, error: null });
    const repository = createExactConsentGrantRepository(
      { rpc } as unknown as SupabaseClient<Database>,
      {
        materializeTerminalNotice: vi.fn().mockRejectedValue(new Error('private notice failure')),
      },
    );

    await expect(
      repository.finalize(
        {
          restaurantId: preview().listing.restaurantId,
          bundleId: '00000000-0000-4000-8000-000000000004',
          grantId: finalized.id,
          executionId: '00000000-0000-4000-8000-000000000007',
          bundleOrder: 1,
        },
        'outcome_unknown',
        'provider_outcome_unknown',
      ),
    ).resolves.toBe(finalized);
  });

  it('uses the notice-aware finalizer for both immediate and queued permit stores', async () => {
    const bundle = buildExactConsentGrantBundle({
      preview: preview(),
      actorUserId: '00000000-0000-4000-8000-000000000003',
      riskAcknowledgements: ['external_write', 'outcome_may_be_unknown', 'partial_bundle_failure'],
    });
    const claim = buildExactConsentPermitClaim({
      bundle,
      executionId: '00000000-0000-4000-8000-000000000007',
    });
    const terminalAt = '2026-08-09T10:01:00.000Z';
    const rpc = vi.fn(async (name: string) => {
      if (name === 'finalize_gbp_write_grant_v1') {
        return { data: { terminal_at: terminalAt }, error: null };
      }
      if (name === 'materialize_gbp_terminal_notice_v1') {
        return { data: { id: 'notice-1' }, error: null };
      }
      throw new Error(`Unexpected RPC: ${name}`);
    });
    const store = createExactConsentPermitStore(
      { rpc } as unknown as SupabaseClient<Database>,
      claim.args,
    );
    const binding = claim.bindings[0];
    if (!binding) throw new Error('Expected one exact-consent binding.');

    await store.finalize(binding, 'consumed', 'provider_succeeded');

    expect(rpc.mock.calls.map(([name]) => name)).toEqual([
      'finalize_gbp_write_grant_v1',
      'materialize_gbp_terminal_notice_v1',
    ]);
    expect(rpc).toHaveBeenLastCalledWith('materialize_gbp_terminal_notice_v1', {
      p_restaurant_id: binding.restaurantId,
      p_grant_id: binding.grantId,
      p_event_id: `gbp-write-terminal:${binding.grantId}`,
      p_terminal_kind: 'consumed',
      p_safe_reason_code: 'provider_succeeded',
      p_terminal_at: terminalAt,
    });
  });

  it('binds every permit and claim hash to the exact ordered grant bundle', () => {
    const bundle = buildExactConsentGrantBundle({
      preview: preview(),
      actorUserId: '00000000-0000-4000-8000-000000000003',
      riskAcknowledgements: ['external_write', 'outcome_may_be_unknown', 'partial_bundle_failure'],
    });

    const claim = buildExactConsentPermitClaim({
      bundle,
      executionId: '00000000-0000-4000-8000-000000000007',
    });

    expect(claim.args.p_grant_ids).toEqual(bundle.grantIds);
    expect(claim.bindings[0]).toMatchObject({
      grantId: bundle.grantIds[0],
      groupId: 'profile',
      bundleOrder: 1,
      bundleSize: 1,
      requestHash: preview().groups[0].requestHash,
      method: 'PATCH',
      resource: 'locations/location-1',
    });
  });
});

import { describe, expect, it, vi } from 'vitest';

import {
  commitSnapshotRun,
  failSnapshotRun,
  openSnapshotRun,
  readLatestSucceededRun,
} from '@/server/dual-sync/snapshots/runs';

import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

function runRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'run-1',
    restaurant_id: 'rest-1',
    provider: 'google_business_profile',
    run_kind: 'manual',
    status: 'succeeded',
    raw_payload: null,
    canonical_snapshot: null,
    snapshot_hash: 'snapshot-hash',
    error_code: null,
    error_message: null,
    started_at: '2026-08-09T10:00:00.000Z',
    finished_at: '2026-08-09T10:01:00.000Z',
    created_at: '2026-08-09T10:00:00.000Z',
    ...overrides,
  };
}

describe('snapshot-run retention producer', () => {
  it('begins a pending run through the exact-fenced atomic RPC', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: runRow({ status: 'pending', raw_payload: null, snapshot_hash: null }),
      error: null,
    });
    const googleFence = {
      restaurantId: 'rest-1',
      externalProfileRowId: 'profile-row-1',
      accountId: 'account-1',
      profileId: 'profile-1',
      locationId: 'location-1',
      connectionGeneration: 2,
      consentEpoch: 3,
    };

    await openSnapshotRun({
      client: { rpc } as unknown as SupabaseClient<Database>,
      restaurantId: 'rest-1',
      runKind: 'manual',
      googleFence,
      runId: 'run-1',
      startedAt: '2026-08-09T10:00:00.000Z',
    });

    expect(rpc).toHaveBeenCalledWith('begin_gbp_dual_sync_snapshot_run_v1', {
      p_restaurant_id: 'rest-1',
      p_external_profile_row_id: 'profile-row-1',
      p_external_account_id: 'account-1',
      p_external_profile_id: 'profile-1',
      p_external_location_id: 'location-1',
      p_connection_generation: 2,
      p_consent_epoch: 3,
      p_run_id: 'run-1',
      p_run_kind: 'manual',
      p_started_at: '2026-08-09T10:00:00.000Z',
    });
  });

  it('stores raw Google payload unmodified only after exact-fence lineage approval', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: runRow(), error: null });
    const client = { from: vi.fn(), rpc } as unknown as SupabaseClient<Database>;
    const rawPayload = { name: 'Private Google name', nested: { phone: '+441234' } };

    await commitSnapshotRun({
      client,
      runId: 'run-1',
      canonicalSnapshot: { profile: { name: 'Private Google name' } },
      snapshotHash: 'snapshot-hash',
      rawPayload,
      runKind: 'manual',
      observedAt: '2026-08-09T10:00:00.000Z',
      googleFence: {
        restaurantId: 'rest-1',
        externalProfileRowId: 'profile-row-1',
        accountId: 'account-1',
        profileId: 'profile-1',
        locationId: 'location-1',
        connectionGeneration: 2,
        consentEpoch: 3,
      },
    });

    expect(rpc).toHaveBeenCalledWith('persist_gbp_dual_sync_snapshot_run_v1', {
      p_restaurant_id: 'rest-1',
      p_external_profile_row_id: 'profile-row-1',
      p_external_account_id: 'account-1',
      p_external_profile_id: 'profile-1',
      p_external_location_id: 'location-1',
      p_connection_generation: 2,
      p_consent_epoch: 3,
      p_run_id: 'run-1',
      p_run_kind: 'manual',
      p_raw_payload: rawPayload,
      p_observed_at: '2026-08-09T10:00:00.000Z',
    });
    expect(client.from).not.toHaveBeenCalled();
    expect(JSON.stringify(rpc.mock.calls)).not.toContain('canonicalSnapshot');
  });

  it('rejects raw payload persistence without a current lineage fence', async () => {
    const client = { from: vi.fn(), rpc: vi.fn() } as unknown as SupabaseClient<Database>;

    await expect(
      commitSnapshotRun({
        client,
        runId: 'run-1',
        canonicalSnapshot: {},
        snapshotHash: 'snapshot-hash',
        rawPayload: { name: 'must-not-persist' },
      }),
    ).rejects.toThrow('exact lineage fence');
    expect(client.from).not.toHaveBeenCalled();
  });

  it('refuses a success transition without an unmodified raw payload', async () => {
    const client = { from: vi.fn(), rpc: vi.fn() } as unknown as SupabaseClient<Database>;

    await expect(
      commitSnapshotRun({
        client,
        runId: 'run-1',
        canonicalSnapshot: { profile: { name: 'must-not-persist' } },
        snapshotHash: 'snapshot-hash',
      }),
    ).rejects.toThrow('exact lineage fence');

    expect(client.from).not.toHaveBeenCalled();
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it('fails a pending run atomically with safe code only', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: runRow({ status: 'failed', error_code: 'GBP_UPSTREAM' }),
      error: null,
    });

    await failSnapshotRun({
      client: { rpc } as unknown as SupabaseClient<Database>,
      restaurantId: 'rest-1',
      runId: 'run-1',
      runKind: 'manual',
      googleFence: {
        restaurantId: 'rest-1',
        externalProfileRowId: 'profile-row-1',
        accountId: 'account-1',
        profileId: 'profile-1',
        locationId: 'location-1',
        connectionGeneration: 2,
        consentEpoch: 3,
      },
      errorCode: 'GBP_UPSTREAM',
      errorMessage: 'token=private-token private@example.test',
    });

    expect(rpc).toHaveBeenCalledWith(
      'fail_gbp_dual_sync_snapshot_run_v1',
      expect.objectContaining({ p_error_code: 'GBP_UPSTREAM' }),
    );
    expect(JSON.stringify(rpc.mock.calls)).not.toContain('private-token');
    expect(JSON.stringify(rpc.mock.calls)).not.toContain('private@example.test');
  });

  it('reads only exact-current unexpired rows through the fenced RPC without extending expiry', async () => {
    const current = runRow({ id: 'run-current', raw_payload: { name: 'current' } });
    const rpc = vi.fn().mockResolvedValue({ data: [current], error: null });
    const googleFence = {
      restaurantId: 'rest-1',
      externalProfileRowId: 'profile-row-1',
      accountId: 'account-1',
      profileId: 'profile-1',
      locationId: 'location-1',
      connectionGeneration: 2,
      consentEpoch: 3,
    };

    const result = await readLatestSucceededRun({
      client: { rpc } as unknown as SupabaseClient<Database>,
      googleFence,
      now: '2026-08-10T10:00:00.000Z',
    });

    expect(result?.id).toBe('run-current');
    expect(rpc).toHaveBeenCalledWith('get_current_gbp_dual_sync_snapshot_runs_v1', {
      p_restaurant_id: 'rest-1',
      p_external_profile_row_id: 'profile-row-1',
      p_external_account_id: 'account-1',
      p_external_profile_id: 'profile-1',
      p_external_location_id: 'location-1',
      p_connection_generation: 2,
      p_consent_epoch: 3,
      p_run_kind: null,
      p_now: '2026-08-10T10:00:00.000Z',
    });
    expect(result?.errorMessage).toBeNull();
  });
});

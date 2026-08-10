import assert from 'node:assert/strict';

import { upsertOutboundCandidate } from '../../server/dual-sync/outbound/candidates';
import { metadataOnlySummary } from '../../server/dual-sync/publish/persistence-metadata';
import { enqueueDualSyncJob } from '../../server/dual-sync/queue/jobs';
import { commitSnapshotRun } from '../../server/dual-sync/snapshots/runs';

import type { Database } from '../../types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

async function main() {
  const privateValue = 'private-provider-body@example.test';
  const summary = metadataOnlySummary({ providerValue: privateValue });
  assert(!JSON.stringify(summary).includes(privateValue));

  const rpcCalls: unknown[][] = [];
  const rawPayload = { locationResponses: [{ name: privateValue }], attributesResponse: null };
  const rpc = async (name: string, args: unknown) => {
    rpcCalls.push([name, args]);
    return {
      data: {
        id: '00000000-0000-4000-8000-000000000001',
        restaurant_id: '00000000-0000-4000-8000-000000000002',
        provider: 'google_business_profile',
        run_kind: 'manual',
        status: 'succeeded',
        canonical_snapshot: null,
        raw_payload: rawPayload,
        snapshot_hash: 'a'.repeat(64),
        error_code: null,
        error_message: null,
        started_at: '2026-08-09T10:00:00.000Z',
        finished_at: '2026-08-09T10:00:01.000Z',
        created_at: '2026-08-09T10:00:00.000Z',
      },
      error: null,
    };
  };
  await commitSnapshotRun({
    client: { rpc } as unknown as SupabaseClient<Database>,
    runId: '00000000-0000-4000-8000-000000000001',
    runKind: 'manual',
    canonicalSnapshot: { forbiddenCanonicalCopy: privateValue },
    snapshotHash: 'client-hash-is-not-authoritative',
    rawPayload,
    observedAt: '2026-08-09T10:00:01.000Z',
    googleFence: {
      restaurantId: '00000000-0000-4000-8000-000000000002',
      externalProfileRowId: '00000000-0000-4000-8000-000000000003',
      accountId: 'account-1',
      profileId: 'profile-1',
      locationId: 'location-1',
      connectionGeneration: 2,
      consentEpoch: 3,
    },
  });
  assert.equal(rpcCalls.length, 1);
  assert.equal((rpcCalls[0]?.[1] as { p_raw_payload?: unknown }).p_raw_payload, rawPayload);
  assert(!JSON.stringify(rpcCalls).includes('forbiddenCanonicalCopy'));

  let databaseCalls = 0;
  const noDatabaseClient = {
    from: () => {
      databaseCalls += 1;
      throw new Error('database must not be reached');
    },
  } as unknown as SupabaseClient<Database>;
  await assert.rejects(
    upsertOutboundCandidate({
      client: noDatabaseClient,
      restaurantId: '00000000-0000-4000-8000-000000000002',
      sectionKey: 'profile',
      fieldKey: 'profile.name',
      proposedValue: privateValue,
      proposedValueHash: 'b'.repeat(64),
      baselineGbpHash: 'c'.repeat(64),
      source: 'scheduled',
    }),
  );
  await assert.rejects(
    enqueueDualSyncJob({
      client: noDatabaseClient,
      restaurantId: '00000000-0000-4000-8000-000000000002',
      jobKind: 'publish_batch',
      payload: { providerResponse: privateValue },
    }),
  );
  assert.equal(databaseCalls, 0);

  process.stdout.write(
    `${JSON.stringify({
      scenario: 'wave2c_producer_retention',
      atomicRawPassThrough: true,
      canonicalCopyPersisted: false,
      googleCandidateCopyPersisted: false,
      contentQueuePersisted: false,
      databaseCallsForRejectedContent: databaseCalls,
      metadataSummary: summary,
    })}\n`,
  );
}

void main();

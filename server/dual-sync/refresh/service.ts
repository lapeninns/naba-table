/**
 * Phase 2 of the unified dual-sync engine.
 *
 * Refresh service: pull the latest Google Business Profile state into
 * Nabatable's canonical projection, persist a transactional snapshot
 * run, then recompute every registry field's `DualSyncFieldState`.
 *
 * Flow:
 *  1. open `dual_sync_snapshot_runs` row (status = pending)
 *  2. call legacy `syncGoogleBusinessProfileBusinessInformation` to
 *     refresh provider mirrors (`gbp_*` tables)
 *  3. read both canonical snapshots (Core + GBP)
 *  4. commit the snapshot run with the canonical Google snapshot
 *  5. recompute states for every registry field
 *  6. on any failure, mark the snapshot run failed and rethrow
 *
 * The snapshot run is the durable evidence that "Core was at hash X and
 * GBP was at hash Y at time T". Field-state rows reference the run id so
 * downstream tooling can answer "when was this field last in sync?".
 */

import { syncGoogleBusinessProfileBusinessInformation } from '@/server/google-business-profile/service';
import { getServiceSupabaseClient } from '@/server/supabase';

import { hashCanonicalJson } from '../hashing';
import { readGoogleSnapshot } from '../snapshots/google';
import { readNabatableSnapshot } from '../snapshots/nabatable';
import {
  commitSnapshotRun,
  failSnapshotRun,
  openSnapshotRun,
} from '../snapshots/runs';
import { recomputeAllStates, type RecomputeAllStatesOutput } from '../state/recompute';

import type { DualSyncCanonicalSnapshot } from '../snapshots/types';
import type { DualSyncSnapshotRun, DualSyncSnapshotRunKind } from '../types';
import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

type DbClient = SupabaseClient<Database>;

export interface RefreshFromGoogleInput {
  readonly restaurantId: string;
  readonly client?: DbClient;
  readonly runKind?: DualSyncSnapshotRunKind;
  /** Optional override: skip the live Google pull and only re-evaluate state. */
  readonly skipPull?: boolean;
}

export interface RefreshFromGoogleOutput {
  readonly snapshotRun: DualSyncSnapshotRun;
  readonly coreSnapshot: DualSyncCanonicalSnapshot;
  readonly gbpSnapshot: DualSyncCanonicalSnapshot;
  readonly recompute: RecomputeAllStatesOutput;
}

function mapRunKindToLegacy(
  runKind: DualSyncSnapshotRunKind,
): 'manual' | 'location_selection' | 'core_sync' {
  switch (runKind) {
    case 'manual':
      return 'manual';
    case 'location_link':
      return 'location_selection';
    case 'core_write':
      return 'core_sync';
    case 'scheduled':
      return 'manual';
    case 'preflight':
      return 'manual';
    default:
      return 'manual';
  }
}

/**
 * Pull GBP, persist the canonical snapshot, recompute field states.
 *
 * Errors propagate after the snapshot run is marked `failed`; callers
 * should treat any throw as a fatal refresh failure.
 */
export async function refreshFromGoogle({
  restaurantId,
  client = getServiceSupabaseClient(),
  runKind = 'manual',
  skipPull = false,
}: RefreshFromGoogleInput): Promise<RefreshFromGoogleOutput> {
  const snapshotRun = await openSnapshotRun({ client, restaurantId, runKind });

  try {
    if (!skipPull) {
      await syncGoogleBusinessProfileBusinessInformation(restaurantId, client, {
        runKind: mapRunKindToLegacy(runKind),
      });
    }

    const [coreSnapshot, gbpSnapshot] = await Promise.all([
      readNabatableSnapshot({ client, restaurantId }),
      readGoogleSnapshot({ client, restaurantId }),
    ]);

    const canonical = {
      profile: gbpSnapshot.profile,
      operatingHours: gbpSnapshot.operatingHours,
      servicePeriods: gbpSnapshot.servicePeriods,
      businessContext: gbpSnapshot.businessContext,
    };
    const snapshotHash = hashCanonicalJson(canonical) ?? '';

    const committed = await commitSnapshotRun({
      client,
      runId: snapshotRun.id,
      canonicalSnapshot: canonical,
      snapshotHash,
    });

    const recompute = await recomputeAllStates({
      client,
      restaurantId,
      coreSnapshot,
      gbpSnapshot,
      lastSnapshotRunId: committed.id,
    });

    return {
      snapshotRun: committed,
      coreSnapshot,
      gbpSnapshot,
      recompute,
    };
  } catch (error) {
    const code = error instanceof Error ? error.name : 'UNKNOWN';
    const message = error instanceof Error ? error.message : String(error);
    await failSnapshotRun({
      client,
      runId: snapshotRun.id,
      errorCode: code,
      errorMessage: message,
    });
    throw error;
  }
}

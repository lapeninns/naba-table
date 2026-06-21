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

import {
  prepareFoodMenusProjection,
  refreshFoodMenusImportReviewFromGoogle,
} from '@/server/google-business-profile/food-menus-sync';
import {
  getGoogleBusinessProfileFoodMenusContext,
  syncGoogleBusinessProfileBusinessInformation,
} from '@/server/google-business-profile/service';
import { getServiceSupabaseClient } from '@/server/supabase';

import { assertDualSyncRestaurantNotPaused } from '../controls';
import { hashCanonicalJson } from '../hashing';
import { runWithDualSyncLock, type DualSyncLockManager } from '../locks';
import { createGoogleRequestLog } from '../publish/google-request-logs';
import { readGoogleSnapshot } from '../snapshots/google';
import { readNabatableSnapshot } from '../snapshots/nabatable';
import { commitSnapshotRun, failSnapshotRun, openSnapshotRun } from '../snapshots/runs';
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
  readonly lockManager?: DualSyncLockManager;
  readonly lockTtlMs?: number;
}

export interface RefreshFromGoogleOutput {
  readonly snapshotRun: DualSyncSnapshotRun;
  readonly coreSnapshot: DualSyncCanonicalSnapshot;
  readonly gbpSnapshot: DualSyncCanonicalSnapshot;
  readonly foodMenusRefresh: FoodMenusRefreshResult;
  readonly recompute: RecomputeAllStatesOutput;
}

export type FoodMenusRefreshResult =
  | {
      readonly status: 'refreshed';
      readonly projectionSnapshotId: string | null;
      readonly googleSnapshotId: string | null;
      readonly googleFoodMenusHash: string;
      readonly importReviewCount: number;
    }
  | {
      readonly status: 'skipped';
      readonly reason: 'skip_pull' | 'context_unavailable' | 'storage_unavailable' | 'not_eligible';
      readonly message: string;
    };

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

function mapRunKindToFoodMenusSource(
  runKind: DualSyncSnapshotRunKind,
): 'manual' | 'scheduled' | 'preflight' {
  switch (runKind) {
    case 'scheduled':
      return 'scheduled';
    case 'preflight':
      return 'preflight';
    default:
      return 'manual';
  }
}

function isMissingFoodMenusStorageError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }
  const record = error as { code?: unknown; message?: unknown };
  const code = typeof record.code === 'string' ? record.code : '';
  return code === 'PGRST205' || code === '42P01';
}

function isSkippableFoodMenusContextError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }
  const code = (error as { code?: unknown }).code;
  return (
    code === 'GBP_ACCOUNT_NOT_LINKED' ||
    code === 'GBP_LOCATION_NOT_LINKED' ||
    code === 'GBP_NOT_CONNECTED' ||
    code === 'GBP_FOOD_MENUS_NOT_ELIGIBLE'
  );
}

function foodMenusContextSkipReason(
  error: unknown,
): Extract<FoodMenusRefreshResult, { status: 'skipped' }>['reason'] {
  const code = error && typeof error === 'object' ? (error as { code?: unknown }).code : null;
  return code === 'GBP_FOOD_MENUS_NOT_ELIGIBLE' ? 'not_eligible' : 'context_unavailable';
}

function errorMessage(error: unknown): string {
  if (error && typeof error === 'object') {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim().length > 0) {
      return message;
    }
  }
  return error instanceof Error ? error.message : String(error);
}

function snapshotRunErrorCode(error: unknown): string {
  if (error && typeof error === 'object') {
    const code = (error as { code?: unknown }).code;
    if (typeof code === 'string' && code.trim().length > 0) {
      return code;
    }
  }
  return error instanceof Error ? error.name : 'UNKNOWN';
}

async function refreshFoodMenusSnapshotsForDualSync({
  client,
  restaurantId,
  runKind,
}: {
  readonly client: DbClient;
  readonly restaurantId: string;
  readonly runKind: DualSyncSnapshotRunKind;
}): Promise<FoodMenusRefreshResult> {
  try {
    const context = await getGoogleBusinessProfileFoodMenusContext({
      client,
      restaurantId,
    });
    const source = mapRunKindToFoodMenusSource(runKind);
    const projection = await prepareFoodMenusProjection({
      client,
      restaurantId,
      foodMenusName: context.foodMenusName,
      externalProfileId: context.externalProfileId,
      source,
      persist: true,
    });
    const refreshed = await refreshFoodMenusImportReviewFromGoogle({
      client,
      restaurantId,
      accessToken: context.accessToken,
      foodMenusName: context.foodMenusName,
      externalProfileId: context.externalProfileId,
      source,
      projectionSnapshotId: projection.snapshot?.id ?? null,
      persist: true,
    });

    return {
      status: 'refreshed',
      projectionSnapshotId: projection.snapshot?.id ?? null,
      googleSnapshotId: refreshed.importReview.googleSnapshot?.id ?? null,
      googleFoodMenusHash: refreshed.googleFoodMenusHash,
      importReviewCount: refreshed.importReview.rows.length,
    };
  } catch (error) {
    if (isMissingFoodMenusStorageError(error)) {
      return {
        status: 'skipped',
        reason: 'storage_unavailable',
        message: errorMessage(error),
      };
    }
    if (isSkippableFoodMenusContextError(error)) {
      return {
        status: 'skipped',
        reason: foodMenusContextSkipReason(error),
        message: errorMessage(error),
      };
    }
    throw error;
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
  lockManager,
  lockTtlMs,
}: RefreshFromGoogleInput): Promise<RefreshFromGoogleOutput> {
  await assertDualSyncRestaurantNotPaused({ client, restaurantId });

  return runWithDualSyncLock(
    {
      client,
      restaurantId,
      jobKind: lockJobKindForRefresh(runKind),
      ttlMs: lockTtlMs,
      manager: lockManager,
      metadata: { runKind, skipPull },
    },
    () => refreshFromGoogleUnlocked({ restaurantId, client, runKind, skipPull }),
  );
}

function lockJobKindForRefresh(runKind: DualSyncSnapshotRunKind) {
  switch (runKind) {
    case 'scheduled':
      return 'google_refresh_scheduled';
    case 'location_link':
      return 'google_refresh_location_link';
    case 'core_write':
      return 'core_write_recompute';
    default:
      return 'google_refresh_manual';
  }
}

async function refreshFromGoogleUnlocked({
  restaurantId,
  client,
  runKind,
  skipPull,
}: Required<Pick<RefreshFromGoogleInput, 'restaurantId' | 'client' | 'runKind' | 'skipPull'>>) {
  const snapshotRun = await openSnapshotRun({ client, restaurantId, runKind });
  let foodMenusRefresh: FoodMenusRefreshResult = {
    status: 'skipped',
    reason: 'skip_pull',
    message: 'Live Google pull was skipped for this refresh run.',
  };

  try {
    if (!skipPull) {
      await syncGoogleBusinessProfileBusinessInformation(restaurantId, client, {
        runKind: mapRunKindToLegacy(runKind),
      });
      foodMenusRefresh = await refreshFoodMenusSnapshotsForDualSync({
        client,
        restaurantId,
        runKind,
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
      foodMenus: gbpSnapshot.foodMenus ?? { items: [] },
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

    if (!skipPull) {
      await createGoogleRequestLog({
        client,
        restaurantId,
        publishJobId: committed.id,
        phase: 'provider_summary',
        status: 'succeeded',
        googleMethod: 'google_refresh',
        requestSummary: {
          runKind,
          snapshotRunId: committed.id,
        },
        responseSummary: {
          snapshotHash,
          foodMenusRefresh,
          evaluatedFieldCount: recompute.evaluatedFieldKeys.length,
          transitionCount: recompute.transitions.length,
        },
      });
    }

    return {
      snapshotRun: committed,
      coreSnapshot,
      gbpSnapshot,
      foodMenusRefresh,
      recompute,
    };
  } catch (error) {
    const code = snapshotRunErrorCode(error);
    const message = errorMessage(error);
    await failSnapshotRun({
      client,
      runId: snapshotRun.id,
      errorCode: code,
      errorMessage: message,
    });
    if (!skipPull) {
      await createGoogleRequestLog({
        client,
        restaurantId,
        publishJobId: snapshotRun.id,
        phase: 'provider_error',
        status: 'failed',
        googleMethod: 'google_refresh',
        requestSummary: {
          runKind,
          snapshotRunId: snapshotRun.id,
        },
        responseSummary: null,
        errorCode: code,
        errorMessage: message,
      });
    }
    throw error;
  }
}

export async function refreshFromGoogleWithoutLock(
  input: Required<Pick<RefreshFromGoogleInput, 'restaurantId' | 'client' | 'runKind' | 'skipPull'>>,
): Promise<RefreshFromGoogleOutput> {
  await assertDualSyncRestaurantNotPaused(input);
  return refreshFromGoogleUnlocked(input);
}

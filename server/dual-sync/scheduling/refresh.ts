/**
 * Scheduled dual-sync refresh runner.
 *
 * Discovers restaurants with a linked Google Business Profile connection and
 * refreshes their canonical dual-sync snapshots with `runKind = scheduled`.
 * This is read/pull oriented: it does not publish local changes to Google.
 */

import { buildDefaultNotificationPort, type DualSyncNotificationPort } from '../notifications';
import { refreshFromGoogle, type FoodMenusRefreshResult } from '../refresh';
import { DUAL_SYNC_PROVIDER } from '../types';

import type { DualSyncSnapshotRun } from '../types';
import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

type DbClient = SupabaseClient<Database>;

export interface RunScheduledRefreshForRestaurantInput {
  readonly client: DbClient;
  readonly restaurantId: string;
}

export interface RunScheduledRefreshSummary {
  readonly restaurantId: string;
  readonly snapshotRun: DualSyncSnapshotRun;
  readonly foodMenusRefresh: FoodMenusRefreshResult;
  readonly evaluatedFieldCount: number;
  readonly transitionCount: number;
}

export interface RunScheduledRefreshForAllTenantsInput {
  readonly client: DbClient;
  readonly maxRestaurants?: number;
  readonly dryRun?: boolean;
  readonly onError?: 'continue' | 'throw';
  readonly notifications?: DualSyncNotificationPort;
}

export interface RunScheduledRefreshFanOutSummary {
  readonly restaurantsConsidered: number;
  readonly restaurantsProcessed: number;
  readonly restaurantIds: ReadonlyArray<string>;
  readonly summaries: ReadonlyArray<RunScheduledRefreshSummary>;
  readonly errors: ReadonlyArray<{
    readonly restaurantId: string;
    readonly message: string;
  }>;
  readonly dryRun: boolean;
}

export interface EnqueueScheduledRefreshJobsInput {
  readonly client: DbClient;
  readonly now?: string;
  readonly maxRestaurants?: number;
}

export interface EnqueueScheduledRefreshJobsSummary {
  readonly considered: number;
  readonly enqueued: number;
  readonly bucket: string;
  readonly jobIds: readonly string[];
}

const MAX_SCHEDULED_REFRESH_BATCH = 50;
const SCHEDULED_REFRESH_BUCKET_MS = 30 * 60 * 1000;

export function scheduledRefreshBucket(now: string): string {
  const parsed = new Date(now);
  if (Number.isNaN(parsed.getTime())) throw new RangeError('Invalid scheduled refresh timestamp.');
  return new Date(
    Math.floor(parsed.getTime() / SCHEDULED_REFRESH_BUCKET_MS) * SCHEDULED_REFRESH_BUCKET_MS,
  ).toISOString();
}

export async function enqueueScheduledRefreshJobs({
  client,
  now = new Date().toISOString(),
  maxRestaurants = MAX_SCHEDULED_REFRESH_BATCH,
}: EnqueueScheduledRefreshJobsInput): Promise<EnqueueScheduledRefreshJobsSummary> {
  const requestedLimit = Number.isFinite(maxRestaurants)
    ? Math.trunc(maxRestaurants)
    : MAX_SCHEDULED_REFRESH_BATCH;
  const limit = Math.min(Math.max(1, requestedLimit), MAX_SCHEDULED_REFRESH_BATCH);
  const bucket = scheduledRefreshBucket(now);
  const result = await client.rpc('enqueue_gbp_scheduled_refreshes_v1', {
    p_now: now,
    p_bucket: bucket,
    p_limit: limit,
  });
  if (result.error) throw result.error;
  const jobs = result.data;
  return {
    considered: jobs.length,
    enqueued: jobs.filter((job) => job.created).length,
    bucket,
    jobIds: jobs.map((job) => job.job_id),
  };
}

export async function listRestaurantsWithLinkedGoogleBusinessProfile({
  client,
  limit,
}: {
  readonly client: DbClient;
  readonly limit?: number;
}): Promise<ReadonlyArray<string>> {
  let query = client
    .from('restaurant_external_profiles')
    .select('restaurant_id,last_pull_at')
    .eq('provider', DUAL_SYNC_PROVIDER)
    .eq('connection_status', 'linked')
    .not('restaurant_id', 'is', null)
    .order('last_pull_at', { ascending: true, nullsFirst: true });

  if (typeof limit === 'number' && limit > 0) {
    query = query.limit(Math.min(limit * 4, 1000));
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }

  const seen = new Set<string>();
  const out: string[] = [];
  for (const row of data ?? []) {
    const restaurantId = (row as { restaurant_id?: string | null }).restaurant_id;
    if (typeof restaurantId !== 'string' || seen.has(restaurantId)) continue;
    seen.add(restaurantId);
    out.push(restaurantId);
    if (typeof limit === 'number' && out.length >= limit) break;
  }
  return out;
}

export async function runScheduledRefreshForRestaurant({
  client,
  restaurantId,
}: RunScheduledRefreshForRestaurantInput): Promise<RunScheduledRefreshSummary> {
  const result = await refreshFromGoogle({
    client,
    restaurantId,
    runKind: 'scheduled',
  });
  return {
    restaurantId,
    snapshotRun: result.snapshotRun,
    foodMenusRefresh: result.foodMenusRefresh,
    evaluatedFieldCount: result.recompute.evaluatedFieldKeys.length,
    transitionCount: result.recompute.transitions.length,
  };
}

export async function runScheduledRefreshForAllTenants(
  input: RunScheduledRefreshForAllTenantsInput,
): Promise<RunScheduledRefreshFanOutSummary> {
  const { client, maxRestaurants, dryRun = false, onError = 'continue' } = input;
  const notifications = input.notifications ?? buildDefaultNotificationPort();
  const restaurantIds = await listRestaurantsWithLinkedGoogleBusinessProfile({
    client,
    limit: maxRestaurants,
  });

  if (dryRun) {
    return {
      restaurantsConsidered: restaurantIds.length,
      restaurantsProcessed: 0,
      restaurantIds,
      summaries: [],
      errors: [],
      dryRun: true,
    };
  }

  const summaries: RunScheduledRefreshSummary[] = [];
  const errors: Array<{ readonly restaurantId: string; readonly message: string }> = [];

  for (const restaurantId of restaurantIds) {
    try {
      const summary = await runScheduledRefreshForRestaurant({ client, restaurantId });
      summaries.push(summary);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push({ restaurantId, message });
      await notifications.emit({
        kind: 'tenant_run_failed',
        severity: 'error',
        summary: `Scheduled refresh for ${restaurantId} threw: ${message}`,
        restaurantId,
        errorMessage: message,
      });
      if (onError === 'throw') {
        throw error;
      }
    }
  }

  return {
    restaurantsConsidered: restaurantIds.length,
    restaurantsProcessed: summaries.length,
    restaurantIds,
    summaries,
    errors,
    dryRun: false,
  };
}

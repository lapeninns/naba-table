/**
 * Phase 3g of the unified dual-sync engine.
 *
 * Auto-export runner. Discovers the open candidates in
 * `dual_sync_outbound_candidates` for operator review. It never
 * executes a Google publish or creates a provider mutation job.
 *
 * Usage:
 *   - `runAutoExportForRestaurant({ client, restaurantId })` — single
 *     tenant; safe to call from a manual ops trigger.
 *
 * Candidates without a Google baseline remain open and are reported as
 * skipped so a canonical refresh and explicit review can resolve them.
 */

import { assertDualSyncRestaurantNotPaused } from '../controls';
import { buildDefaultNotificationPort, type DualSyncNotificationPort } from '../notifications';
import {
  listOpenOutboundCandidates,
  listRestaurantsWithOpenOutboundCandidates,
} from '../outbound/candidates';

import type { RunPublishOptions } from '../publish/orchestrator';
import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

type DbClient = SupabaseClient<Database>;

export interface RunAutoExportForRestaurantInput {
  readonly client: DbClient;
  readonly restaurantId: string;
  /**
   * Optional cap on how many candidates to process in this run. Useful
   * for a poll/retry topology that wants to fan out across many
   * restaurants without spending the whole budget on one tenant.
   */
  readonly maxCandidates?: number;
  readonly actorUserId?: string | null;
  readonly publishOptions?: RunPublishOptions;
}

export interface RunAutoExportSummary {
  readonly restaurantId: string;
  readonly candidatesConsidered: number;
  readonly decisionsExecuted: number;
  readonly publishResult: null;
  readonly skipped: ReadonlyArray<{
    readonly candidateId: string;
    readonly fieldKey: string;
    readonly reason: 'no_baseline' | 'unsupported_section';
  }>;
}

export async function runAutoExportForRestaurant(
  input: RunAutoExportForRestaurantInput,
): Promise<RunAutoExportSummary> {
  const { client, restaurantId, maxCandidates } = input;

  await assertDualSyncRestaurantNotPaused({ client, restaurantId });

  const open = await listOpenOutboundCandidates({ client, restaurantId });
  const considered =
    typeof maxCandidates === 'number' ? open.slice(0, Math.max(0, maxCandidates)) : open;

  const skipped: Array<{
    readonly candidateId: string;
    readonly fieldKey: string;
    readonly reason: 'no_baseline' | 'unsupported_section';
  }> = [];

  for (const candidate of considered) {
    if (!candidate.baselineGbpHash) {
      // We refuse to auto-export when we don't have a baseline Google
      // hash to drift-check against. The candidate stays open so a
      // future refresh + manual review can resolve it.
      skipped.push({
        candidateId: candidate.id,
        fieldKey: candidate.fieldKey,
        reason: 'no_baseline',
      });
      continue;
    }
  }

  return {
    restaurantId,
    candidatesConsidered: considered.length,
    decisionsExecuted: 0,
    publishResult: null,
    skipped,
  };
}

// ---------------------------------------------------------------------------
// Cross-tenant fan-out
// ---------------------------------------------------------------------------

export interface RunAutoExportForAllTenantsInput {
  readonly client: DbClient;
  /**
   * Maximum number of restaurants to process in this run. Caps the
   * total wall-clock budget per cron tick.
   */
  readonly maxRestaurants?: number;
  /**
   * Per-restaurant candidate cap forwarded to
   * `runAutoExportForRestaurant`.
   */
  readonly maxCandidatesPerRestaurant?: number;
  readonly dryRun?: boolean;
  /**
   * Strategy when one tenant throws. Defaults to `'continue'` so a
   * single broken integration does not block the rest of the cohort.
   */
  readonly onError?: 'continue' | 'throw';
  /**
   * Optional notification port. Used to surface per-tenant failures
   * and partial-success rollups to operators (Slack / PagerDuty / log
   * collector). Defaults to `buildDefaultNotificationPort()` which
   * always logs to console and additionally posts to
   * `DUAL_SYNC_FAILURE_WEBHOOK_URL` when configured.
   */
  readonly notifications?: DualSyncNotificationPort;
}

export interface RunAutoExportFanOutSummary {
  readonly restaurantsConsidered: number;
  readonly restaurantsProcessed: number;
  readonly summaries: ReadonlyArray<RunAutoExportSummary>;
  readonly errors: ReadonlyArray<{
    readonly restaurantId: string;
    readonly message: string;
  }>;
  readonly dryRun: boolean;
}

export async function runAutoExportForAllTenants(
  input: RunAutoExportForAllTenantsInput,
): Promise<RunAutoExportFanOutSummary> {
  const {
    client,
    maxRestaurants,
    maxCandidatesPerRestaurant,
    dryRun = false,
    onError = 'continue',
  } = input;
  const notifications = input.notifications ?? buildDefaultNotificationPort();

  const restaurantIds = await listRestaurantsWithOpenOutboundCandidates({
    client,
    limit: maxRestaurants,
  });

  const summaries: RunAutoExportSummary[] = [];
  const errors: Array<{ readonly restaurantId: string; readonly message: string }> = [];

  for (const restaurantId of restaurantIds) {
    try {
      const summary = await runAutoExportForRestaurant({
        client,
        restaurantId,
        maxCandidates: maxCandidatesPerRestaurant,
      });
      summaries.push(summary);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push({ restaurantId, message });
      await notifications.emit({
        kind: 'tenant_run_failed',
        severity: 'error',
        summary: `Auto-export run for ${restaurantId} threw: ${message}`,
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
    summaries,
    errors,
    dryRun,
  };
}

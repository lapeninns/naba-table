/**
 * Phase 3g of the unified dual-sync engine.
 *
 * Auto-export runner. Consumes the open candidates in
 * `dual_sync_outbound_candidates` and translates them into
 * `export_to_google` decisions, then drives the publish orchestrator
 * with `defaultDualSyncPorts`.
 *
 * Usage:
 *   - `runAutoExportForRestaurant({ client, restaurantId })` — single
 *     tenant; safe to call from a manual ops trigger.
 *
 * Pinning behaviour:
 *   - Each generated decision pins `pinnedGbpHash = candidate.baselineGbpHash`
 *     so the orchestrator rejects the export if Google moved underneath
 *     the candidate (it would fall back to a manual operator review).
 *   - Decisions also pin `pinnedCoreHash = candidate.proposedValueHash`
 *     so a Core-side change after the candidate was queued doesn't
 *     silently override the new value. The orchestrator surfaces a
 *     `CORE_DRIFT` failure in that case and the candidate stays open
 *     for the next run.
 */

import {
  buildDefaultNotificationPort,
  type DualSyncNotificationPort,
} from '../notifications';
import {
  listOpenOutboundCandidates,
  listRestaurantsWithOpenOutboundCandidates,
} from '../outbound/candidates';
import { runPublish, type RunPublishOptions, type RunPublishResult } from '../publish/orchestrator';
import { defaultDualSyncPorts } from '../publish/ports';

import type {
  DualSyncPublishDecision,
} from '../publish/types';
import type { DualSyncOutboundCandidate } from '../types';
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
  /**
   * Source attribution for the candidate -> publish decision flow.
   * Defaults to `'scheduled'` to indicate this is an automated path.
   */
  readonly actorUserId?: string | null;
  /**
   * Override hook for tests / parallel callers.
   */
  readonly publishOptions?: RunPublishOptions;
}

export interface RunAutoExportSummary {
  readonly restaurantId: string;
  readonly candidatesConsidered: number;
  readonly decisionsExecuted: number;
  readonly publishResult: RunPublishResult | null;
  readonly skipped: ReadonlyArray<{
    readonly candidateId: string;
    readonly fieldKey: string;
    readonly reason: 'no_baseline' | 'unsupported_section';
  }>;
}

function candidateToDecision(
  candidate: DualSyncOutboundCandidate,
): DualSyncPublishDecision {
  return {
    fieldKey: candidate.fieldKey,
    sectionKey: candidate.sectionKey,
    action: 'export_to_google',
    pinnedCoreHash: candidate.proposedValueHash,
    pinnedGbpHash: candidate.baselineGbpHash,
  };
}

export async function runAutoExportForRestaurant(
  input: RunAutoExportForRestaurantInput,
): Promise<RunAutoExportSummary> {
  const { client, restaurantId, maxCandidates, publishOptions } = input;

  const open = await listOpenOutboundCandidates({ client, restaurantId });
  const considered = typeof maxCandidates === 'number'
    ? open.slice(0, Math.max(0, maxCandidates))
    : open;

  const skipped: Array<{
    readonly candidateId: string;
    readonly fieldKey: string;
    readonly reason: 'no_baseline' | 'unsupported_section';
  }> = [];

  const decisions: DualSyncPublishDecision[] = [];
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
    decisions.push(candidateToDecision(candidate));
  }

  if (decisions.length === 0) {
    return {
      restaurantId,
      candidatesConsidered: considered.length,
      decisionsExecuted: 0,
      publishResult: null,
      skipped,
    };
  }

  const publishResult = await runPublish(
    client,
    {
      restaurantId,
      decisions,
      actorUserId: input.actorUserId ?? null,
    },
    {
      ports: publishOptions?.ports ?? defaultDualSyncPorts(),
      ...publishOptions,
    },
  );

  return {
    restaurantId,
    candidatesConsidered: considered.length,
    decisionsExecuted: decisions.length,
    publishResult,
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
  /**
   * When `true`, skip the publish call and return the discovery only.
   * Useful for the cron handler's `?dryRun=1` path.
   */
  readonly dryRun?: boolean;
  /**
   * Override hook for tests / parallel callers.
   */
  readonly publishOptions?: RunPublishOptions;
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

function summarizePublish(result: RunPublishResult | null) {
  if (!result) return { succeeded: 0, failed: 0, skipped: 0, other: 0 };
  const ops = result.summary.operations;
  let succeeded = 0;
  let failed = 0;
  let skipped = 0;
  let other = 0;
  for (const op of ops) {
    switch (op.status) {
      case 'succeeded':
        succeeded += 1;
        break;
      case 'failed':
        failed += 1;
        break;
      case 'skipped':
        skipped += 1;
        break;
      default:
        other += 1;
    }
  }
  return { succeeded, failed, skipped, other };
}

function firstErrorCode(result: RunPublishResult | null): string | null {
  if (!result) return null;
  for (const op of result.summary.operations) {
    if (op.status === 'failed' && op.errorCode) return op.errorCode;
  }
  return null;
}

export async function runAutoExportForAllTenants(
  input: RunAutoExportForAllTenantsInput,
): Promise<RunAutoExportFanOutSummary> {
  const {
    client,
    maxRestaurants,
    maxCandidatesPerRestaurant,
    dryRun = false,
    publishOptions,
    onError = 'continue',
  } = input;
  const notifications = input.notifications ?? buildDefaultNotificationPort();

  const restaurantIds = await listRestaurantsWithOpenOutboundCandidates({
    client,
    limit: maxRestaurants,
  });

  if (dryRun) {
    return {
      restaurantsConsidered: restaurantIds.length,
      restaurantsProcessed: 0,
      summaries: [],
      errors: [],
      dryRun: true,
    };
  }

  const summaries: RunAutoExportSummary[] = [];
  const errors: Array<{ readonly restaurantId: string; readonly message: string }> = [];

  for (const restaurantId of restaurantIds) {
    try {
      const summary = await runAutoExportForRestaurant({
        client,
        restaurantId,
        maxCandidates: maxCandidatesPerRestaurant,
        publishOptions,
      });
      summaries.push(summary);

      const counts = summarizePublish(summary.publishResult);
      if (counts.failed > 0) {
        await notifications.emit({
          kind: 'tenant_run_partial',
          severity: 'warning',
          summary: `Auto-export run for ${restaurantId} completed with ${counts.failed} failed operation(s).`,
          restaurantId,
          publishJobId: summary.publishResult?.summary.publishJobId ?? null,
          errorCode: firstErrorCode(summary.publishResult),
          counts,
          metadata: {
            candidatesConsidered: summary.candidatesConsidered,
            decisionsExecuted: summary.decisionsExecuted,
            skipped: summary.skipped,
          },
        });
      }
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
    dryRun: false,
  };
}

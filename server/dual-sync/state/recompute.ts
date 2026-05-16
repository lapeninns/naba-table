/**
 * Phase 2 of the unified dual-sync engine.
 *
 * Registry-driven state recomputation. Given a snapshot pair (Core +
 * Google) plus the persisted state and outbound-candidate context, this
 * module computes the canonical `DualSyncFieldState` for every registry
 * field and upserts the result into `dual_sync_field_states`.
 *
 * It is the single point of truth that connects:
 *  - `registry/`        : what fields exist + how to canonicalise them
 *  - `hashing.ts`       : SHA-256 over canonical JSON
 *  - `state/compute.ts` : pure state derivation
 *  - `outbound/`        : pending-export overlay
 *
 * Callers:
 *  - `core-writes/apply.ts`     : after a Core write
 *  - `refresh/service.ts`       : after a successful GBP pull
 *  - publish orchestrator       : after a successful publish leg (Phase 3)
 */

import { hashCanonicalJson } from '../hashing';
import { listOpenOutboundCandidates } from '../outbound/candidates';
import { buildRegistry, type DualSyncFieldConfig } from '../registry';
import { computeFieldState } from './compute';
import { listFieldStates } from './read';
import { upsertFieldState } from './write';

import type { DualSyncCanonicalSnapshot } from '../snapshots/types';
import type { DualSyncFieldState, DualSyncSectionKey } from '../types';
import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

type DbClient = SupabaseClient<Database>;

export interface RecomputeAllStatesInput {
  readonly client: DbClient;
  readonly restaurantId: string;
  readonly coreSnapshot: DualSyncCanonicalSnapshot;
  readonly gbpSnapshot: DualSyncCanonicalSnapshot;
  readonly lastSnapshotRunId?: string | null;
  /** When omitted, the registry includes core-only fields. */
  readonly includeCoreOnly?: boolean;
}

export interface RecomputeAllStatesOutput {
  readonly evaluatedFieldKeys: ReadonlyArray<string>;
  readonly transitions: ReadonlyArray<{
    readonly fieldKey: string;
    readonly fromState: DualSyncFieldState | null;
    readonly toState: DualSyncFieldState;
  }>;
}

function readSectionValue(
  snapshot: DualSyncCanonicalSnapshot,
  sectionKey: DualSyncSectionKey | 'core_only',
): unknown {
  switch (sectionKey) {
    case 'profile':
      return snapshot.profile;
    case 'operatingHours':
      return snapshot.operatingHours;
    case 'servicePeriods':
      return snapshot.servicePeriods;
    case 'businessContext.categories':
      return snapshot.businessContext.categories;
    case 'businessContext.serviceAreas':
      return snapshot.businessContext.serviceAreas;
    case 'businessContext.attributes':
      return snapshot.businessContext.attributes;
    case 'businessContext.serviceItems':
      return snapshot.businessContext.serviceItems;
    case 'foodMenus':
      return snapshot.foodMenus ?? { items: [] };
    case 'core_only':
      return null;
    default:
      return null;
  }
}

function valueForField(
  snapshot: DualSyncCanonicalSnapshot,
  config: DualSyncFieldConfig,
  side: 'core' | 'gbp',
): unknown {
  const sectionValue = readSectionValue(snapshot, config.sectionKey);
  if (sectionValue === null || sectionValue === undefined) return null;

  if (config.kind === 'profile') {
    const profileKey = config.fieldKey.split('.')[1];
    if (!profileKey) return null;
    return (sectionValue as Record<string, unknown>)[profileKey] ?? null;
  }

  if (config.kind === 'operatingHours.weekly') {
    return sectionValue;
  }

  if (config.kind === 'servicePeriod') {
    return sectionValue;
  }

  if (
    config.kind === 'businessContext.category' ||
    config.kind === 'businessContext.serviceArea' ||
    config.kind === 'businessContext.attribute' ||
    config.kind === 'businessContext.serviceItem' ||
    config.kind === 'foodMenu.item'
  ) {
    return sectionValue;
  }

  if (config.kind === 'core_only') {
    return side === 'core' ? sectionValue : null;
  }

  return null;
}

/**
 * Recompute every registry field's state for one restaurant. Persists
 * results via `upsertFieldState`. Returns a transition log so the caller
 * can attach audit context (e.g. publish-job id).
 */
export async function recomputeAllStates(
  input: RecomputeAllStatesInput,
): Promise<RecomputeAllStatesOutput> {
  const { client, restaurantId, coreSnapshot, gbpSnapshot, lastSnapshotRunId, includeCoreOnly } =
    input;

  const registry = buildRegistry({
    coreSnapshot,
    gbpSnapshot,
    includeCoreOnly: includeCoreOnly ?? true,
  });

  const [existingStates, openCandidates] = await Promise.all([
    listFieldStates({ client, restaurantId }),
    listOpenOutboundCandidates({ client, restaurantId }),
  ]);
  const existingByKey = new Map(existingStates.map((row) => [row.fieldKey, row]));
  const openByKey = new Set(openCandidates.map((row) => row.fieldKey));
  const recomputedAt = new Date().toISOString();

  const evaluated: string[] = [];
  const transitions: Array<{
    fieldKey: string;
    fromState: DualSyncFieldState | null;
    toState: DualSyncFieldState;
  }> = [];

  for (const config of registry) {
    const coreRaw = valueForField(coreSnapshot, config, 'core');
    const gbpRaw = valueForField(gbpSnapshot, config, 'gbp');
    const coreCanonical = config.canonicalizeCoreValue(coreRaw);
    const gbpCanonical = config.canonicalizeGbpValue(gbpRaw);

    const coreHash = hashCanonicalJson(coreCanonical);
    const gbpHash = hashCanonicalJson(gbpCanonical);

    const previous = existingByKey.get(config.fieldKey) ?? null;
    const previousState = previous?.state ?? null;
    const lastInSyncHash = previous?.lastInSyncHash ?? null;

    const nextState = computeFieldState({
      conflictPolicy: config.conflictPolicy,
      coreHash,
      gbpHash,
      lastInSyncHash,
      hasOpenOutboundCandidate: openByKey.has(config.fieldKey),
      previousState,
      previousCoreHash: previous?.coreValueHash ?? null,
      previousGbpHash: previous?.gbpValueHash ?? null,
      ignored: previousState === 'ignored',
    });

    await upsertFieldState({
      client,
      restaurantId,
      sectionKey: config.sectionKey,
      fieldKey: config.fieldKey,
      state: nextState,
      coreValueHash: coreHash,
      gbpValueHash: gbpHash,
      ...(nextState === 'in_sync'
        ? {
            lastInSyncHash: coreHash,
            lastInSyncAt: recomputedAt,
          }
        : {}),
      lastSnapshotRunId: lastSnapshotRunId ?? null,
    });

    evaluated.push(config.fieldKey);
    transitions.push({
      fieldKey: config.fieldKey,
      fromState: previousState,
      toState: nextState,
    });
  }

  return { evaluatedFieldKeys: evaluated, transitions };
}
